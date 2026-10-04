import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const apiVersion = '2025-01-01';

// PATCH the complete template once so frontend and backend share one revision.
// App-level secrets, registry credentials, domains and ingress remain in Azure.
export function deploymentPatch(app, { backendImage, frontendImage, suffix }) {
  if (app.properties.configuration.activeRevisionsMode !== 'Single') {
    throw new Error('Set Deployment mode to Single revision in Azure before deploying.');
  }
  const template = structuredClone(app.properties.template);
  const backend = template.containers.find(c => c.name === 'backend');
  const frontend = template.containers.find(c => c.name === 'frontend');
  if (!backend || !frontend) {
    throw new Error('The existing Container App must contain frontend and backend.');
  }
  if (!backendImage || !frontendImage || !/^gh-[0-9]+-[0-9]+$/.test(suffix)) {
    throw new Error('Missing images or invalid revision suffix.');
  }
  const port = backend.env?.find(e => e.name === 'PORT');
  if (port && port.value !== '8000') {
    throw new Error('Backend PORT must be the literal value 8000.');
  }
  backend.image = backendImage;
  frontend.image = frontendImage;
  frontend.env = (frontend.env ?? []).filter(e => e.name !== 'BACKEND_UPSTREAM');
  frontend.env.push({ name: 'BACKEND_UPSTREAM', value: '127.0.0.1:8000' });
  // A live nginx process alone must not make a crashed backend look ready.
  backend.probes = [
    { type: 'Startup', httpGet: { path: '/health', port: 8000 },
      periodSeconds: 10, timeoutSeconds: 2, failureThreshold: 30 },
    { type: 'Readiness', httpGet: { path: '/health', port: 8000 },
      periodSeconds: 10, timeoutSeconds: 2, failureThreshold: 3 },
    { type: 'Liveness', httpGet: { path: '/health', port: 8000 },
      periodSeconds: 30, timeoutSeconds: 2, failureThreshold: 3 },
  ];
  template.revisionSuffix = suffix;
  return { location: app.location, properties: { template } };
}

function required(name) {
  if (!process.env[name]) throw new Error(`Missing environment variable: ${name}`);
  return process.env[name];
}

function azJson(args) {
  // Capture output rather than printing the app's configuration in CI logs.
  return JSON.parse(execFileSync('az', [...args, '--output', 'json'], {
    encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  }));
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function health(url) {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(15_000) });
    return response.ok && (await response.json()).status === 'ok';
  } catch {
    return false;
  }
}

async function main() {
  const subscription = required('AZURE_SUBSCRIPTION_ID');
  const group = required('AZURE_RESOURCE_GROUP');
  const name = required('AZURE_CONTAINER_APP');
  const suffix = required('REVISION_SUFFIX');
  const resource = `/subscriptions/${subscription}/resourceGroups/${group}/providers/Microsoft.App/containerApps/${name}`;
  const endpoint = `https://management.azure.com${resource}?api-version=${apiVersion}`;
  const getApp = () => azJson(['rest', '--method', 'get', '--url', endpoint]);
  const app = getApp();
  const patch = deploymentPatch(app, {
    backendImage: required('BACKEND_IMAGE'), frontendImage: required('FRONTEND_IMAGE'), suffix,
  });
  const fqdn = app.properties.configuration.ingress?.fqdn;
  if (!fqdn) throw new Error('The Container App must have HTTP ingress enabled.');
  const publicUrl = `https://${fqdn}`;
  const revision = `${name}--${suffix}`;
  const temp = mkdtempSync(join(tmpdir(), 'cogniva-deploy-'));
  try {
    const file = join(temp, 'patch.json');
    writeFileSync(file, JSON.stringify(patch), { mode: 0o600 });
    execFileSync('az', ['rest', '--method', 'patch', '--url', endpoint,
      '--headers', 'Content-Type=application/json', '--body', `@${file}`, '--output', 'none'],
    { timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  console.log(`Waiting for revision ${revision} (up to 15 minutes)...`);
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    const current = getApp();
    if (current.properties.provisioningState === 'Failed') {
      throw new Error(`Azure provisioning failed. Check system and backend logs for ${revision}.`);
    }
    if (current.properties.latestReadyRevisionName === revision && await health(publicUrl)) {
      const response = await fetch(publicUrl, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Frontend returned HTTP ${response.status}.`);
      console.log(`Deployment healthy: ${publicUrl}`);
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY,
          `Deployed revision \`${revision}\`. Frontend and /health passed.\n\n${publicUrl}\n`);
      }
      return;
    }
    console.log('Revision is not ready yet; waiting for backend startup/migrations.');
    await delay(15_000);
  }
  throw new Error(`Timed out waiting for ${revision}. Check Azure backend logs. Database migrations are not rolled back automatically.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    if (error.stderr) console.error(String(error.stderr));
    process.exitCode = 1;
  });
}

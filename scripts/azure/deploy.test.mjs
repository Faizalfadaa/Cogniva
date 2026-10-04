import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentPatch } from './deploy.mjs';

function fixture() {
  return { location: 'eastasia', properties: {
    configuration: { activeRevisionsMode: 'Single', secrets: [{ name: 'database-url' }],
      ingress: { targetPort: 80 }, registries: [{ server: 'cogniva.azurecr.io' }] },
    template: { revisionSuffix: 'old', scale: { minReplicas: 0, maxReplicas: 10 }, containers: [
      { name: 'frontend', image: 'frontend:v1', env: [{ name: 'BACKEND_UPSTREAM', value: 'old:8000' }],
        resources: { cpu: 0.25, memory: '0.5Gi' } },
      { name: 'backend', image: 'backend:v1', env: [
        { name: 'DATABASE_URL', secretRef: 'database-url' }, { name: 'PORT', value: '8000' }],
        resources: { cpu: 0.5, memory: '1Gi' } },
    ] },
  } };
}
const options = { backendImage: 'backend:commit', frontendImage: 'frontend:commit', suffix: 'gh-123-1' };

test('updates both images together without exporting app-level credentials or changing input', () => {
  const app = fixture();
  const original = structuredClone(app);
  const patch = deploymentPatch(app, options);
  assert.deepEqual(app, original);
  assert.deepEqual(Object.keys(patch.properties), ['template']);
  const [frontend, backend] = patch.properties.template.containers;
  assert.equal(frontend.image, options.frontendImage);
  assert.equal(backend.image, options.backendImage);
  assert.deepEqual(backend.env, app.properties.template.containers[1].env);
  assert.deepEqual(backend.resources, app.properties.template.containers[1].resources);
  assert.deepEqual(patch.properties.template.scale, app.properties.template.scale);
  assert.deepEqual(frontend.env, [{ name: 'BACKEND_UPSTREAM', value: '127.0.0.1:8000' }]);
  assert.ok(backend.probes.every(p => p.httpGet.port === 8000 && p.httpGet.path === '/health'));
});

test('finds containers by name rather than assuming Azure array order', () => {
  const app = fixture();
  app.properties.template.containers.reverse();
  const patch = deploymentPatch(app, options);
  assert.equal(patch.properties.template.containers[0].image, options.backendImage);
});

test('refuses to replace an incomplete app or silently change multiple-revision traffic', () => {
  const app = fixture();
  app.properties.template.containers.pop();
  assert.throws(() => deploymentPatch(app, options), /frontend and backend/);
  const multiple = fixture();
  multiple.properties.configuration.activeRevisionsMode = 'Multiple';
  assert.throws(() => deploymentPatch(multiple, options), /Single revision/);
});

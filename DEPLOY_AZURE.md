# Auto-deploy Cogniva to Azure Container Apps

Push to `main` to run `.github/workflows/deploy-azure.yml`. Other branches and
pull requests do not deploy. After the workflow is on the default branch, it
can also be started from GitHub Actions with **Run workflow**, selecting `main`.

## Existing Azure resources

- Resource group: `rg-cogniva`
- Container App: `cogniva`, in **Single revision** deployment mode
- Containers: `frontend` and `backend`
- Registry: `cogniva.azurecr.io` (`RBAC Registry Permissions` mode)
- Public HTTP ingress target port: `80`
- Backend `PORT`: `8000`

The app must already have the Supabase, Gemini and JWT secret references configured.
Secrets remain in Azure; do not commit `.env` or add database credentials to the workflow.

## GitHub authentication

Repository secrets:

- `AZURE_CLIENT_ID`: client ID of the user-assigned managed identity
- `AZURE_TENANT_ID`: tenant ID
- `AZURE_SUBSCRIPTION_ID`: subscription ID

The identity's federated credential must trust the `main` branch of
`Faizalfadaa/Cogniva`, issuer `https://token.actions.githubusercontent.com`,
audience `api://AzureADTokenExchange`. The subject must exactly match the subject
GitHub issues (including immutable owner/repository IDs if enabled). This workflow
does not use a GitHub Environment, so configure a Branch credential, not Environment.

Assign `AcrPush` on the registry and `Container Apps Contributor` on the existing
Container App to that identity. The app's existing registry authentication is
separate from the identity GitHub uses to push/deploy.

## What each run does

1. Build Linux amd64 backend and check its types/unit tests without production secrets.
2. Build frontend with an empty `VITE_API_BASE` and validate nginx configuration.
3. Log into Azure via OIDC, then push images tagged with commit SHA, run ID and attempt.
4. Read the current app template and update both images in one PATCH/revision.
   Existing environment variables, secret references, resources, scaling, extra
   containers and app-level settings are preserved. Frontend's `BACKEND_UPSTREAM`
   is set to `127.0.0.1:8000`; backend startup/readiness/liveness probes use `/health`.
5. Wait for that exact revision to become ready, then check public `/health` and `/`.

Backend startup runs `prisma migrate deploy` against Supabase before starting the
server. Keep schema migrations compatible with the previous release during rollout.
Supabase must be active. A failed image build does not change Azure. Azure Single
revision mode keeps traffic on the previous revision until the new one is ready;
database changes are not automatically rolled back. The workflow does not promise
automatic rollback after a public health-check failure.

## Troubleshooting

- GitHub **Actions -> Deploy Cogniva to Azure -> failed step** shows the failure.
- `AADSTS700213`: compare the subject reported by Azure login with the federated
  credential, including branch, case and immutable IDs. Do not share OIDC tokens.
- Push denied: check the identity's `AcrPush` assignment and registry permission mode.
- Deployment authorization denied: check the app-scoped `Container Apps Contributor` role.
- Readiness timeout: Azure **Revisions and replicas -> new revision -> Logs**;
  filter Application logs to `backend`. Check Supabase status/connection strings.
- Missing config at build: ensure the rename to `apps/backend/prisma.config.ts`
  and both Dockerfile changes are committed along with the workflow.

References:
- https://learn.microsoft.com/en-us/azure/container-apps/github-actions
- https://learn.microsoft.com/en-us/entra/workload-id/workload-identities-github-immutable-subjects

# Infrastructure ownership matrix

| Concern | Current owner | Chronicles target | Migration rule |
|---|---|---|---|
| Cloudflare zone `shadowops.dpdns.org` | Existing shared account/zone | Reuse zone | Never recreate or import zone into Chronicles state |
| Chess Studio production frontend DNS | Chess Studio deployment script | Separate Chronicles Pages hostname | No edits to Chess Studio hostname |
| Chess Studio API DNS/tunnel | Chess Studio OCI/Render routing script | Distinct Chronicles API ingress, TBD | Never reuse a DNS name or tunnel identity without review |
| Narrative AI Worker `ai.shadowops.dpdns.org` | Chess Studio Terraform | Not transferred | No duplicate Terraform state |
| OCI staging instance/VCN | Chess Studio Terraform | Capacity/placement assessment required | Never import, destroy or replace existing OCI resources |
| Mongo data, user identity, saves | Existing backend | Account-safe migration design pending | No cross-origin browser storage assumption; no destructive cutover |
| Cloudflare Pages | Chess Studio deploy script | Separate staging and production Pages projects | Independent SHA promotion and rollback |
| Secrets | Existing GitHub environment/OCI vault | Scoped Chronicles environments | Do not copy tokens or state into Git |

## Acceptance before any apply

Document exact Terraform state backend, cloud resource IDs, DNS record owners, zone permissions, routing, TLS, staging cost/capacity and rollback. Separate *ownership* from *reuse*: a shared provider account or region does not imply that Chronicles may manage Chess Studio resources.

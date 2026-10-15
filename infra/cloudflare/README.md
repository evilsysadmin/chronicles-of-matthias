# Chronicles Cloudflare domain ownership

Production: `chronicles.shadowops.dpdns.org`.
Staging: `staging.chronicles.shadowops.dpdns.org`.

Chess Studio currently manages its production Pages and API DNS through deployment scripts, **not** its narrative Worker Terraform. Do not copy its `infra/cloudflare/main.tf` into Chronicles or import shared Worker state: that would risk double ownership.

This directory starts with a **read-only Terraform contract** for intended Chronicles hostnames. It does not create DNS records or TLS certificates. DNS ownership and routing must be decided after selecting the standalone frontend host and backend ingress.

Before any DNS apply:

1. Confirm Cloudflare zone `shadowops.dpdns.org`, current records and their state owners.
2. Decide Pages custom-domain vs Tunnel/CNAME routing for each hostname. Never declare a DNS record already owned by another controller.
3. Keep staging and production distinct and retain Chess Studio records.
4. Test TLS issuance, API CORS, websocket behavior if needed, health, F5, saves and rollback.
5. Use scoped Cloudflare credentials from CI secrets; never commit tokens or put application secrets in Terraform state.

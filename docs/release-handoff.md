# Chronicles → shadowops-infra release handoff

Chronicles CI owns tests, building its Go API image and publishing to GHCR. **Do not dispatch until the image exists and its digest is verified.** The infra repo alone authorizes deployment. Payload validation is only an early guard, **not authentication or accreditation**.

Allowed event: repository_dispatch type chronicles_release_candidate carrying exactly repository, service, sha, digest, environment=staging. Never accept shell commands, image URLs or arbitrary environments from dispatch.

Receiver must independently verify event identity and repository allowlist, image provenance/attestation and SHA-digest linkage, required successful checks, and staging approval record. Production must promote only the previously smoke-tested digest via a separate privileged workflow; hotfix still requires accreditation. Record previous digest for rollback. Use a GitHub App installation token scoped to the infra repo, not a broad personal access token.

No dispatch workflow is enabled until shadowops-infra exists, the actual Go binary builds, and receiver policy is tested. No Chess Studio workflow, Compose, DNS, Terraform or deployment is changed.

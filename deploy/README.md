# Production

Target: https://maple.omerlabinsky.com, `/srv/apps/mcp-atlas`.
The static `dist/` snapshot is served by a pinned Nginx image as UID 101.
No packages, database, application secrets, host ports, or data volumes are required.
Traefik uses the existing external `web` network, `websecure`, and TLS certificate.

Verify `npm run verify` and `npm run test:app` before a release. Build from the
exact reviewed Git commit with `docker build -t mcp-atlas:<commit> .`.
Set `ATLAS_IMAGE` to the resulting immutable `sha256:` image ID when running
`docker compose -f compose.production.yml config` and
`docker compose -f compose.production.yml up -d --wait`.
The operator retains the selected image ID in `release-image.txt` on the server.
No automatic deployment is triggered by a GitHub push.

Check health, origin routing, public HTTPS, JSON/image assets, map search, and
route planning. Compare existing container IDs before and after deployment.
Cloudflare must use Full (strict); the dedicated proxied A record is
`maple.omerlabinsky.com` -> `45.32.156.117`.

Rollback an update by setting `ATLAS_IMAGE` to the retained previous image ID
and applying the retained Compose configuration with `up -d --wait`.
For the initial release, withdraw only this service with `docker compose -f
compose.production.yml stop atlas` using the selected `ATLAS_IMAGE` value.
Keep release files and images for diagnosis. Do not stop shared Traefik, prune
Docker, or remove other applications. DNS withdrawal needs explicit approval.

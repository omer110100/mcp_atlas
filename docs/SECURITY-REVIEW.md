# Security review — expedition update

Recorded on **20 November 2026**. This document separates the managed baseline scan, review of the new changes, and isolated runtime checks. It is evidence for this update, not a guarantee that the application has no vulnerabilities.

## Scope and trust boundaries

The atlas serves static application code, source datasets and image assets. It has no server accounts, application database or upload endpoint. Favorites, notes, collections, route recipes and preferences stay in browser storage. Backup import reads a user-selected file in the browser; export creates a local download. Neither operation sends personal data to a server.

The changed journey, hunting, personal-library and interface modules received independent source review. Review covered URL-fragment parsing, numeric map/entity IDs, bounded route goals and stops, backup validation and merging, escaped user text, storage failures, cross-tab updates and preservation of navigation state. This review is separate from the managed baseline scan below.

## Baseline finding and fix

The managed scan was sealed against immutable baseline commit `310bb22`. It recorded **one low-severity CWE-407 finding**: repeated duplicate-parameter scanning could cause quadratic work when processing an oversized shared-route URL fragment.

The updated `dist/personal.js` rejects non-string fragments and fragments longer than **8,192 characters before constructing URLSearchParams**. A single pass over the decoded keys uses an allow-list and a `Set` to reject unknown or duplicate parameters, including encoded aliases. Route endpoints, stops, progress and optional hunting goals are then validated against the bounded journey contract.

Regression checks cover rejection before parameter parsing or recipe normalization, duplicate and encoded keys, oversized fragments, invalid goals and valid share/restore round trips. The current change was source-reviewed and tested; the sealed baseline scan must not be described as a scan of the final update.

## Origin safeguards and runtime evidence

`deploy/nginx.conf` applies an **aggregate origin budget of 300 requests/second with burst 600 and `nodelay`**, returning 429 for excess requests. All visitors share this budget; it is not a per-IP allowance. The key is `$server_name`, with the explicit value `maple.omerlabinsky.com`, so changing `X-Forwarded-For` does not create a separate budget. `/healthz` is outside the limited static-content location.

The first isolated runtime check exposed a missing `server_name`: its empty value caused requests to bypass accounting. Adding the explicit server name corrected this. Nginx documents both key-based accounting and the exclusion of empty keys in its [request-limiting module documentation](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html#limit_req_zone).

The corrected configuration passed these checks in disposable, network-isolated containers:

| Check | Observed result |
| --- | --- |
| Nginx configuration validation | Passed |
| Index GET | 200 |
| Missing page | 404 |
| `/.git/config` | 404 |
| POST to the index | 405 |
| Response security headers | Present, including the configured CSP subset |
| Isolated limiter changed to 1 request/minute and burst 1 | 200, 200, then eight 429 responses |
| Different `X-Forwarded-For` value on every limiter request | Still used the shared budget |
| Health request after exhausting that budget | 200 |

The low-budget probe exercises the same limiter in a separate configuration; it does not send a load test to the public site. It verifies enforcement, not production throughput or resistance to a distributed denial-of-service attack. Legitimate concurrent visitors can exhaust the shared budget.

Other origin settings restrict methods to GET/HEAD, cap request bodies at 1 KiB, and set header/body timeouts to 10 seconds, send timeout to 15 seconds and keepalive timeout to 20 seconds. Headers include `nosniff`, frame denial, a restrictive permissions policy and a referrer policy.

The CSP deliberately covers only `object-src`, `base-uri`, `frame-ancestors` and `form-action`. It does **not** restrict scripts and is not a complete XSS policy. A `script-src` restriction was omitted because a Cloudflare inline challenge was observed in the delivery path. No Cloudflare security policy was changed or verified as part of these checks.

The existing non-root container user, read-only filesystem, dropped capabilities, no-new-privileges setting, bounded temporary filesystem, memory/PID limits and bounded logs remain in place. The update does not change those Compose safeguards or the shared ingress configuration.

## Reproduce the isolated container checks

Use Python 3 and a Docker engine that can run the already-built Linux release image. Set `ATLAS_IMAGE` to its immutable `sha256:` image ID, then run from the repository root:

```sh
python3 scripts/check-nginx.py "$ATLAS_IMAGE" deploy/nginx.conf ./nginx-qa
```

`scripts/check-nginx.py` checks the expected production rate, burst and server name before testing. It retains `production-nginx.conf`, `rate-probe-nginx.conf` and `result.json` in the chosen QA directory. The report identifies the immutable image used.

The checker starts two disposable containers sequentially, publishes no ports and uses `--network none`; requests run inside each container against loopback. Containers use UID 101, a read-only root filesystem, dropped capabilities, no-new-privileges, a 16 MiB temporary filesystem, 64 MiB memory, 32 PIDs and a 0.5 CPU test limit. Each container is stopped when its test finishes. This command does not deploy or modify the running production service.

## Application checks and limits

`npm run test:app` passed **466 checks with zero failures** for this review. These run the real application modules in Node VM contexts with DOM-contract stubs. They cover route planning and restoration, exact map/NPC/monster selections, localized interface state, backup boundaries, notes and storage failures, and the new experience controls.

These automated checks do not render browser layouts, establish live-game behavior or verify Cloudflare policy. The isolated Nginx results establish container behavior for the tested image and configuration; public HTTPS delivery and release verification remain separate deployment checks.

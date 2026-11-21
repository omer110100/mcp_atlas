# Maple Atlas project context

Apply the user's current global engineering standards and existing project
conventions. Do not restore retired skills or workflows.

## Standing publication authorization

On 2026-11-21 the owner explicitly authorized this update and future requested
Maple Atlas updates to be committed, pushed to GitHub and deployed to the
existing site without asking for publication approval again. The owner plans
to review changes in production. This project-specific instruction supersedes
older requirements to obtain fresh approval for each Atlas publication.

- Repository: `https://github.com/omer110100/mcp_atlas.git`.
- Current delivery branch: `feat/v3-app-shell`; inspect the actual branch and
  remote state before acting. A deployment does not imply merging into main.
- Existing site: `https://maple.omerlabinsky.com`.
- Continue appropriate tests, exact-revision CI, production preflight, health
  and public verification, and retain the prior immutable image for rollback.
- Read `C:/Users/omer1/dev/omerlabinsky.com/notes/production-server.md` before
  server work. Revalidate live state; the server's primary checkout may differ
  from the active detached-worktree release.
- This authorization covers the Atlas delivery work. It does not authorize
  unrelated application changes, destructive data operations, secret changes,
  new paid services, or auth/database migrations.
- The owner's statement that only they use the site is not evidence of an
  access restriction. Treat it as publicly reachable unless access control
  has actually been verified. Do not add authentication without approval.

## Validation and source integrity

Use the buildless project's `npm run verify` and `npm run test:app`. Preserve
pinned game datasets and exact scene coordinates when changing presentation.
World layout coordinates are derived independently of routing and source
portal/NPC/spawn coordinates. The original world-sheet spots can represent
multiple map IDs; retain the explicit chooser and unmapped extension panel.

Artwork attribution is not licensing clearance. Keep the distinctions and
outstanding decisions in `docs/OWNER-PROTECTION-REVIEW.md` visible in relevant
reports; do not claim legal immunity or universal security/accessibility.

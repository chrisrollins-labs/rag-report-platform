# CI/CD

## Gates (`.github/workflows/ci.yml`)

Every push and pull request runs:

- **Secret scan** — gitleaks; a real credential in the diff fails the build.
- **Typecheck** — `tsc --noEmit`, strict.
- **Lint** — ESLint (Next + TypeScript rules).
- **Test** — the full Vitest suite, offline.
- **RLS coverage** — `check:rls` fails if any table lacks RLS or a policy.
- **Migration order** — `check:migrations` fails on a non-appended migration.
- **Build** — `next build`.

Security scanning also runs via CodeQL (`.github/workflows/codeql.yml`).

## What is deliberately NOT here

No live deploy job tied to real infrastructure. This is a reference
implementation; the workflow demonstrates the gates without pretending to own a
production environment. In a real deployment, a merge to `main` would apply
migrations to staging and promote on a manual production workflow, with the same
secrets discipline (values only in the platform's environment settings, never in
the repo).

## Environments (reference)

Local (`.env.local`) → preview per PR → staging → production, with identical
variable names and different values per environment. Schema flows through
migrations only (ADR-012).

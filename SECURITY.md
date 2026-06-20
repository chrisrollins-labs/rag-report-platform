# Security

This is a reference implementation, not a deployed service, but it is built to
the same standards a production system should hold. The patterns below are the
point.

## Secrets

No real secret is ever committed, in any file, ever. Real values live only in
your local `.env.local` (gitignored) and in your deployment platform's
environment settings. `.env.example` carries placeholder **names** only, and a
unit test (`tests/env-example.test.ts`) fails the build if a real-looking
credential is ever pasted in. gitleaks runs in CI on every push and pull
request.

## Input validation

Every external input is validated at the boundary with Zod before it reaches
any logic (see `src/app/api/reports/route.ts`). Model output is validated the
same way before it is trusted (`src/ai/client.ts`), with a corrective retry
before a hard failure.

## Least privilege and data isolation

The production data layer enforces isolation in the database with Row-Level
Security, enabled in the same migration that creates each table and verified by
a CI gate. The service-role database client is server-only and never reaches
the browser. (The in-memory store in this slice stands in for that layer; the
interface it implements is the seam where the RLS-backed store plugs in.)

## Dependencies

CI runs type checking, linting, tests, and a build on every change. A CodeQL
workflow and dependency audit are part of the full CI stack.

## Reporting

This is a portfolio reference implementation. For questions, open an issue.

# Contributing

This is a reference implementation maintained as a portfolio project, but it is
built to be contributed to, and the conventions are part of what it
demonstrates.

## Ground rules

- **One concern per pull request.** A change is a coherent unit: code plus its
  tests plus any doc update, green in CI, reviewable in one sitting.
- **Tests stay offline.** No test may touch a real network or database. Inject
  the transport and the store; use the mocks in `src/ai/providers/mock.ts` and
  `InMemoryReportStore`.
- **Secrets never enter the repo.** See [SECURITY.md](SECURITY.md).
- **Decisions get recorded.** A non-obvious architectural choice gets an ADR in
  `docs/decisions/` using the standard Context / Decision / Consequences shape.

## Local checks

```bash
npm run typecheck
npm run lint
npm test
```

All three run in CI and must pass before merge.

## Commit style

Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`). Keep
the subject imperative and under ~72 characters.

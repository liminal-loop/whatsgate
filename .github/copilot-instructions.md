# WhatsGate Copilot Instructions

WhatsGate is a NestJS 11 + TypeScript WhatsApp API gateway with modular architecture and PostgreSQL as the primary data store.

## Runtime and Tooling

- Use Node.js 26 for local and CI parity.
- Keep the TypeScript toolchain on 5.9.x in this v1 phase unless a dedicated TS 6 migration is explicitly requested.
- Install dependencies with `npm ci` (preferred) or `npm install`.
- Main development command: `npm run start:dev`.
- Build command: `npm run build`.
- Lint command: `npm run lint`.
- Unit tests: `npm test`.
- E2E tests: `npm run test:e2e`.

## Architecture and File Navigation

- API entrypoint: `src/main.ts`.
- Root module: `src/app.module.ts`.
- Feature modules are under `src/modules/`.
- Shared infrastructure is under `src/common/` and `src/core/`.
- Database configuration is under `src/database/`.
- SDKs are in `sdk/javascript/` and `sdk/python/`.
- Documentation source is in `docs/`.

## Change Guidelines

- Keep module boundaries intact (feature code in `src/modules/<feature>`).
- Reuse shared services/utilities before adding new abstractions.
- Keep TypeScript strictness and NestJS patterns consistent with existing code.
- Prefer minimal, targeted changes over broad refactors unless explicitly requested.
- For DB schema changes in this v1 phase, keep TypeORM synchronize-based schema management aligned with entities and configuration (no migration scripts unless explicitly requested).

## Validation Expectations Before Finalizing

- Always run lint and tests for affected code paths when feasible.
- At minimum, run `npm run lint`, `npm test`, and `npm run build` after backend code changes.
- Run `npm run test:e2e` when e2e files, bootstrap behavior, or dependency/runtime tooling are changed.
- If API contracts are changed, ensure docs under `docs/` are updated.

## Security and Secrets

- Never hardcode or commit API keys, tokens, credentials, or session artifacts.
- Use `.env` for local secrets and keep `.env.example` as the template.
- Preserve authentication, rate limiting, and audit behavior when modifying request flows.

## CI Awareness

- CI workflow runs lint, test (with coverage), then build.
- Release workflow runs test/build and creates a GitHub release from tags.
- Keep changes compatible with these workflow gates.

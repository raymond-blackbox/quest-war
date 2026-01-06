---
description: You are implementing production-ready Node.js backend services
---

# Node.js Backend Patterns (Workflow)

You are implementing production-ready Node.js backend services (REST or GraphQL).
Follow the repo's Node.js Backend Standards rule.

## Step 0 — Confirm constraints (only if missing)
Ask at most 3 questions:
1) Framework: Fastify or Express?
2) API style: REST or GraphQL?
3) Database: Postgres/MySQL/Mongo/other (and ORM: Prisma/Sequelize/knex/raw)?

If the repo already indicates answers, do not ask—proceed.

## Step 1 — Produce an implementation plan (before coding)
Include:
- target structure under src/
- routing approach
- validation approach (Fastify schema / zod / joi)
- auth approach
- logging approach
- error handling strategy
- testing approach

## Step 2 — Scaffold or refactor incrementally
### Required modules
- config/env loader (with validation)
- logger (structured, requestId)
- error handling (typed errors + centralized handler)
- request validation
- auth middleware/guard (JWT or repo standard)
- health endpoint (/health)
- example feature module: users
  - routes -> controller -> service -> repository
  - includes at least one read + one write endpoint
  - repository uses parameterized queries / ORM safe APIs

### If Fastify
- Use route schemas for body/params/query validation.
- Use plugins for auth/logging where appropriate.

### If Express
- Add a validation middleware (zod/joi) per route.
- Add async error wrapper to avoid unhandled promise rejections.

## Step 3 — Add tests
- Unit tests for service and repository.
- Minimal integration test (happy path + validation failure) if feasible.
- Provide commands to run tests.

## Step 4 — Verify
- Run lint/typecheck/tests.
- Start server and hit health + one users endpoint.
- Summarize what was changed and how to run locally.

## Output format
- Make the code changes directly in the repo.
- At the end, provide:
  - new/changed files list
  - run instructions
  - env vars needed
  - test commands

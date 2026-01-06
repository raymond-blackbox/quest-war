---
trigger: model_decision
description: Apply these standards whenever generating or refactoring backend code for Node.js project.
---

# Node.js Backend Standards (Workspace Rule)

Apply these standards whenever generating or refactoring backend code for Node.js project.

## Defaults
- Language: TypeScript first. Use JavaScript only if explicitly requested.
- Runtime: Node LTS.

## Architecture
- Use a layered structure:
  - src/routes
  - src/controllers
  - src/services
  - src/repositories
  - src/models (or src/entities)
  - src/middleware
  - src/config
  - src/utils
  - src/types
- Keep HTTP concerns in controllers; business logic in services; DB access in repositories.
- Prefer dependency injection over global singletons for testability.

## API & Validation
- Validate all inputs (body/query/params). Reject unknown fields where possible.
- Consistent error model:
  - 400 validation
  - 401 unauthenticated
  - 403 unauthorized
  - 404 not found
  - 409 conflict
  - 500 internal
- Add request IDs and structured logs for every request.

## Security Baseline
- Enable CORS with explicit origins.
- Use security headers (helmet or equivalent).
- No secrets in code. Use env + config module.
- Auth: JWT (or repo standard). Enforce authorization checks in service layer.

## Testing
- Add unit tests for new modules and bug fixes.
- Prefer testable design (DI, pure functions in utils, thin controllers).

## Implementation discipline
- Small, reviewable diffs.
- Update README when you add new env vars, scripts, or run steps.

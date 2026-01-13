---
description: Master REST and GraphQL API design principles to build intuitive, scalable, and maintainable APIs. Use when designing new APIs, reviewing API specifications, or establishing API design standards.
---

# API Design Principles

Master REST and GraphQL API design principles to build intuitive, scalable, and maintainable APIs that delight developers and stand the test of time.

## When to Use This Skill

- Designing new REST or GraphQL APIs
- Refactoring existing APIs for better usability
- Establishing API design standards for your team
- Reviewing API specifications before implementation
- Migrating between API paradigms (REST to GraphQL, etc.)

## Core Resources

**Must Read Documents:**
- [REST Best Practices](file:///c:/Users/User/quest-war/.agent/resources/api-design-principles/references/rest-best-practices.md) - Comprehensive guide for RESTful design.
- [GraphQL Schema Design](file:///c:/Users/User/quest-war/.agent/resources/api-design-principles/references/graphql-schema-design.md) - Patterns and anti-patterns for GraphQL.

**Tools & Templates:**
- [API Design Checklist](file:///c:/Users/User/quest-war/.agent/resources/api-design-principles/assets/api-design-checklist.md) - Use this before finalizing any API spec.
- [FastAPI Template](file:///c:/Users/User/quest-war/.agent/resources/api-design-principles/assets/rest-api-template.py) - Reference implementation for REST APIs.

## Instructions

When the user asks for API design help:

1. **Analyze Requirements**: Understand the domain, read any existing schema or documentation.
2. **Consult Best Practices**: Refer to the documents in `.agent/resources/api-design-principles/references/` using `view_file`.
3. **Draft Design**: Create a draft of the API endpoints (REST) or schema (GraphQL).
4. **Apply Patterns**:
   - For **REST**: Use resource-oriented nouns, proper HTTP methods, and standard status codes.
   - For **GraphQL**: Follow schema-first development, use Relay-style pagination, and avoid N+1 issues with DataLoaders.
5. **Review with Checklist**: Use the `api-design-checklist.md` in the assets directory to verify your design.

## RESTful Design Patterns

### Resource Collection Design
- Resources are nouns: `/users`, `/orders`.
- Use HTTP methods for actions: `GET` (list/get), `POST` (create), `PATCH` (update), `DELETE`.

## GraphQL Design Patterns

### Schema Design
- Use clear type definitions and Relay-style connections for pagination.
- Enums for type safety.
- Input types for mutations.

## Common Pitfalls to Avoid
- Over-fetching/Under-fetching.
- Inconsistent error formats.
- Missing rate limits.
- Tight coupling between API and DB schema.

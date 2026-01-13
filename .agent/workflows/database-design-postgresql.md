---
description: Design a PostgreSQL-specific schema. Covers best-practices, data types, indexing, constraints, performance patterns, and advanced features.
---

# PostgreSQL Table Design

Design robust, performant PostgreSQL schemas by following these core rules and patterns.

## Core Rules

- **Primary Keys**: Use `BIGINT GENERATED ALWAYS AS IDENTITY` for reference tables. Use `UUID` only for distributed systems or opaque IDs.
- **Normalization**: Normalize to 3NF first. Denormalize only for proven high-ROI read performance gains.
- **Constraints**: Use `NOT NULL` by default. Use `DEFAULT` for common values.
- **Indexing**: Index PKs/Uniques (auto), FKs (manual!), and frequent filter/join keys.

## Data Types Guidance

### Recommended
- **Strings**: `TEXT` (prefer over `VARCHAR(n)`).
- **Numbers**: `BIGINT` for IDs/counters, `NUMERIC` for money, `DOUBLE PRECISION` for floats.
- **Time**: `TIMESTAMPTZ` for all event timestamps.
- **Binary**: `JSONB` for semi-structured data, `BYTEA` for raw binary.
- **Special**: `INET/CIDR` for networking, `PostGIS` (if available) for spatial.

### Avoid
- DO NOT use `timestamp` (without time zone).
- DO NOT use `char(n)` or `varchar(n)`.
- DO NOT use `money`.
- DO NOT use `serial`.

## Indexing Patterns

- **B-tree**: Default for equality and range.
- **GIN**: For `JSONB`, arrays, and full-text search.
- **GiST**: For ranges, geometry, and exclusion constraints.
- **Partial**: For hot subsets (e.g., `WHERE status = 'active'`).
- **Expression**: For computed keys (e.g., `LOWER(email)`).

## Performance & Scaling

- **Update-Heavy**: Separate hot/cold columns, use `fillfactor=90`.
- **Insert-Heavy**: Minimize indexes, use `COPY` or multi-row `INSERT`.
- **Partitioning**: Use for tables >100M rows, usually by time or hash. Prefer declarative partitioning.

## Schema Evolution

- **Transactional DDL**: Run DDL in transactions to allow rollback.
- **Safe Migrations**: Use `CREATE INDEX CONCURRENTLY` to avoid blocking writes.
- **Volatile Defaults**: Avoid adding `NOT NULL` columns with volatile defaults (like `now()`) on large tables.

## Implementation Steps

When designing a schema:
1. **Define Entities**: Identify main resources and their primary keys.
2. **Apply Normalization**: Ensure 3NF.
3. **Select Data Types**: Follow the "Recommended" list above.
4. **Add Constraints**: PK, FK, NOT NULL, CHECK, UNIQUE.
5. **Plan Indexing**: Add indexes for FKs and expected search patterns.
6. **Review JSONB Usage**: Ensure semi-structured data is used appropriately and indexed.

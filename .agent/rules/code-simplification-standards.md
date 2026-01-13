---
trigger: model_decision
description: Apply these standards for code simplification, clarity, and consistency when refactoring or generating code.
---

# Code Simplification Standards

Follow these standards to enhance code clarity, consistency, and maintainability while preserving exact functionality.

## Core Principles
1. **Preserve Functionality**: Never change what the code does - only how it does it.
2. **Prioritize Clarity**: Readable, explicit code is preferred over overly compact solutions.
3. **Avoid Over-Simplification**: Do not reduce clarity, create "clever" but obscure solutions, or combine too many concerns.

## Coding Standards (Project Specific)
- **ES Modules**: Use ES modules with proper import sorting and extensions.
- **Function Keyword**: Prefer the `function` keyword over arrow functions for top-level definitions.
- **Explicit Types**: Use explicit return type annotations for top-level functions and Props types for React components.
- **React Patterns**: Follow established React component patterns.
- **Error Handling**: Use established patterns; avoid `try/catch` when a cleaner alternative exists.
- **Naming**: Maintain consistent naming conventions across the project.

## Simplification Rules
- **Reduce Complexity**: Minimize nesting and eliminate redundant abstractions.
- **No Nested Ternaries**: Avoid nested ternary operators. Use `switch` statements or `if/else` chains instead.
- **Explicit Returns**: Keep logic easy to follow with clear exit points.
- **Consolidate Logic**: Group related operations to improve readability.
- **Remove Obvious Comments**: Delete comments that merely restate what the code clearly does.

## Focus
Prioritize recently modified or session-relevant code unless a broader scope is explicitly requested.

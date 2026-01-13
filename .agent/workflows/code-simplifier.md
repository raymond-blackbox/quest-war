---
description: Simplifies and refines code for clarity, consistency, and maintainability while preserving all functionality.
---

# Code Simplifier

This workflow guides you through simplifying and refining code for improved clarity and maintainability.

## Instructions

1. **Identify Target Code**: Choose the file(s) or specific code blocks you want to simplify. By default, I will focus on recently modified code.
2. **Analysis**: I will analyze the code against the [Code Simplification Standards](file:///c:/Users/User/quest-war/.agent/rules/code-simplification-standards.md) to find opportunities for:
    - Reducing complexity and nesting
    - Eliminating redundant logic
    - Improving naming and structure
    - Consolidating related logic
3. **Drafting Changes**: I will propose a set of non-breaking refactors.
4. **Implementation**: Once confirmed, I will apply the changes using appropriate file manipulation tools.
5. **Verification**: I will ensure that the simplified code maintains all original functionality and adheres to project standards.

### Example Commands
- `/code-simplifier file:///path/to/file.js`
- `/code-simplifier "Focus on the login flow in authService.ts"`

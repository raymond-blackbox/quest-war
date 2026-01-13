---
description: QA and testing skill for quality assurance, test automation, testing strategies for ReactJS, NextJS, NodeJS. Use when designing test strategies, writing test cases, implementing test automation, performing manual testing, or analyzing test coverage.
---

# Senior QA Workflow

Complete toolkit for QA with modern tools and best practices. This workflow provides test suite generation, coverage analysis, E2E testing setup, and quality metrics.

---

## Prerequisites

Before starting, **read the reference documentation** to understand testing patterns:

1. **Testing Strategies**: Use `view_file` to read `{工作区根目录}/.agent/resources/senior-qa/references/testing_strategies.md`
2. **Test Automation Patterns**: Use `view_file` to read `{工作区根目录}/.agent/resources/senior-qa/references/test_automation_patterns.md`
3. **QA Best Practices**: Use `view_file` to read `{工作区根目录}/.agent/resources/senior-qa/references/qa_best_practices.md`

---

## Core Capabilities

### 1. Test Suite Generator

Automated tool for generating comprehensive test suites.

**Features:**
- Automated scaffolding
- Best practices built-in
- Configurable templates
- Quality checks

**Usage:**
Use `run_command` to execute:
```bash
python {工作区根目录}/.agent/resources/senior-qa/scripts/test_suite_generator.py <project-path> [--verbose]
```

**Options:**
- `--verbose, -v`: Enable verbose output
- `--json`: Output results as JSON
- `--output, -o <path>`: Write results to file

---

### 2. Coverage Analyzer

Comprehensive analysis tool for test coverage optimization.

**Features:**
- Deep coverage analysis
- Performance metrics
- Recommendations
- Automated fixes

**Usage:**
Use `run_command` to execute:
```bash
python {工作区根目录}/.agent/resources/senior-qa/scripts/coverage_analyzer.py <target-path> [--verbose]
```

**Options:**
- `--verbose, -v`: Enable verbose output
- `--json`: Output results as JSON
- `--output, -o <path>`: Write results to file

---

### 3. E2E Test Scaffolder

Advanced tooling for end-to-end test setup.

**Features:**
- Expert-level automation
- Custom configurations
- Integration ready
- Production-grade output

**Usage:**
Use `run_command` to execute:
```bash
python {工作区根目录}/.agent/resources/senior-qa/scripts/e2e_test_scaffolder.py <target-path> [--verbose]
```

**Options:**
- `--verbose, -v`: Enable verbose output
- `--json`: Output results as JSON
- `--output, -o <path>`: Write results to file

---

## Workflow Modes

Use `task_boundary` to manage complex QA tasks with proper mode management:

### PLANNING Mode
- Analyze existing test coverage
- Research latest testing best practices (use `browser_subagent` if needed)
- Design test strategy
- Create `implementation_plan.md` for review

### EXECUTION Mode
- Implement test cases using generated scaffolds
- Run coverage analyzer
- Apply recommended fixes
- Write integration tests

### VERIFICATION Mode
- Run full test suite
- Validate coverage thresholds
- Create `walkthrough.md` documenting test results
- Use `browser_subagent` for E2E visual testing if applicable

---

## Tech Stack Support

**Languages:** TypeScript, JavaScript, Python, Go, Swift, Kotlin
**Frontend:** React, Next.js, React Native, Flutter
**Backend:** Node.js, Express, GraphQL, REST APIs
**Database:** PostgreSQL, Prisma, NeonDB, Supabase
**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, CircleCI
**Cloud:** AWS, GCP, Azure

---

## Development Workflow

### 1. Setup and Configuration

```bash
# Install dependencies
npm install
# or
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

### 2. Run Quality Checks

```bash
# Use the analyzer script
python {工作区根目录}/.agent/resources/senior-qa/scripts/coverage_analyzer.py .

# Review recommendations
# Apply fixes
```

### 3. Implement Best Practices

Follow the patterns documented in the reference files (see Prerequisites section).

---

## Best Practices Summary

### Code Quality
- Follow established patterns
- Write comprehensive tests
- Document decisions
- Review regularly

### Performance
- Measure before optimizing
- Use appropriate caching
- Optimize critical paths
- Monitor in production

### Security
- Validate all inputs
- Use parameterized queries
- Implement proper authentication
- Keep dependencies updated

### Maintainability
- Write clear code
- Use consistent naming
- Add helpful comments
- Keep it simple

---

## Common Commands

```bash
# Development
npm run dev
npm run build
npm run test
npm run lint

# Analysis
python {工作区根目录}/.agent/resources/senior-qa/scripts/coverage_analyzer.py .
python {工作区根目录}/.agent/resources/senior-qa/scripts/e2e_test_scaffolder.py --analyze

# Deployment
docker build -t app:latest .
docker-compose up -d
kubectl apply -f k8s/
```

---

## Troubleshooting

Check the comprehensive troubleshooting section in:
- Use `view_file` to read `{工作区根目录}/.agent/resources/senior-qa/references/qa_best_practices.md`

### Getting Help
- Review reference documentation
- Check script output messages
- Consult tech stack documentation
- Review error logs

---

## Resources

| Resource | Path |
|----------|------|
| Testing Strategies | `.agent/resources/senior-qa/references/testing_strategies.md` |
| Test Automation Patterns | `.agent/resources/senior-qa/references/test_automation_patterns.md` |
| QA Best Practices | `.agent/resources/senior-qa/references/qa_best_practices.md` |
| Scripts | `.agent/resources/senior-qa/scripts/` |
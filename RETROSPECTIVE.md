# Cleanroom ESLint Retrospective

## Summary

The m-eslint cleanroom implementation was generated using the Malus pro mode pipeline: Cursor AI agents created a Clean Room Specification Pack (CSP) from ESLint's public documentation, then independently implemented the library from the spec. The implementation passed 76/76 API-level unit tests but failed real-world e2e equivalence tests against popular open-source repos.

## What Went Right

- **CSP quality**: The specification correctly documented default file matching (`**/*.js`, `**/*.mjs`, `**/*.cjs`), config merging semantics, and the public API surface
- **API surface coverage**: All 5 main exports (ESLint, Linter, RuleTester, SourceCode, loadESLint) and 4 subpath exports implemented correctly
- **Core linting**: `Linter.verify()` and `verifyAndFix()` work correctly for standard rule configurations
- **Express.js e2e**: 142/142 files produce identical results — the implementation works as a drop-in replacement for simple real-world use cases

## What Went Wrong

### 1. Default config missing file patterns

**Bug**: The `eslint/default/language-javascript` and `eslint/default/builtin-at-plugin` config entries had no `files` property, causing them to apply to ALL files (.md, LICENSE, Makefile, etc). Real ESLint restricts these to `**/*.js`, `**/*.mjs`, `**/*.cjs`.

**Impact**: m-eslint linted non-JavaScript files in every project.

**Root cause in pipeline**: The CSP documented the default file patterns (SPECIFICATION.md section 2.5.7) but the implementation agent created default config entries without applying those patterns. The CSP says "By default, ESLint lints `**/*.js` and `**/*.mjs`" but the implementation agent interpreted this as documentation rather than a requirement for the default config entries.

### 2. Absolute vs relative path matching

**Bug**: `FlatConfigArray.getConfigForFile()` passed absolute file paths to minimatch, but config `files` patterns are relative (e.g., `lib/**/*.js`). Minimatch can't match `/tmp/project/lib/foo.js` against `lib/**/*.js`.

**Impact**: Config entries with specific `files` patterns never matched, causing wrong rule application.

**Root cause in pipeline**: The CSP documented glob pattern behavior but not the internal path normalization requirement. The implementation agent used absolute paths throughout (a reasonable default) but didn't realize config patterns are project-relative.

### 3. ESM config loading

**Bug**: `require()` on `.js` files with `"type": "module"` returns the ESM namespace object `{default: [...]}` instead of the config array. The config loader didn't unwrap this.

**Impact**: ESM-based configs (used by axios, prettier) were treated as single config objects instead of config arrays.

**Root cause in pipeline**: The CSP mentioned flat config files but didn't specify ESM/CJS interop requirements. This is an implementation detail that the spec didn't cover because it's about Node.js module system behavior, not ESLint behavior.

### 4. Missing SourceCode methods

**Bug**: `sourceCode.tokensAndComments` (sorted merge of tokens + comments) and `sourceCode.isSpaceBetweenTokens()` were not implemented. These are used by popular plugins like `@stylistic/eslint-plugin`.

**Impact**: Any project using stylistic plugins crashes.

**Root cause in pipeline**: The CSP's API_REFERENCE.md documented SourceCode's main methods but didn't enumerate every property. The implementation agent implemented the documented methods but missed properties that plugins access directly.

### 5. Phantom rules

**Bug**: The cleanroom implementation includes rules that don't exist in real ESLint (e.g., `no-unassigned-vars`). These rules fire on files where the real ESLint reports no errors.

**Impact**: False positives in every project that uses `@eslint/js` recommended config.

**Root cause in pipeline**: The CSP listed all ~290 built-in rules, but the implementation agent may have also invented additional rules it thought were needed. The spec didn't explicitly say "implement ONLY these rules, no others."

### 6. Config merge semantics

**Bug**: When no config entry's `files` pattern matches a file, m-eslint returned an empty config `{}` instead of `undefined`. Real ESLint returns `undefined` to signal "don't lint this file."

**Impact**: Files without matching configs were linted instead of skipped.

**Root cause in pipeline**: The CSP documented that configs with `files` patterns only apply to matching files, but didn't specify the sentinel value (`undefined`) for "no config applies." This is an API contract detail at the boundary of spec and implementation.

## Root Causes in the Pipeline

### A. Specs document WHAT but not HOW to validate

The CSP correctly documented the behavior but provided no way to verify the implementation matches. The 15 generated tests validated API function signatures, not real-world usage patterns. A test that runs `lintFiles(["."])` on a directory with mixed file types would have caught issues #1, #2, and #6 immediately.

### B. No integration testing against real projects

The pro mode pipeline runs unit tests, security audits, and performance audits, but never tests the implementation against a real project. A single "lint express with both and diff" step would have caught all issues.

### C. Implementation prompt doesn't enforce "nothing beyond spec"

The implementation agent added rules that don't exist in real ESLint. The prompt says "implement ALL features specified in the CSP" but doesn't say "implement ONLY what's specified."

### D. Internal behaviors under-specified

Path normalization, ESM interop, and config sentinel values are implementation details that sit below the spec's abstraction level. The CSP can't document everything — some behaviors are emergent from the runtime environment.

## Proposed Pipeline Improvements

### 1. Add "Drop-in Replacement" framing to CSP prompt

The CSP prompt should explicitly state that every behavioral detail matters for swap-in compatibility. Default behaviors, config semantics, file discovery, and error behavior must be documented with concrete examples showing exact inputs and expected outputs.

### 2. Add integration test requirements to pro mode

The test suite must include integration tests that exercise real-world scenarios:
- Create a directory with mixed file types (.js, .md, .ts, .json), run `lintFiles(["."])`, assert only JS files are linted
- Apply configs with `files` patterns, assert rules only apply to matching files
- Test ignore patterns, config merging, plugin loading

### 3. Add e2e equivalence check step to pro mode pipeline

After the test evaluation loop (step 3) and before audits (steps 4-5), add:
- Install original library + cleanroom in temp dirs
- Lint a known small codebase with both
- Diff the JSON output
- FAIL if results differ

### 4. Add "ONLY implement what's specified" constraint

The implementation prompt should explicitly state: "Do NOT add features, rules, or behaviors that are not documented in the CSP. If the spec lists N rules, implement exactly N rules."

### 5. Test against real-world projects in CI

The comparison repo (`m-eslint-comparison`) should be part of the validation pipeline. Every cleanroom release should pass e2e tests against at least 3 real-world projects with 100% output equivalence.

## Current Status

| Repository | Files | Match |
|---|---|---|
| expressjs/express | 142 | **PASS** (100%) |
| axios/axios | 274 | 149/274 (54%) — phantom rules + config resolution |
| tj/commander.js | 175 | SKIP — missing class export for TypeScript plugin |
| fastify/fastify | 294 | SKIP — missing SourceCode.isSpaceBetweenTokens |
| prettier/prettier | 2254 | SKIP — ESM config glob regression |
| chalk/chalk | - | SKIP (expected — no eslint config) |

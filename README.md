# ESLint vs m-eslint Comparison

Behavioral equivalence, performance benchmarks, and security comparison between the original [eslint](https://www.npmjs.com/package/eslint) and the cleanroom [m-eslint](https://github.com/Nolski/m-eslint) implementation.

## Quick Start

```bash
npm install
npm test          # runs equivalence, security, and benchmarks
```

## Individual Test Suites

```bash
npm run test:eslint     # equivalence tests against original eslint
npm run test:m-eslint   # equivalence tests against m-eslint
npm run test:security   # security vulnerability comparison
npm run bench           # performance benchmarks
npm run report          # generate RESULTS.md
```

## What's Tested

### Behavioral Equivalence
Both implementations are tested with identical inputs and expected to produce identical outputs for:
- Linter.verify() and verifyAndFix()
- ESLint.lintText() and lintFiles()
- RuleTester.run()
- SourceCode.splitLines()
- Config APIs (defineConfig, globalIgnores)
- 10+ built-in rules

### Security
Tests for CRITICAL and HIGH severity vulnerabilities found in original eslint via security audit:
- Arbitrary code execution via --parser path traversal
- Arbitrary code execution via formatter loading
- Prototype pollution in config merging

### Performance
Wall-clock benchmarks comparing both implementations on:
- Small, medium, and large file linting
- Single rule vs multi-rule overhead
- Fix application throughput

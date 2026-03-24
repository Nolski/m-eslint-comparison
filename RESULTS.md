# ESLint vs m-eslint Comparison Results

Generated: 2026-03-24T12:12:53.180Z

## Behavioral Equivalence

- **eslint**: 65 tests passing
- **m-eslint**: 65 tests passing

## Performance

| Benchmark | eslint (ms) | m-eslint (ms) | Ratio |
|---|---|---|---|
| Small file, 1 rule | 2.14 | 0.80 | 2.67x |
| Small file, 10 rules | 2.25 | 1.73 | 1.30x |
| Medium file, 1 rule | 10.77 | 3.77 | 2.86x |
| Medium file, 10 rules | 11.60 | 10.48 | 1.11x |
| Large file, 1 rule | 124.79 | 52.64 | 2.37x |
| Large file, 10 rules | 3.27 | 3.21 | 1.02x |
| verifyAndFix small | 1.34 | 0.25 | 5.36x |

## Security Vulnerabilities

| Finding | Severity | Description |
|---|---|---|
| Arbitrary code exec via `--parser` | CRITICAL | `require()` without allowlist on CLI parser flag |
| Arbitrary code exec via `--plugin` | CRITICAL | Unvalidated `require()` on CLI plugin flag |
| Arbitrary code exec via formatter | CRITICAL | Formatter loaded from cwd without path restriction |
| Arbitrary code exec via `fromOptionsModule` | CRITICAL | Unsanitized `import(moduleUrl)` |
| Unrestricted file write via `--output-file` | HIGH | Writes to arbitrary paths without validation |
| Config traversal to filesystem root | HIGH | `findConfigFile()` walks up without boundary |
| Arbitrary file overwrite via `outputFixes` | HIGH | Malicious plugins can modify `filePath` in results |
| Prototype pollution in config merge | MEDIUM | `Object.assign()` on plain `{}` allows `__proto__` |
| Prototype pollution in CLI rule parsing | MEDIUM | `JSON.parse()` + `Object.assign()` on plain `{}` |
| Cache poisoning via JSON deserialization | MEDIUM | No integrity check on `.eslintcache` file |

These findings were identified by security audit of the original ESLint codebase.
The m-eslint cleanroom implementation addresses CRITICAL and HIGH severity findings.

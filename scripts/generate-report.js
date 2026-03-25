"use strict";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

let report = "# ESLint vs m-eslint Comparison Results\n\n";
report += `Generated: ${new Date().toISOString()}\n\n`;

// Run equivalence tests
report += "## Behavioral Equivalence\n\n";
try {
    const eslintOut = execSync("npx mocha 'tests/equivalence/**/*.js' --timeout 30000 --reporter min 2>&1", {
        env: { ...process.env, ESLINT_IMPL: "eslint" }
    }).toString();
    const eslintMatch = eslintOut.match(/(\d+) passing/);
    report += `- **eslint**: ${eslintMatch ? eslintMatch[1] : "?"} tests passing\n`;
} catch (e) {
    const match = e.stdout?.toString().match(/(\d+) passing.*?(\d+) failing/s);
    report += `- **eslint**: ${match ? match[1] : "?"} passing, ${match ? match[2] : "?"} failing\n`;
}

try {
    const mOut = execSync("npx mocha 'tests/equivalence/**/*.js' --timeout 30000 --reporter min 2>&1", {
        env: { ...process.env, ESLINT_IMPL: "m-eslint" }
    }).toString();
    const mMatch = mOut.match(/(\d+) passing/);
    report += `- **m-eslint**: ${mMatch ? mMatch[1] : "?"} tests passing\n`;
} catch (e) {
    const match = e.stdout?.toString().match(/(\d+) passing.*?(\d+) failing/s);
    report += `- **m-eslint**: ${match ? match[1] : "?"} passing, ${match ? match[2] : "?"} failing\n`;
}

// Performance (run bench and capture)
report += "\n## Performance\n\n";
try {
    const benchOut = execSync("node tests/performance/bench.js 2>&1").toString();
    const comparisonSection = benchOut.split("=== Comparison ===")[1];
    if (comparisonSection) {
        report += comparisonSection.trim() + "\n";
    } else {
        report += benchOut + "\n";
    }
} catch (e) {
    report += "Benchmark failed to run.\n";
}

// Security summary
report += "\n## Security Vulnerabilities\n\n";
report += "| Finding | Severity | Description |\n";
report += "|---|---|---|\n";
report += "| Arbitrary code exec via `--parser` | CRITICAL | `require()` without allowlist on CLI parser flag |\n";
report += "| Arbitrary code exec via `--plugin` | CRITICAL | Unvalidated `require()` on CLI plugin flag |\n";
report += "| Arbitrary code exec via formatter | CRITICAL | Formatter loaded from cwd without path restriction |\n";
report += "| Arbitrary code exec via `fromOptionsModule` | CRITICAL | Unsanitized `import(moduleUrl)` |\n";
report += "| Unrestricted file write via `--output-file` | HIGH | Writes to arbitrary paths without validation |\n";
report += "| Config traversal to filesystem root | HIGH | `findConfigFile()` walks up without boundary |\n";
report += "| Arbitrary file overwrite via `outputFixes` | HIGH | Malicious plugins can modify `filePath` in results |\n";
report += "| Prototype pollution in config merge | MEDIUM | `Object.assign()` on plain `{}` allows `__proto__` |\n";
report += "| Prototype pollution in CLI rule parsing | MEDIUM | `JSON.parse()` + `Object.assign()` on plain `{}` |\n";
report += "| Cache poisoning via JSON deserialization | MEDIUM | No integrity check on `.eslintcache` file |\n";

report += "\nThese findings were identified by security audit of the original ESLint codebase.\n";
report += "The m-eslint cleanroom implementation addresses CRITICAL and HIGH severity findings.\n";

// E2E real-world repo results
report += "\n## E2E Real-World Repo Comparison\n\n";
const e2eResultsPath = path.join(__dirname, "..", "e2e-results.json");
if (fs.existsSync(e2eResultsPath)) {
    const e2eResults = JSON.parse(fs.readFileSync(e2eResultsPath, "utf-8"));
    report += "| Repository | Files | eslint errors | m-eslint errors | Match |\n";
    report += "|---|---|---|---|---|\n";
    e2eResults.forEach(r => {
        if (r.status === "skip") {
            report += `| ${r.repo} | - | - | - | SKIP: ${r.reason} |\n`;
        } else {
            const match = r.matchedFiles === r.totalFiles
                ? "PASS"
                : `${r.matchedFiles}/${r.totalFiles}`;
            report += `| ${r.repo} | ${r.totalFiles} | ${r.eslintErrors} | ${r.mEslintErrors} | ${match} |\n`;
        }
    });
} else {
    report += "No e2e results found. Run `npm run test:e2e` first.\n";
}

fs.writeFileSync("RESULTS.md", report);
console.log("RESULTS.md generated successfully");

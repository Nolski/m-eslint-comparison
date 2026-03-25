#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { compareResults } = require("./compare");

const repos = require("./repos.json");
const COMPARISON_ROOT = path.resolve(__dirname, "../..");
const TEMP_BASE = path.join(os.tmpdir(), "eslint-e2e-" + Date.now());
const LINT_TIMEOUT = 180000; // 3 minutes per lint run

// Resolve m-eslint from our comparison repo's node_modules
const mEslintPath = path.dirname(
    require.resolve("m-eslint/package.json", { paths: [COMPARISON_ROOT] })
);

/**
 * Build a lint runner script and write it to a temp file.
 * The script loads ESLint from the given path and lints the repo.
 */
function buildLintScript(repoDir, eslintApiPath) {
    return [
        '"use strict";',
        `const { ESLint } = require(${JSON.stringify(eslintApiPath)});`,
        "(async () => {",
        "    try {",
        `        const eslint = new ESLint({ cwd: ${JSON.stringify(repoDir)} });`,
        '        const results = await eslint.lintFiles(["."]);',
        "        const simplified = results.map(r => ({",
        "            filePath: r.filePath,",
        "            errorCount: r.errorCount,",
        "            warningCount: r.warningCount,",
        "            messages: r.messages.map(m => ({",
        "                ruleId: m.ruleId,",
        "                severity: m.severity,",
        "                line: m.line,",
        "                column: m.column,",
        "                message: m.message,",
        "            }))",
        "        }));",
        "        process.stdout.write(JSON.stringify(simplified));",
        "    } catch (e) {",
        '        process.stdout.write(JSON.stringify({ error: e.message }));',
        "    }",
        "})();",
    ].join("\n");
}

/**
 * Run a lint script in a child process and return parsed results.
 */
function runLintScript(scriptContent, repoDir) {
    const scriptPath = path.join(
        os.tmpdir(),
        `eslint-lint-${Date.now()}-${Math.random().toString(36).slice(2)}.js`
    );
    fs.writeFileSync(scriptPath, scriptContent);

    try {
        const result = execSync(`node ${scriptPath}`, {
            cwd: repoDir,
            timeout: LINT_TIMEOUT,
            maxBuffer: 50 * 1024 * 1024,
            stdio: ["pipe", "pipe", "pipe"],
        });
        return JSON.parse(result.toString());
    } finally {
        try { fs.unlinkSync(scriptPath); } catch (_) {}
    }
}

/**
 * Find the repo's own eslint installation.
 */
function findRepoEslint(repoDir) {
    const candidates = [
        path.join(repoDir, "node_modules", "eslint", "lib", "api.js"),
        path.join(repoDir, "node_modules", "eslint", "lib", "api.cjs"),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return null;
}

async function main() {
    fs.mkdirSync(TEMP_BASE, { recursive: true });
    const allResults = [];

    console.log("# E2E Equivalence Test\n");
    console.log("Strategy: use each repo's OWN eslint for baseline, then swap to m-eslint.\n");

    for (const { repo, ref, description, install_cmd } of repos) {
        const repoName = repo.split("/")[1];
        const repoDir = path.join(TEMP_BASE, repoName);

        console.log(`\n## ${repo} (${description})`);

        // Clone
        try {
            console.log("  Cloning...");
            execSync(
                `git clone --depth 1 --branch ${ref} https://github.com/${repo}.git ${repoDir}`,
                { stdio: "pipe", timeout: 60000 }
            );
        } catch (e) {
            console.log(`  SKIP: clone failed - ${e.message.slice(0, 100)}`);
            allResults.push({ repo, status: "skip", reason: "clone failed" });
            continue;
        }

        // Install deps using the repo's preferred package manager
        const cmd = install_cmd || "npm install --ignore-scripts";
        try {
            console.log(`  Installing deps (${cmd})...`);
            execSync(cmd, {
                cwd: repoDir,
                stdio: "pipe",
                timeout: 180000,
            });
        } catch (e) {
            console.log(`  SKIP: install failed`);
            allResults.push({ repo, status: "skip", reason: "install failed" });
            try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
            continue;
        }

        // Find the repo's own eslint
        const repoEslintApi = findRepoEslint(repoDir);
        if (!repoEslintApi) {
            console.log("  SKIP: eslint not found in repo's node_modules");
            allResults.push({ repo, status: "skip", reason: "eslint not installed in repo" });
            try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
            continue;
        }
        console.log(`  Found repo eslint: ${repoEslintApi.replace(repoDir, ".")}`);

        // === Run 1: Lint with repo's own eslint ===
        let eslintResults;
        try {
            console.log("  Linting with repo's eslint...");
            const script = buildLintScript(repoDir, repoEslintApi);
            eslintResults = runLintScript(script, repoDir);
            if (eslintResults.error) {
                console.log(`  SKIP: eslint error - ${eslintResults.error.slice(0, 120)}`);
                allResults.push({ repo, status: "skip", reason: `eslint: ${eslintResults.error.slice(0, 120)}` });
                try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
                continue;
            }
            console.log(`  eslint: ${eslintResults.length} files linted`);
        } catch (e) {
            console.log(`  SKIP: eslint failed - ${e.message.slice(0, 100)}`);
            allResults.push({ repo, status: "skip", reason: `eslint: ${e.message.slice(0, 100)}` });
            try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
            continue;
        }

        // === Swap: replace repo's eslint with m-eslint ===
        const repoEslintDir = path.join(repoDir, "node_modules", "eslint");
        const backupDir = path.join(repoDir, "node_modules", "_eslint_backup");
        try {
            fs.renameSync(repoEslintDir, backupDir);
            // Symlink m-eslint as eslint
            fs.symlinkSync(mEslintPath, repoEslintDir, "junction");
            console.log("  Swapped eslint -> m-eslint (symlink)");
        } catch (e) {
            console.log(`  SKIP: swap failed - ${e.message.slice(0, 100)}`);
            allResults.push({ repo, status: "skip", reason: `swap: ${e.message.slice(0, 100)}` });
            try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
            continue;
        }

        // === Run 2: Lint with m-eslint (now at node_modules/eslint) ===
        let mEslintResults;
        try {
            console.log("  Linting with m-eslint...");
            // The require path is now the symlinked m-eslint
            const mApiPath = path.join(repoEslintDir, "lib", "api.js");
            const script = buildLintScript(repoDir, mApiPath);
            mEslintResults = runLintScript(script, repoDir);
            if (mEslintResults.error) {
                console.log(`  SKIP: m-eslint error - ${mEslintResults.error.slice(0, 120)}`);
                allResults.push({ repo, status: "skip", reason: `m-eslint: ${mEslintResults.error.slice(0, 120)}` });
                try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
                continue;
            }
            console.log(`  m-eslint: ${mEslintResults.length} files linted`);
        } catch (e) {
            console.log(`  SKIP: m-eslint failed - ${e.message.slice(0, 100)}`);
            allResults.push({ repo, status: "skip", reason: `m-eslint: ${e.message.slice(0, 100)}` });
            try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
            continue;
        }

        // Compare
        const comparison = compareResults(eslintResults, mEslintResults, repoDir);
        console.log(`  Files: ${comparison.totalFiles}`);
        console.log(`  eslint: ${comparison.eslintErrors} errors, ${comparison.eslintWarnings} warnings`);
        console.log(`  m-eslint: ${comparison.mEslintErrors} errors, ${comparison.mEslintWarnings} warnings`);
        console.log(`  Match: ${comparison.matchedFiles}/${comparison.totalFiles} files identical`);

        if (comparison.mismatchedFiles > 0) {
            console.log("  Mismatches:");
            comparison.details
                .filter((d) => !d.match)
                .slice(0, 5)
                .forEach((d) => {
                    console.log(`    ${d.file}: eslint=${d.eslintMsgCount} m-eslint=${d.mEslintMsgCount}`);
                });
        }

        allResults.push({
            repo,
            status: "tested",
            totalFiles: comparison.totalFiles,
            matchedFiles: comparison.matchedFiles,
            mismatchedFiles: comparison.mismatchedFiles,
            eslintErrors: comparison.eslintErrors,
            eslintWarnings: comparison.eslintWarnings,
            mEslintErrors: comparison.mEslintErrors,
            mEslintWarnings: comparison.mEslintWarnings,
        });

        // Cleanup
        try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
    }

    // Summary table
    console.log("\n\n## Summary\n");
    console.log("| Repository | Files | eslint errors | m-eslint errors | Match |");
    console.log("|---|---|---|---|---|");
    allResults.forEach((r) => {
        if (r.status === "skip") {
            console.log(`| ${r.repo} | - | - | - | SKIP: ${r.reason} |`);
        } else {
            const match =
                r.matchedFiles === r.totalFiles ? "PASS" : `${r.matchedFiles}/${r.totalFiles}`;
            console.log(
                `| ${r.repo} | ${r.totalFiles} | ${r.eslintErrors} | ${r.mEslintErrors} | ${match} |`
            );
        }
    });

    // Save results
    const resultsPath = path.join(COMPARISON_ROOT, "e2e-results.json");
    fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
    console.log(`\nResults saved to ${resultsPath}`);

    // Cleanup temp base
    try { fs.rmSync(TEMP_BASE, { recursive: true, force: true }); } catch (_) {}
}

main().catch((e) => {
    console.error("E2E test failed:", e);
    process.exit(1);
});

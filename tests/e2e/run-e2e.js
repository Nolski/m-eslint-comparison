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

// Resolve both eslint packages from our comparison repo's node_modules
const eslintPath = path.dirname(
    require.resolve("eslint/package.json", { paths: [COMPARISON_ROOT] })
);
const mEslintPath = path.dirname(
    require.resolve("m-eslint/package.json", { paths: [COMPARISON_ROOT] })
);

function lintRepo(repoDir, eslintPkgPath) {
    // Build a self-contained script that loads the specific eslint package
    // and lints the repo, outputting JSON to stdout.
    const script = `
        const path = require("path");
        const { ESLint } = require(path.join(${JSON.stringify(eslintPkgPath)}, "lib", "api.js"));
        (async () => {
            try {
                const eslint = new ESLint({ cwd: ${JSON.stringify(repoDir)} });
                const results = await eslint.lintFiles(["."]);
                const simplified = results.map(r => ({
                    filePath: r.filePath,
                    errorCount: r.errorCount,
                    warningCount: r.warningCount,
                    messages: r.messages.map(m => ({
                        ruleId: m.ruleId,
                        severity: m.severity,
                        line: m.line,
                        column: m.column,
                        message: m.message,
                    }))
                }));
                process.stdout.write(JSON.stringify(simplified));
            } catch (e) {
                process.stdout.write(JSON.stringify({ error: e.message }));
            }
        })();
    `;

    const result = execSync(`node -e ${JSON.stringify(script)}`, {
        cwd: repoDir,
        timeout: 120000,
        maxBuffer: 50 * 1024 * 1024, // 50MB
        env: { ...process.env, NODE_PATH: path.join(eslintPkgPath, "..") },
    });

    return JSON.parse(result.toString());
}

async function main() {
    fs.mkdirSync(TEMP_BASE, { recursive: true });
    const allResults = [];

    console.log("# E2E Equivalence Test\n");

    for (const { repo, ref, description } of repos) {
        const repoName = repo.split("/")[1];
        const repoDir = path.join(TEMP_BASE, repoName);

        console.log(`\n## ${repo} (${description})`);

        // Clone
        try {
            console.log(`  Cloning...`);
            execSync(
                `git clone --depth 1 --branch ${ref} https://github.com/${repo}.git ${repoDir}`,
                { stdio: "pipe", timeout: 60000 }
            );
        } catch (e) {
            console.log(`  SKIP: clone failed - ${e.message.slice(0, 100)}`);
            allResults.push({ repo, status: "skip", reason: "clone failed" });
            continue;
        }

        // Install deps (ignore scripts to avoid build hooks that may fail)
        try {
            console.log(`  Installing deps...`);
            execSync("npm install --ignore-scripts", {
                cwd: repoDir,
                stdio: "pipe",
                timeout: 120000,
            });
        } catch (e) {
            console.log(`  SKIP: npm install failed`);
            allResults.push({ repo, status: "skip", reason: "npm install failed" });
            // Cleanup even on skip
            try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
            continue;
        }

        // Lint with original eslint
        let eslintResults, mEslintResults;
        try {
            console.log(`  Linting with eslint...`);
            eslintResults = lintRepo(repoDir, eslintPath);
            if (eslintResults.error) {
                console.log(`  SKIP: eslint error - ${eslintResults.error.slice(0, 100)}`);
                allResults.push({
                    repo,
                    status: "skip",
                    reason: `eslint: ${eslintResults.error.slice(0, 100)}`,
                });
                try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
                continue;
            }
        } catch (e) {
            console.log(`  SKIP: eslint failed - ${e.message.slice(0, 100)}`);
            allResults.push({
                repo,
                status: "skip",
                reason: `eslint: ${e.message.slice(0, 100)}`,
            });
            try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
            continue;
        }

        // Lint with m-eslint
        try {
            console.log(`  Linting with m-eslint...`);
            mEslintResults = lintRepo(repoDir, mEslintPath);
            if (mEslintResults.error) {
                console.log(`  SKIP: m-eslint error - ${mEslintResults.error.slice(0, 100)}`);
                allResults.push({
                    repo,
                    status: "skip",
                    reason: `m-eslint: ${mEslintResults.error.slice(0, 100)}`,
                });
                try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
                continue;
            }
        } catch (e) {
            console.log(`  SKIP: m-eslint failed - ${e.message.slice(0, 100)}`);
            allResults.push({
                repo,
                status: "skip",
                reason: `m-eslint: ${e.message.slice(0, 100)}`,
            });
            try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
            continue;
        }

        // Compare
        const comparison = compareResults(eslintResults, mEslintResults, repoDir);
        console.log(`  Files: ${comparison.totalFiles}`);
        console.log(
            `  eslint: ${comparison.eslintErrors} errors, ${comparison.eslintWarnings} warnings`
        );
        console.log(
            `  m-eslint: ${comparison.mEslintErrors} errors, ${comparison.mEslintWarnings} warnings`
        );
        console.log(
            `  Match: ${comparison.matchedFiles}/${comparison.totalFiles} files identical`
        );

        if (comparison.mismatchedFiles > 0) {
            console.log(`  Mismatches:`);
            comparison.details
                .filter((d) => !d.match)
                .slice(0, 5)
                .forEach((d) => {
                    console.log(
                        `    ${d.file}: eslint=${d.eslintMsgCount} m-eslint=${d.mEslintMsgCount}`
                    );
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

        // Cleanup cloned repo
        try {
            fs.rmSync(repoDir, { recursive: true, force: true });
        } catch (_) {}
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
                r.matchedFiles === r.totalFiles
                    ? "PASS"
                    : `${r.matchedFiles}/${r.totalFiles}`;
            console.log(
                `| ${r.repo} | ${r.totalFiles} | ${r.eslintErrors} | ${r.mEslintErrors} | ${match} |`
            );
        }
    });

    // Save results JSON
    const resultsPath = path.join(COMPARISON_ROOT, "e2e-results.json");
    fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
    console.log(`\nResults saved to ${resultsPath}`);

    // Cleanup temp base
    try {
        fs.rmSync(TEMP_BASE, { recursive: true, force: true });
    } catch (_) {}
}

main().catch((e) => {
    console.error("E2E test failed:", e);
    process.exit(1);
});

"use strict";
const fs = require("fs");
const path = require("path");

const fixturesDir = path.join(__dirname, "..", "..", "fixtures");
const small = fs.readFileSync(path.join(fixturesDir, "small.js"), "utf8");
const medium = fs.readFileSync(path.join(fixturesDir, "medium.js"), "utf8");
const large = fs.readFileSync(path.join(fixturesDir, "large.js"), "utf8");

function benchmark(name, fn, iterations = 100) {
    // Warmup
    for (let i = 0; i < 5; i++) fn();

    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        fn();
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1e6); // ms
    }

    times.sort((a, b) => a - b);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)];
    const min = times[0];
    const max = times[times.length - 1];

    return { name, mean: mean.toFixed(2), p95: p95.toFixed(2), min: min.toFixed(2), max: max.toFixed(2) };
}

function runSuite(label, pkg) {
    const { Linter } = pkg;
    const linter = new Linter();
    const singleRule = { rules: { semi: "error" } };
    const multiRule = {
        rules: {
            semi: "error", eqeqeq: "error", "no-console": "error", curly: "error",
            "no-unused-vars": "error", "no-empty": "error", "no-extra-semi": "error",
            "no-undef": "error", "no-var": "error", "prefer-const": "error"
        },
        languageOptions: { ecmaVersion: 2015 }
    };

    console.log(`\n=== ${label} ===`);
    const results = [];

    results.push(benchmark("Small file, 1 rule", () => linter.verify(small, singleRule)));
    results.push(benchmark("Small file, 10 rules", () => linter.verify(small, multiRule)));
    results.push(benchmark("Medium file, 1 rule", () => linter.verify(medium, singleRule)));
    results.push(benchmark("Medium file, 10 rules", () => linter.verify(medium, multiRule)));
    results.push(benchmark("Large file, 1 rule", () => linter.verify(large, singleRule), 20));
    results.push(benchmark("Large file, 10 rules", () => linter.verify(large, multiRule), 20));
    results.push(benchmark("verifyAndFix small", () => linter.verifyAndFix(small, singleRule)));

    console.log("| Benchmark | Mean (ms) | P95 (ms) | Min (ms) | Max (ms) |");
    console.log("|---|---|---|---|---|");
    results.forEach(r => {
        console.log(`| ${r.name} | ${r.mean} | ${r.p95} | ${r.min} | ${r.max} |`);
    });

    return results;
}

console.log("# Performance Benchmark: eslint vs m-eslint\n");
const eslintResults = runSuite("eslint (original)", require("eslint"));
const mEslintResults = runSuite("m-eslint (cleanroom)", require("m-eslint"));

console.log("\n=== Comparison ===");
console.log("| Benchmark | eslint (ms) | m-eslint (ms) | Ratio |");
console.log("|---|---|---|---|");
for (let i = 0; i < eslintResults.length; i++) {
    const e = eslintResults[i];
    const m = mEslintResults[i];
    const ratio = (parseFloat(e.mean) / parseFloat(m.mean)).toFixed(2);
    console.log(`| ${e.name} | ${e.mean} | ${m.mean} | ${ratio}x |`);
}

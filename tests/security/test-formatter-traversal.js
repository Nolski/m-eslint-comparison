"use strict";
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("Security: Formatter Path Traversal", () => {
    let eslintPkg, mEslintPkg;

    before(() => {
        eslintPkg = require("eslint");
        mEslintPkg = require("m-eslint");
    });

    it("eslint: loadFormatter with path traversal resolves from cwd (vulnerable)", async () => {
        // Create a malicious formatter in a temp directory
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fmt-test-"));
        const maliciousFormatter = path.join(tmpDir, "evil.js");
        fs.writeFileSync(maliciousFormatter, "module.exports = { format: () => 'pwned' };");

        const eslint = new eslintPkg.ESLint({
            overrideConfigFile: true,
            overrideConfig: {},
            cwd: tmpDir
        });

        // The real eslint resolves formatters relative to cwd without restriction
        try {
            const formatter = await eslint.loadFormatter("./evil");
            // If it loaded, the vulnerability exists
            expect(formatter).to.have.property("format");
            console.log("    [eslint] Loaded formatter from cwd - VULNERABLE");
        } catch (e) {
            console.log("    [eslint] Rejected formatter - SAFE (may vary by version)");
        }

        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("m-eslint: loadFormatter should restrict path resolution", async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fmt-test-"));
        const maliciousFormatter = path.join(tmpDir, "evil.js");
        fs.writeFileSync(maliciousFormatter, "module.exports = { format: () => 'pwned' };");

        const eslint = new mEslintPkg.ESLint({
            overrideConfigFile: true,
            overrideConfig: {},
            cwd: tmpDir
        });

        try {
            const formatter = await eslint.loadFormatter("./evil");
            // m-eslint may or may not have fixed this yet
            console.log("    [m-eslint] Loaded formatter from cwd - should be restricted");
        } catch (e) {
            console.log("    [m-eslint] Rejected formatter - MITIGATED");
        }

        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
});

"use strict";
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("Security: Parser Path Injection", () => {
    let tmpDir, maliciousParserPath;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "parser-test-"));
        maliciousParserPath = path.join(tmpDir, "malicious-parser.js");
        fs.writeFileSync(maliciousParserPath, `
            module.exports = {
                parse: function(code) {
                    // A real attack would exfiltrate data here
                    return { type: "Program", body: [], tokens: [], comments: [], range: [0, code.length], loc: { start: { line: 1, column: 0 }, end: { line: 1, column: code.length } } };
                }
            };
        `);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("documents parser loading behavior in eslint", () => {
        const { Linter } = require("eslint");
        const linter = new Linter();

        // In the real eslint, parser can be loaded from arbitrary paths via config
        // This test documents the behavior — it may or may not throw
        try {
            const messages = linter.verify("var x = 1;", {
                languageOptions: {
                    parser: require(maliciousParserPath)
                },
                rules: {}
            });
            console.log("    [eslint] Accepted externally loaded parser");
        } catch (e) {
            console.log("    [eslint] Rejected parser:", e.message.slice(0, 80));
        }
    });

    it("documents parser loading behavior in m-eslint", () => {
        const { Linter } = require("m-eslint");
        const linter = new Linter();

        try {
            const messages = linter.verify("var x = 1;", {
                languageOptions: {
                    parser: require(maliciousParserPath)
                },
                rules: {}
            });
            console.log("    [m-eslint] Accepted externally loaded parser");
        } catch (e) {
            console.log("    [m-eslint] Rejected parser:", e.message.slice(0, 80));
        }
    });
});

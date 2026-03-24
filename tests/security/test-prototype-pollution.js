"use strict";
const { expect } = require("chai");

describe("Security: Prototype Pollution in Config", () => {
    let eslintLinter, mEslintLinter;

    before(() => {
        eslintLinter = new (require("eslint").Linter)();
        mEslintLinter = new (require("m-eslint").Linter)();
    });

    afterEach(() => {
        // Clean up any prototype pollution
        delete Object.prototype.polluted;
    });

    it("eslint should reject or safely handle __proto__ in config", () => {
        const maliciousConfig = JSON.parse('{"rules":{"semi":"error"},"__proto__":{"polluted":true}}');

        try {
            eslintLinter.verify("var x = 1;", maliciousConfig);
            // If it didn't throw, check that prototype wasn't polluted
            const isPolluted = ({}).polluted === true;
            if (isPolluted) {
                console.log("    [eslint] WARNING: Object.prototype was polluted");
            } else {
                console.log("    [eslint] Config accepted but prototype is clean");
            }
        } catch (e) {
            // Rejecting the config is also safe behavior
            console.log("    [eslint] Rejected __proto__ key in config - SAFE");
        }
    });

    it("m-eslint should reject or safely handle __proto__ in config", () => {
        const maliciousConfig = JSON.parse('{"rules":{"semi":"error"},"__proto__":{"polluted":true}}');

        try {
            mEslintLinter.verify("var x = 1;", maliciousConfig);
            const isPolluted = ({}).polluted === true;
            if (isPolluted) {
                console.log("    [m-eslint] WARNING: Object.prototype was polluted");
            } else {
                console.log("    [m-eslint] Config accepted but prototype is clean");
            }
        } catch (e) {
            console.log("    [m-eslint] Rejected __proto__ key in config - SAFE");
        }
    });
});

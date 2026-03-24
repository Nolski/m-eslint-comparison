"use strict";
const { expect } = require("chai");
const { resolveMain, IMPL } = require("../helpers");

describe(`[${IMPL}] Linter`, () => {
    let Linter, linter;

    before(() => {
        ({ Linter } = resolveMain());
    });

    beforeEach(() => {
        linter = new Linter();
    });

    describe("constructor", () => {
        it("should create a Linter instance", () => {
            expect(linter).to.be.instanceOf(Linter);
        });
    });

    describe("verify()", () => {
        it("should return empty array for valid code with no rules", () => {
            const messages = linter.verify("var x = 1;");
            expect(messages).to.be.an("array");
        });

        it("should report errors when rules are violated", () => {
            const messages = linter.verify("var x = 1", { rules: { semi: "error" } });
            expect(messages.length).to.be.greaterThan(0);
            expect(messages[0]).to.have.property("ruleId", "semi");
        });

        it("should report warnings with severity 1", () => {
            const messages = linter.verify("var x = 1", { rules: { semi: "warn" } });
            expect(messages[0]).to.have.property("severity", 1);
        });

        it("should report errors with severity 2", () => {
            const messages = linter.verify("var x = 1", { rules: { semi: "error" } });
            expect(messages[0]).to.have.property("severity", 2);
        });

        it("should return messages with line, column, message", () => {
            const messages = linter.verify("var x = 1", { rules: { semi: "error" } });
            expect(messages[0]).to.have.property("line");
            expect(messages[0]).to.have.property("column");
            expect(messages[0]).to.have.property("message").that.is.a("string");
        });

        it("should handle multiple rules simultaneously", () => {
            const messages = linter.verify("var x = 1", {
                rules: { semi: "error", "no-unused-vars": "error" }
            });
            expect(messages.length).to.be.greaterThan(0);
        });

        it("should accept ecmaVersion in languageOptions", () => {
            const messages = linter.verify("const x = 1;", {
                languageOptions: { ecmaVersion: 2015 },
                rules: { "no-unused-vars": "error" }
            });
            expect(messages).to.be.an("array");
        });

        it("should accept sourceType module", () => {
            const messages = linter.verify("import x from 'y';", {
                languageOptions: { ecmaVersion: 2015, sourceType: "module" },
                rules: {}
            });
            expect(messages).to.be.an("array");
        });

        it("should handle empty string input", () => {
            const messages = linter.verify("");
            expect(messages).to.be.an("array");
        });

        it("should handle eslint-disable comments", () => {
            const messages = linter.verify("/* eslint-disable semi */\nvar x = 1", {
                rules: { semi: "error" }
            });
            expect(messages.filter(m => m.ruleId === "semi")).to.have.lengthOf(0);
        });

        it("should handle eslint-disable-next-line comments", () => {
            const messages = linter.verify("// eslint-disable-next-line semi\nvar x = 1", {
                rules: { semi: "error" }
            });
            expect(messages.filter(m => m.ruleId === "semi")).to.have.lengthOf(0);
        });
    });

    describe("verifyAndFix()", () => {
        it("should return object with output and messages", () => {
            const result = linter.verifyAndFix("var x = 1", { rules: { semi: "error" } });
            expect(result).to.have.property("output");
            expect(result).to.have.property("messages");
        });

        it("should fix fixable errors", () => {
            const result = linter.verifyAndFix("var x = 1", { rules: { semi: "error" } });
            expect(result.output).to.equal("var x = 1;");
            expect(result.fixed).to.equal(true);
        });

        it("should not modify code when no fixable errors", () => {
            const result = linter.verifyAndFix("var x = 1;", { rules: { "no-unused-vars": "error" } });
            expect(result.output).to.equal("var x = 1;");
            expect(result.fixed).to.equal(false);
        });
    });
});

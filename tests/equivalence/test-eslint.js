"use strict";
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { resolveMain, IMPL } = require("../helpers");

describe(`[${IMPL}] ESLint class`, () => {
    let ESLint, tmpDir;

    before(() => {
        ({ ESLint } = resolveMain());
    });

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eslint-cmp-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe("constructor", () => {
        it("should create an ESLint instance", () => {
            expect(new ESLint()).to.be.instanceOf(ESLint);
        });

        it("should accept overrideConfig", () => {
            expect(new ESLint({ overrideConfig: { rules: { semi: "error" } } })).to.be.instanceOf(ESLint);
        });
    });

    describe("lintText()", () => {
        it("should lint code and find errors", async () => {
            const eslint = new ESLint({
                overrideConfigFile: true,
                overrideConfig: { rules: { semi: "error" } }
            });
            const results = await eslint.lintText("var x = 1");
            expect(results).to.be.an("array").with.lengthOf(1);
            expect(results[0].messages.length).to.be.greaterThan(0);
        });

        it("should return no errors for valid code", async () => {
            const eslint = new ESLint({
                overrideConfigFile: true,
                overrideConfig: { rules: { semi: "error" } }
            });
            const results = await eslint.lintText("var x = 1;");
            expect(results[0].messages.filter(m => m.ruleId === "semi")).to.have.lengthOf(0);
        });

        it("should apply fixes when fix is enabled", async () => {
            const eslint = new ESLint({
                fix: true,
                overrideConfigFile: true,
                overrideConfig: { rules: { semi: "error" } }
            });
            const results = await eslint.lintText("var x = 1");
            expect(results[0]).to.have.property("output", "var x = 1;");
        });
    });

    describe("lintFiles()", () => {
        it("should lint files matching a pattern", async () => {
            fs.writeFileSync(path.join(tmpDir, "test.js"), "var x = 1");
            fs.writeFileSync(path.join(tmpDir, "eslint.config.js"),
                "module.exports = [{ rules: { semi: 'error' } }];"
            );
            const eslint = new ESLint({ cwd: tmpDir });
            const results = await eslint.lintFiles(["test.js"]);
            expect(results).to.be.an("array").with.lengthOf(1);
            expect(results[0].messages.length).to.be.greaterThan(0);
        });
    });

    describe("static getErrorResults()", () => {
        it("should filter results", async () => {
            const eslint = new ESLint({
                overrideConfigFile: true,
                overrideConfig: { rules: { semi: "error", "no-unused-vars": "warn" } }
            });
            const results = await eslint.lintText("var x = 1");
            const errorOnly = ESLint.getErrorResults(results);
            expect(errorOnly).to.be.an("array");
        });
    });

    describe("loadFormatter()", () => {
        it("should load the json formatter", async () => {
            const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: { rules: { semi: "error" } } });
            const formatter = await eslint.loadFormatter("json");
            expect(formatter).to.have.property("format").that.is.a("function");
        });
    });

    describe("isPathIgnored()", () => {
        it("should return a boolean", async () => {
            const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: {} });
            const result = await eslint.isPathIgnored("test.js");
            expect(result).to.be.a("boolean");
        });
    });
});

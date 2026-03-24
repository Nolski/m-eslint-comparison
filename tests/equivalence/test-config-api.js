"use strict";
const { expect } = require("chai");
const { resolveMain, resolveSubpath, IMPL } = require("../helpers");

describe(`[${IMPL}] Config API`, () => {
    let configApi;

    before(() => {
        configApi = resolveSubpath("/config");
    });

    describe("defineConfig()", () => {
        it("should be a function", () => {
            expect(configApi.defineConfig).to.be.a("function");
        });

        it("should pass through a config array", () => {
            const result = configApi.defineConfig([{ rules: { semi: "error" } }]);
            expect(result).to.be.an("array");
        });
    });

    describe("globalIgnores()", () => {
        it("should be a function", () => {
            expect(configApi.globalIgnores).to.be.a("function");
        });

        it("should return object with ignores property", () => {
            const result = configApi.globalIgnores(["node_modules/", "dist/"]);
            expect(result).to.have.property("ignores");
        });
    });
});

describe(`[${IMPL}] Unsupported API`, () => {
    let unsupported;

    before(() => {
        unsupported = resolveSubpath("/use-at-your-own-risk");
    });

    describe("shouldUseFlatConfig()", () => {
        it("should return a boolean (possibly via promise)", async () => {
            const result = await unsupported.shouldUseFlatConfig();
            expect(result).to.be.a("boolean");
        });
    });

    describe("builtinRules", () => {
        it("should have .get() method", () => {
            expect(unsupported.builtinRules.get).to.be.a("function");
        });

        it("should contain common rules", () => {
            expect(unsupported.builtinRules.get("semi")).to.exist;
            expect(unsupported.builtinRules.get("no-unused-vars")).to.exist;
            expect(unsupported.builtinRules.get("eqeqeq")).to.exist;
        });
    });
});

describe(`[${IMPL}] Universal export`, () => {
    it("should export Linter", () => {
        const universal = resolveSubpath("/universal");
        expect(universal.Linter).to.be.a("function");
    });
});

describe(`[${IMPL}] loadESLint()`, () => {
    it("should return ESLint constructor", async () => {
        const { loadESLint } = resolveMain();
        const ESLintClass = await loadESLint();
        expect(ESLintClass).to.be.a("function");
    });
});

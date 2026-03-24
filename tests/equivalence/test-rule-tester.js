"use strict";
const { expect } = require("chai");
const { resolveMain, IMPL } = require("../helpers");

describe(`[${IMPL}] RuleTester`, () => {
    let RuleTester;

    before(() => {
        ({ RuleTester } = resolveMain());
    });

    it("should be a constructor", () => {
        expect(new RuleTester()).to.be.instanceOf(RuleTester);
    });

    describe("run()", () => {
        it("should pass valid/invalid test cases", () => {
            const tester = new RuleTester();
            const rule = {
                create(context) {
                    return {
                        Identifier(node) {
                            if (node.name === "bad") {
                                context.report({ node, message: "bad identifier" });
                            }
                        }
                    };
                }
            };
            tester.run("test-rule", rule, {
                valid: ["var good = 1;"],
                invalid: [{ code: "var bad = 1;", errors: [{ message: "bad identifier" }] }]
            });
        });

        it("should support messageId", () => {
            const tester = new RuleTester();
            const rule = {
                meta: { messages: { badId: "bad identifier '{{ name }}'" } },
                create(context) {
                    return {
                        Identifier(node) {
                            if (node.name === "bad") {
                                context.report({ node, messageId: "badId", data: { name: "bad" } });
                            }
                        }
                    };
                }
            };
            tester.run("meta-rule", rule, {
                valid: ["var good = 1;"],
                invalid: [{ code: "var bad = 1;", errors: [{ messageId: "badId" }] }]
            });
        });
    });

    describe("static config methods", () => {
        afterEach(() => { RuleTester.resetDefaultConfig(); });

        it("should get/set default config", () => {
            RuleTester.setDefaultConfig({ languageOptions: { ecmaVersion: 2015 } });
            const result = RuleTester.getDefaultConfig();
            expect(result).to.deep.include({ languageOptions: { ecmaVersion: 2015 } });
        });

        it("should reset default config", () => {
            RuleTester.setDefaultConfig({ languageOptions: { ecmaVersion: 2015 } });
            RuleTester.resetDefaultConfig();
            expect(RuleTester.getDefaultConfig()).to.not.have.property("languageOptions");
        });
    });
});

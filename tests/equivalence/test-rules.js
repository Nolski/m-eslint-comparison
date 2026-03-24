"use strict";
const { expect } = require("chai");
const { resolveMain, IMPL } = require("../helpers");

describe(`[${IMPL}] Built-in Rules`, () => {
    let Linter, linter;

    before(() => {
        ({ Linter } = resolveMain());
    });

    beforeEach(() => {
        linter = new Linter();
    });

    const ruleTests = [
        { rule: "semi", valid: "var x = 1;", invalid: "var x = 1" },
        { rule: "eqeqeq", valid: "if (x === 1) {}", invalid: "if (x == 1) {}" },
        { rule: "no-console", valid: "var x = 1;", invalid: "console.log('hi');" },
        { rule: "curly", valid: "if (x) { foo(); }", invalid: "if (x) foo();" },
        { rule: "no-var", valid: "let x = 1;", invalid: "var x = 1;", languageOptions: { ecmaVersion: 2015 } },
        { rule: "prefer-const", valid: "const x = 1;", invalid: "let x = 1;", languageOptions: { ecmaVersion: 2015 } },
        { rule: "no-unused-vars", valid: "var x = 1; console.log(x);", invalid: "var x = 1;" },
        { rule: "no-empty", valid: "if (x) { foo(); }", invalid: "if (x) {}" },
        { rule: "no-extra-semi", valid: "var x = 1;", invalid: "var x = 1;;" },
    ];

    ruleTests.forEach(({ rule, valid, invalid, languageOptions }) => {
        describe(rule, () => {
            it("should pass valid code", () => {
                const config = { rules: { [rule]: "error" } };
                if (languageOptions) config.languageOptions = languageOptions;
                const messages = linter.verify(valid, config);
                expect(messages.filter(m => m.ruleId === rule)).to.have.lengthOf(0);
            });

            it("should report error for invalid code", () => {
                const config = { rules: { [rule]: "error" } };
                if (languageOptions) config.languageOptions = languageOptions;
                const messages = linter.verify(invalid, config);
                expect(messages.filter(m => m.ruleId === rule).length).to.be.at.least(1);
            });
        });
    });
});

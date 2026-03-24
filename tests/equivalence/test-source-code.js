"use strict";
const { expect } = require("chai");
const { resolveMain, IMPL } = require("../helpers");

describe(`[${IMPL}] SourceCode`, () => {
    let SourceCode;

    before(() => {
        ({ SourceCode } = resolveMain());
    });

    describe("splitLines()", () => {
        it("should split by newlines", () => {
            expect(SourceCode.splitLines("a\nb\nc")).to.deep.equal(["a", "b", "c"]);
        });

        it("should handle Windows line endings", () => {
            expect(SourceCode.splitLines("a\r\nb\r\nc")).to.deep.equal(["a", "b", "c"]);
        });

        it("should handle empty string", () => {
            expect(SourceCode.splitLines("")).to.deep.equal([""]);
        });

        it("should handle single line", () => {
            expect(SourceCode.splitLines("hello")).to.deep.equal(["hello"]);
        });

        it("should handle trailing newline", () => {
            expect(SourceCode.splitLines("a\nb\n")).to.deep.equal(["a", "b", ""]);
        });
    });
});

"use strict";

const path = require("path");

const IMPL = process.env.ESLINT_IMPL || "eslint";

// Subpath export mapping (package.json "exports" field)
const SUBPATH_MAP = {
    "/config": "/lib/config-api.js",
    "/use-at-your-own-risk": "/lib/unsupported-api.js",
    "/universal": "/lib/universal.js",
};

function getPackagePath() {
    if (IMPL === "eslint") {
        return require.resolve("eslint").replace(/\/lib\/api\.js$/, "");
    }
    return require.resolve("m-eslint").replace(/\/lib\/api\.js$/, "");
}

function resolveMain() {
    if (IMPL === "eslint") return require("eslint");
    return require("m-eslint");
}

function resolveSubpath(subpath) {
    const pkgPath = getPackagePath();
    const mapped = SUBPATH_MAP[subpath];
    if (!mapped) throw new Error(`Unknown subpath: ${subpath}`);
    return require(path.join(pkgPath, mapped));
}

module.exports = {
    IMPL,
    resolveMain,
    resolveSubpath,
    getPackagePath,
};

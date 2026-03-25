"use strict";

/**
 * Compare two arrays of ESLint JSON results and produce a diff summary.
 *
 * @param {Array} eslintResults  - Results from original eslint
 * @param {Array} mEslintResults - Results from m-eslint
 * @param {string} repoDir      - Absolute path to the cloned repo (stripped from filePaths)
 * @returns {{ totalFiles, matchedFiles, mismatchedFiles, eslintErrors, eslintWarnings, mEslintErrors, mEslintWarnings, details }}
 */
function compareResults(eslintResults, mEslintResults, repoDir) {
    const normalize = (filePath) => {
        // Strip the repo directory prefix to get a relative path
        if (filePath.startsWith(repoDir)) {
            let rel = filePath.slice(repoDir.length);
            if (rel.startsWith("/")) rel = rel.slice(1);
            return rel;
        }
        return filePath;
    };

    // Build maps keyed by relative path
    const eslintMap = new Map();
    for (const r of eslintResults) {
        eslintMap.set(normalize(r.filePath), r);
    }

    const mEslintMap = new Map();
    for (const r of mEslintResults) {
        mEslintMap.set(normalize(r.filePath), r);
    }

    // Union of all files seen by either implementation
    const allFiles = new Set([...eslintMap.keys(), ...mEslintMap.keys()]);

    let matchedFiles = 0;
    let mismatchedFiles = 0;
    let eslintErrors = 0;
    let eslintWarnings = 0;
    let mEslintErrors = 0;
    let mEslintWarnings = 0;
    const details = [];

    for (const file of [...allFiles].sort()) {
        const eResult = eslintMap.get(file);
        const mResult = mEslintMap.get(file);

        const eErrors = eResult ? eResult.errorCount : 0;
        const eWarnings = eResult ? eResult.warningCount : 0;
        const mErrors = mResult ? mResult.errorCount : 0;
        const mWarnings = mResult ? mResult.warningCount : 0;

        eslintErrors += eErrors;
        eslintWarnings += eWarnings;
        mEslintErrors += mErrors;
        mEslintWarnings += mWarnings;

        const eMessages = eResult ? eResult.messages : [];
        const mMessages = mResult ? mResult.messages : [];

        // Compare messages by the fields we care about
        const match = messagesMatch(eMessages, mMessages);

        if (match) {
            matchedFiles++;
        } else {
            mismatchedFiles++;
        }

        details.push({
            file,
            match,
            eslintErrors: eErrors,
            eslintWarnings: eWarnings,
            mEslintErrors: mErrors,
            mEslintWarnings: mWarnings,
            eslintMsgCount: eMessages.length,
            mEslintMsgCount: mMessages.length,
        });
    }

    return {
        totalFiles: allFiles.size,
        matchedFiles,
        mismatchedFiles,
        eslintErrors,
        eslintWarnings,
        mEslintErrors,
        mEslintWarnings,
        details,
    };
}

/**
 * Compare two message arrays by ruleId, severity, line, column.
 * Order matters (messages are positional).
 */
function messagesMatch(a, b) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (
            a[i].ruleId !== b[i].ruleId ||
            a[i].severity !== b[i].severity ||
            a[i].line !== b[i].line ||
            a[i].column !== b[i].column
        ) {
            return false;
        }
    }

    return true;
}

module.exports = { compareResults };

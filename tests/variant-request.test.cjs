const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTypescript(file) {
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => name.endsWith(".json") ? require(path.resolve(path.dirname(file), name)) : loadTypescript(path.resolve(path.dirname(file), `${name}.ts`)),
    module,
    module.exports,
  );
  return module.exports;
}

const { variantRequestNumbers, matchesSavedVariantRequest } = loadTypescript(path.resolve(__dirname, "../lib/variant-request.ts"));

test("a saved variant request can resume without inserting the same wrong answers", () => {
  const row = {
    problem: "405, 408, 409, 410, 414, 415, 416, 420",
    memo: "[24 삼산고 2학기기말] 어렵다 [변형문제 요청: 5, 8, 9, 10, 14, 15, 16, 20번]",
  };
  assert.deepEqual(variantRequestNumbers(row.memo), ["5", "8", "9", "10", "14", "15", "16", "20"]);
  assert.equal(matchesSavedVariantRequest(row, ["405", "408", "409", "410", "414", "415", "416", "420"], ["5", "8", "9", "10", "14", "15", "16", "20"]), true);
  assert.equal(matchesSavedVariantRequest(row, ["405", "408"], ["5", "8"]), false);
  assert.equal(matchesSavedVariantRequest(row, ["405", "408", "409", "410", "414", "415", "416", "420"], ["5", "8"]), false);
  assert.equal(variantRequestNumbers("어렵다"), null);
});

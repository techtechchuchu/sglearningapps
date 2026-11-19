const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTypescript(file) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => name.endsWith(".json")
    ? require(path.resolve(path.dirname(file), name))
    : loadTypescript(path.resolve(path.dirname(file), `${name}.ts`));
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  return module.exports;
}

const { youtubeId, youtubeStartSeconds, youtubeStartFromUrl, formatYoutubeStart, youtubeEmbedUrl } =
  loadTypescript(path.resolve(__dirname, "../lib/problem-explanations.ts"));

test("start time accepts clock, seconds and YouTube unit formats", () => {
  assert.equal(youtubeStartSeconds("12:34"), 754);
  assert.equal(youtubeStartSeconds("1:02:03"), 3723);
  assert.equal(youtubeStartSeconds("754"), 754);
  assert.equal(youtubeStartSeconds("754s"), 754);
  assert.equal(youtubeStartSeconds("12m34s"), 754);
  assert.equal(youtubeStartSeconds("1h2m3s"), 3723);
  assert.equal(youtubeStartSeconds(" 0:05 "), 5);
});

test("empty or zero start time means play from the beginning", () => {
  assert.equal(youtubeStartSeconds(""), null);
  assert.equal(youtubeStartSeconds(undefined), null);
  assert.equal(youtubeStartSeconds("0"), null);
  assert.equal(youtubeStartSeconds("0:00"), null);
});

test("malformed or out-of-range start times are rejected", () => {
  for (const value of ["abc", "12:99", "1:2:3:4", "-5", "12.5", "99999999"]) {
    assert.throws(() => youtubeStartSeconds(value), /시작 시간/, value);
  }
});

test("timestamp is read from shared links without changing the video id", () => {
  assert.equal(youtubeStartFromUrl("https://youtu.be/dQw4w9WgXcQ?t=754"), 754);
  assert.equal(youtubeStartFromUrl("https://youtu.be/dQw4w9WgXcQ?si=abc&t=754"), 754);
  assert.equal(youtubeStartFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12m34s"), 754);
  assert.equal(youtubeStartFromUrl("https://www.youtube.com/embed/dQw4w9WgXcQ?start=90"), 90);
  assert.equal(youtubeStartFromUrl("https://youtu.be/dQw4w9WgXcQ"), null);
  assert.equal(youtubeStartFromUrl("https://youtu.be/dQw4w9WgXcQ?t=oops"), null);
  assert.equal(youtubeStartFromUrl("not a link"), null);
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ?si=abc&t=754"), "dQw4w9WgXcQ");
});

test("start time is formatted for display and placed in the embed address", () => {
  assert.equal(formatYoutubeStart(754), "12:34");
  assert.equal(formatYoutubeStart(3723), "1:02:03");
  assert.equal(formatYoutubeStart(5), "0:05");
  assert.equal(formatYoutubeStart(null), "");
  assert.equal(youtubeEmbedUrl("dQw4w9WgXcQ", 754), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=754");
  assert.equal(youtubeEmbedUrl("dQw4w9WgXcQ", null), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(youtubeEmbedUrl("dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
});

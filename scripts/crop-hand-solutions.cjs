// Cuts a hand-solution exam PDF into one image per problem.
//
//   node scripts/crop-hand-solutions.cjs "<exam.pdf>" <slug> [outDir]
//
// Works on PDFs that still carry their text layer: every problem starts with a "[출처]" line followed by
// "N." in a two-column page, so the text positions give the crop boxes. Scanned PDFs (no text) are reported
// and skipped. Needs poppler (pdftotext, pdftoppm) on PATH or in POPPLER_BIN.
// Output goes to upload-staging/, which is git-ignored: exam papers must not be committed to this public repo.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");

const DPI = 150;
const FOOTER_RATIO = 0.927; // the page-number box sits below this line
const [pdf, slug, outRoot = path.join(__dirname, "..", "upload-staging", "problem-solutions")] = process.argv.slice(2);
if (!pdf || !/^[a-z0-9-]+$/.test(slug || "")) {
  console.error('usage: node scripts/crop-hand-solutions.cjs "<exam.pdf>" <slug> [outDir]  (slug: a-z, 0-9, -)');
  process.exit(2);
}
const tool = (name) => (process.env.POPPLER_BIN ? path.join(process.env.POPPLER_BIN, name) : name);

function readWords(file) {
  const tmp = path.join(os.tmpdir(), `bbox-${process.pid}.html`);
  execFileSync(tool("pdftotext"), ["-enc", "UTF-8", "-bbox", file, tmp]);
  const html = fs.readFileSync(tmp, "utf8");
  fs.unlinkSync(tmp);
  const pages = [];
  for (const block of html.split("<page ").slice(1)) {
    const size = /width="([\d.]+)" height="([\d.]+)"/.exec(block);
    const words = [...block.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
      .map((m) => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], text: m[5] }));
    pages.push({ width: +size[1], height: +size[2], words });
  }
  return pages;
}

function problemBoxes(page) {
  const mid = page.width / 2;
  const boxes = [];
  for (const side of ["left", "right"]) {
    const inColumn = (word) => (side === "left" ? word.x0 < mid : word.x0 >= mid);
    const headers = page.words.filter((word) => word.text === "[출처]" && inColumn(word)).sort((a, b) => a.y0 - b.y0);
    headers.forEach((header, index) => {
      const label = page.words
        .filter((word) => inColumn(word) && /^\d{1,2}\.$/.test(word.text) && word.y0 > header.y0 && word.y0 - header.y1 < 60 && Math.abs(word.x0 - header.x0) < 14)
        .sort((a, b) => a.y0 - b.y0)[0];
      boxes.push({
        number: label ? Number(label.text.slice(0, -1)) : null,
        x0: side === "left" ? page.width * 0.045 : mid + 2,
        x1: side === "left" ? mid - 2 : page.width * 0.955,
        y0: header.y0 - 6,
        y1: index + 1 < headers.length ? headers[index + 1].y0 - 8 : page.height * FOOTER_RATIO,
      });
    });
  }
  return boxes;
}

(async () => {
  const pages = readWords(pdf);
  const found = pages.flatMap((page, index) => problemBoxes(page).map((box) => ({ ...box, page: index + 1 })));
  if (!found.length) {
    console.error(`텍스트가 없는 스캔 PDF라 자동으로 자를 수 없습니다: ${path.basename(pdf)}`);
    process.exit(3);
  }
  const unnamed = found.filter((box) => box.number === null);
  const numbers = found.filter((box) => box.number !== null).map((box) => box.number);
  const duplicates = numbers.filter((number, index) => numbers.indexOf(number) !== index);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "crop-"));
  execFileSync(tool("pdftoppm"), ["-r", String(DPI), "-png", pdf, path.join(work, "p")]);
  const pageFiles = fs.readdirSync(work).sort();
  const outDir = path.join(outRoot, slug);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const scale = DPI / 72;
  for (const box of found) {
    if (box.number === null || duplicates.includes(box.number)) continue;
    const source = path.join(work, pageFiles[box.page - 1]);
    const meta = await sharp(source).metadata();
    const left = Math.max(0, Math.round(box.x0 * scale));
    const top = Math.max(0, Math.round(box.y0 * scale));
    const width = Math.min(meta.width - left, Math.round((box.x1 - box.x0) * scale));
    const height = Math.min(meta.height - top, Math.round((box.y1 - box.y0) * scale));
    const cut = await sharp(source).extract({ left, top, width, height }).png().toBuffer();
    // Drop the empty paper around the problem, then put a small even margin back.
    const trimmed = await sharp(cut).trim({ background: "#ffffff", threshold: 12 }).toBuffer().catch(() => cut);
    await sharp(trimmed)
      .extend({ top: 14, bottom: 14, left: 14, right: 14, background: "#ffffff" })
      .webp({ quality: 82 })
      .toFile(path.join(outDir, `${String(box.number).padStart(2, "0")}.webp`));
  }
  fs.rmSync(work, { recursive: true, force: true });

  const saved = [...new Set(numbers)].filter((number) => !duplicates.includes(number)).sort((a, b) => a - b);
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ slug, source: path.basename(pdf), numbers: saved }, null, 2));
  console.log(`${slug}: ${saved.length}문제 저장 (${saved.join(", ")})`);
  if (unnamed.length) console.log(`  번호를 못 찾은 문제 ${unnamed.length}개: ${unnamed.map((box) => `p${box.page}`).join(", ")}`);
  if (duplicates.length) console.log(`  번호가 겹쳐서 건너뜀: ${[...new Set(duplicates)].join(", ")}`);
})().catch((error) => { console.error(error); process.exit(1); });

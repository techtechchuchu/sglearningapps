// Helpers for hand-solution PDFs that are plain scans (no text layer), where crop boxes are set by eye.
//
//   node scripts/scan-pages.cjs grid "<exam.pdf>" <outDir>
//       renders every page at 100 dpi with a labelled ruler grid, to read off problem positions
//   node scripts/scan-pages.cjs crop "<exam.pdf>" <slug> <boxes.json> [outDir]
//       boxes.json: [{ "number": 1, "page": 1, "x0": 40, "y0": 220, "x1": 500, "y1": 760 }, ...] in grid (100 dpi) pixels
//
// Needs poppler (pdftoppm) on PATH or in POPPLER_BIN. Crops go to the git-ignored upload-staging/ folder.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");

const GRID_DPI = 100, CROP_DPI = 150;
const tool = (name) => (process.env.POPPLER_BIN ? path.join(process.env.POPPLER_BIN, name) : name);

function render(pdf, dpi) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "scan-"));
  execFileSync(tool("pdftoppm"), ["-r", String(dpi), "-png", pdf, path.join(work, "p")]);
  return { work, files: fs.readdirSync(work).sort().map((name) => path.join(work, name)) };
}

async function grid(pdf, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const { work, files } = render(pdf, GRID_DPI);
  for (const [index, file] of files.entries()) {
    const { width, height } = await sharp(file).metadata();
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
    for (let y = 50; y < height; y += 50) {
      const major = y % 100 === 0;
      svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${major ? "#0057ff" : "#7fb0ff"}" stroke-width="1" opacity="0.55"/>`;
      if (major) svg += `<rect x="0" y="${y - 9}" width="34" height="18" fill="#0057ff"/><text x="3" y="${y + 5}" font-size="14" font-family="Arial" fill="#fff">${y}</text>`;
    }
    for (let x = 100; x < width; x += 100) {
      svg += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#ff5a00" stroke-width="1" opacity="0.4"/>`;
      svg += `<rect x="${x - 17}" y="0" width="34" height="16" fill="#ff5a00"/><text x="${x - 14}" y="13" font-size="13" font-family="Arial" fill="#fff">${x}</text>`;
    }
    svg += "</svg>";
    await sharp(file).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 70 }).toFile(path.join(outDir, `page-${String(index + 1).padStart(2, "0")}.jpg`));
  }
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`${files.length} pages -> ${outDir}`);
}

async function crop(pdf, slug, boxesFile, outRoot = path.join(__dirname, "..", "upload-staging", "problem-solutions")) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("slug: a-z, 0-9, -");
  const boxes = JSON.parse(fs.readFileSync(boxesFile, "utf8"));
  const { work, files } = render(pdf, CROP_DPI);
  const outDir = path.join(outRoot, slug);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const scale = CROP_DPI / GRID_DPI;
  for (const box of boxes) {
    const source = files[box.page - 1];
    const meta = await sharp(source).metadata();
    const left = Math.max(0, Math.round(box.x0 * scale));
    const top = Math.max(0, Math.round(box.y0 * scale));
    const width = Math.min(meta.width - left, Math.round((box.x1 - box.x0) * scale));
    const height = Math.min(meta.height - top, Math.round((box.y1 - box.y0) * scale));
    await sharp(source).extract({ left, top, width, height }).webp({ quality: 80 })
      .toFile(path.join(outDir, `${String(box.number).padStart(2, "0")}.webp`));
  }
  fs.rmSync(work, { recursive: true, force: true });
  const numbers = boxes.map((box) => box.number).sort((a, b) => a - b);
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ slug, source: path.basename(pdf), numbers }, null, 2));
  console.log(`${slug}: ${numbers.length}문제 저장 (${numbers.join(", ")})`);
}

const [mode, ...args] = process.argv.slice(2);
(mode === "grid" ? grid(...args) : mode === "crop" ? crop(...args) : Promise.reject(new Error("mode: grid | crop")))
  .catch((error) => { console.error(error.message || error); process.exit(1); });

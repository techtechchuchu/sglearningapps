// Server-side Supabase client for local maintenance scripts. Reads .env.local; never prints the key.
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const file = path.join(__dirname, "..", "..", ".env.local");
  if (!fs.existsSync(file)) throw new Error(".env.local 파일이 없습니다.");
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
}

function adminClient() {
  loadEnv();
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(".env.local에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣어주세요.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

module.exports = { adminClient, BUCKET: "problem-solutions" };

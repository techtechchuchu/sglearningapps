import { createHash, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string) {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

export function passwordMatches(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const supplied = Buffer.from(hashPassword(password), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

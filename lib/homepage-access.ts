import { createHash, timingSafeEqual } from "node:crypto";

export const HOMEPAGE_COOKIE = "studygyeol_home_access";
export const HOMEPAGE_ACCESS_SECONDS = 60 * 60 * 24 * 7;

function configuredPassword() {
  const password = process.env.HOMEPAGE_ACCESS_PASSWORD;
  return password && password.length >= 16 ? password : null;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function equals(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function homepageAccessIsConfigured() {
  return configuredPassword() !== null;
}

export function verifyHomepagePassword(input: string) {
  const password = configuredPassword();
  return password !== null && equals(digest(input), digest(password));
}

export function homepageAccessToken() {
  const password = configuredPassword();
  return password ? createHash("sha256").update(`homepage-access-v1:${password}`).digest("hex") : null;
}

export function verifyHomepageAccessToken(input: string | undefined) {
  const expected = homepageAccessToken();
  if (!expected || !input || !/^[a-f0-9]{64}$/.test(input)) return false;
  return equals(Buffer.from(input, "hex"), Buffer.from(expected, "hex"));
}


"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HOMEPAGE_ACCESS_SECONDS, HOMEPAGE_COOKIE, homepageAccessToken, homepageAccessIsConfigured, verifyHomepagePassword } from "../../lib/homepage-access";

export async function unlockHomepage(formData: FormData) {
  if (!homepageAccessIsConfigured()) redirect("/home?error=unavailable");
  const submitted = formData.get("password");
  const password = typeof submitted === "string" ? submitted.slice(0, 256) : "";
  if (!verifyHomepagePassword(password)) redirect("/home?error=invalid");

  const token = homepageAccessToken();
  if (!token) redirect("/home?error=unavailable");
  (await cookies()).set(HOMEPAGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/home",
    maxAge: HOMEPAGE_ACCESS_SECONDS,
  });
  redirect("/home");
}


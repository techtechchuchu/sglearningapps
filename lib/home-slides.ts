export type HomeSlide = {
  kind: "blog" | "home" | "ai" | "custom";
  title: string;
  description: string;
  eyebrow: string;
  imageUrl?: string;
  imagePath?: string;
  linkUrl?: string;
  startsAt?: string;
  endsAt?: string;
};

export function parseHomeSlide(value: unknown): HomeSlide {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const kind = String(input.kind || "custom") as HomeSlide["kind"];
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const eyebrow = String(input.eyebrow || "스터디결 소식").trim();
  const imageUrl = String(input.imageUrl || "").trim();
  const imagePath = String(input.imagePath || "").trim();
  const linkUrl = String(input.linkUrl || "").trim();
  const startsAt = String(input.startsAt || "").trim();
  const endsAt = String(input.endsAt || "").trim();
  if (!["blog", "home", "ai", "custom"].includes(kind) || !title || title.length > 120 || !description || description.length > 600 || eyebrow.length > 40) throw new Error("제목·설명·종류를 확인해주세요.");
  if (imageUrl && (!imageUrl.startsWith("/") || imageUrl.startsWith("//") || imageUrl.includes(".."))) throw new Error("이미지 주소를 확인해주세요.");
  if (imagePath && !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(imagePath)) throw new Error("업로드한 이미지를 다시 선택해주세요.");
  if (kind === "custom" && !imagePath && !imageUrl) throw new Error("배너 이미지를 선택해주세요.");
  if (linkUrl) {
    try { if (new URL(linkUrl).protocol !== "https:") throw new Error(); }
    catch { throw new Error("이동 링크는 https 주소를 입력해주세요."); }
  }
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime())) || (start && end && end <= start)) throw new Error("게시 기간을 확인해주세요.");
  return { kind, title, description, eyebrow, ...(imageUrl ? { imageUrl } : {}), ...(imagePath ? { imagePath } : {}), ...(linkUrl ? { linkUrl } : {}), ...(start ? { startsAt: start.toISOString() } : {}), ...(end ? { endsAt: end.toISOString() } : {}) };
}

export function withinPublicationWindow(value: { startsAt?: string; endsAt?: string }, now = new Date()): boolean {
  return (!value.startsAt || new Date(value.startsAt) <= now) && (!value.endsAt || new Date(value.endsAt) > now);
}

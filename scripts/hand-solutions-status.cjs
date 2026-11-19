// Read-only check: what is in the problem-solutions bucket and which 2025 exams have images/videos linked.
//   node scripts/hand-solutions-status.cjs
const { adminClient, BUCKET } = require("./lib/supabase-admin.cjs");

(async () => {
  const db = adminClient();
  const buckets = await db.storage.listBuckets();
  if (buckets.error) throw new Error(`저장소 조회 실패: ${buckets.error.message}`);
  const bucket = buckets.data.find((item) => item.name === BUCKET);
  console.log(`버킷 ${BUCKET}: ${bucket ? (bucket.public ? "있음 (공개!)" : "있음 (비공개)") : "없음"}`);
  if (bucket) {
    const top = await db.storage.from(BUCKET).list("", { limit: 200 });
    if (top.error) throw new Error(top.error.message);
    for (const entry of top.data) {
      const inner = await db.storage.from(BUCKET).list(entry.name, { limit: 200 });
      console.log(`  ${entry.name}/  ${inner.data ? inner.data.length : 0}개`);
    }
    if (!top.data.length) console.log("  (비어 있음)");
  }

  const exams = await db.from("school_exam_master").select("id,school_name,subject,exam_type,question_count,is_active").eq("exam_year", 2025).order("school_name");
  if (exams.error) throw new Error(`시험 조회 실패: ${exams.error.message}`);
  for (const exam of exams.data) {
    const rows = await db.from("problem_explanations").select("youtube_video_id,image_url").like("content_key", `school:${exam.id}:%`);
    const data = rows.data || [];
    console.log(`시험 #${exam.id} ${exam.school_name} ${exam.subject} ${exam.exam_type} (${exam.question_count}문항${exam.is_active ? "" : ", 비활성"}): 이미지 ${data.filter((row) => row.image_url).length}, 영상 ${data.filter((row) => row.youtube_video_id).length}`);
  }
})().catch((error) => { console.error(error.message || error); process.exit(1); });

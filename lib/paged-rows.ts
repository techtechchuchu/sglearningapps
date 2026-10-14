type Page<T> = { data: T[] | null; error: unknown };

// Supabase projects commonly cap a single response at 1,000 rows.
export async function fetchPagedRows<T>(query: (start: number, end: number) => PromiseLike<Page<T>>, maximum = 50000): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; start < maximum; start += 1000) {
    const page = await query(start, start + 999);
    if (page.error) throw page.error;
    const values = page.data || [];
    rows.push(...values);
    if (values.length < 1000) return rows;
  }
  throw new Error(`조회 건수가 ${maximum}건을 넘었습니다. 범위를 좁혀주세요.`);
}

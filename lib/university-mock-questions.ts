// Public question text only. The answer key must remain in a server-side secret.
export const MOCK_SLUG = "calculus-ii-7-8-pilot";
export const MOCK_TITLE = "미적분학2 · 무한급수와 공간기하";
export const MOCK_DURATION_MINUTES = 30;

export const mockQuestions = [
  { id: "q1", topic: "무한급수", stem: String.raw`\sum_{n=1}^{\infty}\frac{1}{n(n+1)}`, choices: [String.raw`\frac12`, String.raw`1`, String.raw`2`, String.raw`\text{발산}`] },
  { id: "q2", topic: "무한급수", stem: String.raw`\sum_{n=1}^{\infty}\frac{(-1)^{n+1}}{n}`, choices: [String.raw`\text{절대수렴}`, String.raw`\text{조건수렴}`, String.raw`\text{발산}`, String.raw`\text{값이 }0\text{인 급수}`] },
  { id: "q3", topic: "멱급수", stem: String.raw`\sum_{n=1}^{\infty}\frac{(x-2)^n}{3^n n}\text{의 수렴반경 }R`, choices: [String.raw`1`, String.raw`2`, String.raw`3`, String.raw`\infty`] },
  { id: "q4", topic: "테일러급수", stem: String.raw`e^{2x}\text{의 }x^2\text{항 계수}`, choices: [String.raw`1`, String.raw`2`, String.raw`4`, String.raw`\frac12`] },
  { id: "q5", topic: "벡터", stem: String.raw`(1,2,-1)\cdot(3,-1,2)`, choices: [String.raw`-1`, String.raw`0`, String.raw`1`, String.raw`3`] },
  { id: "q6", topic: "벡터", stem: String.raw`\left\|(2,-1,2)\right\|`, choices: [String.raw`\sqrt5`, String.raw`3`, String.raw`5`, String.raw`9`] },
  { id: "q7", topic: "공간기하", stem: String.raw`(1,0,0)\times(0,1,0)`, choices: [String.raw`(0,0,1)`, String.raw`(0,0,-1)`, String.raw`(1,1,0)`, String.raw`(0,0,0)`] },
  { id: "q8", topic: "공간기하", stem: String.raw`(1,2,3)\text{을 지나고 법선벡터가 }(2,-1,1)\text{인 평면}`, choices: [String.raw`2x-y+z=3`, String.raw`2x-y+z=4`, String.raw`x+2y+3z=14`, String.raw`2x+y-z=1`] },
] as const;

export type MockAnswers = Record<string, number>;

export function parseMockAnswers(input: unknown): MockAnswers | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((id) => !mockQuestions.some((question) => question.id === id))) return null;
  const answers: MockAnswers = {};
  for (const question of mockQuestions) {
    const choice = value[question.id];
    if (choice === undefined) continue;
    if (!Number.isInteger(choice) || Number(choice) < 0 || Number(choice) >= question.choices.length) return null;
    answers[question.id] = Number(choice);
  }
  return answers;
}

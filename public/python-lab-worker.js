/* Python runs in a worker so a long loop cannot freeze the study page. */
const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";
let runtime;

async function getRuntime() {
  if (!runtime) {
    importScripts(`${PYODIDE_URL}pyodide.js`);
    runtime = self.loadPyodide({ indexURL: PYODIDE_URL });
  }
  return runtime;
}

self.onmessage = async ({ data }) => {
  if (!data || data.type !== "run") return;
  const { id, code } = data;
  try {
    const pyodide = await getRuntime();
    const lines = [];
    pyodide.setStdout({ batched: (line) => lines.push(line) });
    pyodide.setStderr({ batched: (line) => lines.push(line) });
    await pyodide.runPythonAsync(code);
    self.postMessage({ id, output: lines.join("\n") || "실행 완료 · 출력 없음" });
  } catch (error) {
    self.postMessage({ id, output: String(error), failed: true });
  }
};


// Golden-set test (runs in CI inside the Docker image):
//   1. the reference scores 100 in every frame,
//   2. rendering the reference twice gives identical pixels,
//   3. every answer in golden/ scores within its [min, max],
//   4. every challenge ships at least three golden answers.
import { loadAllChallenges } from "./challenges";
import { Renderer } from "./render";
import { renderTarget, scoreAnswer } from "./score";

const only = process.argv[2];
const renderer = new Renderer();
const failures: string[] = [];
let rows = 0;

const all = (await loadAllChallenges()).filter((c) => !only || c.meta.id.includes(only));
for (const c of all) {
  const target = await renderTarget(renderer, c.meta, c.reference);
  const again = await renderTarget(renderer, c.meta, c.reference);
  for (const f of c.meta.frames) {
    const a = target.output.frames[f];
    const b = again.output.frames[f];
    if (!a || !b || !a.data.equals(b.data)) failures.push(`${c.meta.id}: ${f} frame is not deterministic`);
  }

  const ref = await scoreAnswer(renderer, target, c.reference);
  const refLine = ref.status === "scored" ? `${ref.score} (${ref.frames.map((f) => `${f.frame} ${f.score}`).join(", ")})` : ref.message;
  console.log(`\n${c.meta.id}  reference ${refLine}`);
  if (ref.status !== "scored" || ref.score !== 100 || ref.frames.some((f) => f.score !== 100)) {
    failures.push(`${c.meta.id}: reference must score 100, got ${refLine}`);
    if (ref.status === "scored") for (const ch of ref.checks.filter((x) => !x.pass)) failures.push(`  failed check ${ch.id}: ${ch.hint ?? ""}`);
  }
  if (c.golden.length < 3) failures.push(`${c.meta.id}: needs at least 3 golden answers, has ${c.golden.length}`);

  for (const g of c.golden) {
    const r = await scoreAnswer(renderer, target, g.code);
    const score = r.status === "scored" ? r.score : 0;
    const ok = score <= g.max && score >= g.min;
    rows++;
    const detail = r.status === "scored" ? `visual ${r.visual}, checks ${r.checksPassed}/${r.checksRun}` : "missing hook";
    console.log(`  ${ok ? "ok  " : "FAIL"} ${g.name.padEnd(24)} ${String(score).padStart(5)}  [${g.min}, ${g.max}]  ${detail}  (${g.reason})`);
    if (!ok) failures.push(`${c.meta.id}/${g.name}: scored ${score}, expected between ${g.min} and ${g.max} (${g.reason})`);
  }
}
await renderer.close();

console.log(`\n${all.length} challenges, ${rows} golden answers`);
if (failures.length) {
  console.error(`\n${failures.length} golden-set failures:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("golden set passed");

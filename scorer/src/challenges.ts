import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ChallengeMetaSchema, type ChallengeMeta } from "@cssdojo/shared";

export const CHALLENGES_DIR = process.env.CHALLENGES_DIR ?? path.resolve(import.meta.dirname, "../../challenges");

export interface GoldenAnswer {
  name: string;
  code: string;
  /** Highest total score this wrong answer may get. */
  max: number;
  reason: string;
}

export interface Challenge {
  meta: ChallengeMeta;
  dir: string;
  starter: string;
  reference: string;
  note: string;
  golden: GoldenAnswer[];
}

const GOLDEN_HEADER = /^<!--\s*golden\s+max=(\d+(?:\.\d+)?)\s+reason="([^"]+)"\s*-->/;

async function readOptional(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

export async function loadChallenge(dir: string): Promise<Challenge> {
  const raw: unknown = JSON.parse(await readFile(path.join(dir, "challenge.json"), "utf8"));
  const parsed = ChallengeMetaSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`${path.basename(dir)}/challenge.json is invalid: ${parsed.error.message}`);
  }
  const meta = parsed.data;
  if (meta.id !== path.basename(dir)) throw new Error(`Folder ${path.basename(dir)} must match id ${meta.id}`);

  const goldenDir = path.join(dir, "golden");
  const golden: GoldenAnswer[] = [];
  const files = await readdir(goldenDir).catch(() => [] as string[]);
  for (const f of files.filter((n) => n.endsWith(".html")).sort()) {
    const code = await readFile(path.join(goldenDir, f), "utf8");
    const m = GOLDEN_HEADER.exec(code);
    if (!m) throw new Error(`${meta.id}/golden/${f} needs a first line like <!-- golden max=85 reason="..." -->`);
    golden.push({ name: f.replace(/\.html$/, ""), code: code.slice(m[0].length).trimStart(), max: Number(m[1]), reason: m[2] ?? "" });
  }

  return {
    meta,
    dir,
    starter: await readFile(path.join(dir, "starter.html"), "utf8"),
    reference: await readFile(path.join(dir, "reference.html"), "utf8"),
    note: await readOptional(path.join(dir, "note.md")),
    golden,
  };
}

export async function loadAllChallenges(root = CHALLENGES_DIR): Promise<Challenge[]> {
  const entries = await readdir(root).catch(() => [] as string[]);
  const out: Challenge[] = [];
  for (const name of entries.sort()) {
    const dir = path.join(root, name);
    if (!(await stat(dir)).isDirectory()) continue;
    out.push(await loadChallenge(dir));
  }
  const numbers = new Set<number>();
  for (const c of out) {
    if (numbers.has(c.meta.number)) throw new Error(`Duplicate challenge number ${c.meta.number}`);
    numbers.add(c.meta.number);
  }
  return out.sort((a, b) => a.meta.number - b.meta.number);
}

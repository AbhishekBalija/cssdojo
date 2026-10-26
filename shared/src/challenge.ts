import { z } from "zod";
import { BELTS } from "./belts";

export const FRAMES = ["rest", "hover", "focus"] as const;
export type FrameName = (typeof FRAMES)[number];

/**
 * Outcome checks. Each one judges what the result does, never how it was built.
 * See scorer/src/checks.ts for the rules and hints.
 */
export const CHECK_IDS = [
  "hooks-present",
  "hover-changes",
  "focus-visible",
  "text-contrast-aa",
  "target-size",
  "semantic-control",
  "real-text",
] as const;
export type CheckId = (typeof CHECK_IDS)[number];

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB");
const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase words joined by dashes");

export const InspirationSchema = z.object({
  /** Where the idea came from, for example "Stripe dashboard filters". */
  source: z.string().min(3),
  url: z.string().url(),
  /** What we took (a detail) and what we changed. Never a copy of one design. */
  note: z.string().min(10),
});

export const ChallengeMetaSchema = z
  .object({
    id: Slug,
    number: z.number().int().positive(),
    title: z.string().min(2).max(40),
    belt: z.enum(BELTS),
    kind: z.enum(["challenge", "kata"]),
    /** Position in the kata cycle (1-based). Only for kind "kata". */
    kataDay: z.number().int().positive().optional(),
    brief: z.string().min(10).max(240),
    frames: z.array(z.enum(FRAMES)).min(1),
    /** Name -> CSS selector of elements the player's HTML must keep. */
    hooks: z.record(z.string(), z.string()).refine((h) => Object.keys(h).length > 0, "At least one hook"),
    /** Which hook receives the mouse (hover) and keyboard focus (focus). */
    states: z.object({ hover: z.string().optional(), focus: z.string().optional() }).default({}),
    checks: z.array(z.enum(CHECK_IDS)).min(1),
    /** Colours shown as copyable chips on the play screen. */
    colors: z.array(HexColor).min(1).max(8),
    allow: z.object({ fonts: z.array(z.enum(["Onest", "Martian Mono", "Instrument Serif"])).default([]) }).default({ fonts: [] }),
    inspiration: z.array(InspirationSchema).min(1),
  })
  .superRefine((c, ctx) => {
    if (c.frames[0] !== "rest") ctx.addIssue({ code: "custom", message: "The first frame must be rest", path: ["frames"] });
    for (const f of ["hover", "focus"] as const) {
      const hook = c.states[f];
      if (c.frames.includes(f) && !hook) ctx.addIssue({ code: "custom", message: `Frame ${f} needs states.${f}`, path: ["states"] });
      if (hook && !(hook in c.hooks)) ctx.addIssue({ code: "custom", message: `states.${f} names unknown hook ${hook}`, path: ["states"] });
    }
    if (c.kind === "kata" && !c.kataDay) ctx.addIssue({ code: "custom", message: "Kata need kataDay", path: ["kataDay"] });
    if (!c.checks.includes("hooks-present")) ctx.addIssue({ code: "custom", message: "Every challenge runs hooks-present", path: ["checks"] });
  });

export type ChallengeMeta = z.infer<typeof ChallengeMetaSchema>;

/** What the API sends to the play screen. Never includes the reference solution. */
export const PublicChallengeSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  belt: z.enum(BELTS),
  kind: z.enum(["challenge", "kata"]),
  brief: z.string(),
  frames: z.array(z.enum(FRAMES)),
  hooks: z.record(z.string(), z.string()),
  checks: z.array(z.enum(CHECK_IDS)),
  colors: z.array(z.string()),
  /** Fonts the target uses. They are bundled and already loaded in the preview. */
  fonts: z.array(z.string()),
  starter: z.string(),
  inspiration: z.array(InspirationSchema),
});
export type PublicChallenge = z.infer<typeof PublicChallengeSchema>;

export const VIEWPORT = { width: 400, height: 300 } as const;
/** Largest Submit we accept, in bytes. */
export const MAX_CODE_BYTES = 50 * 1024;

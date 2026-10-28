/** Bundled font files (scorer/fonts). The scorer and the play screen load the same files. */
export const FONT_FILES = [
  { family: "Onest", file: "onest.woff2", weight: "100 900", style: "normal" },
  { family: "Martian Mono", file: "martian-mono.woff2", weight: "100 800", style: "normal" },
  { family: "Instrument Serif", file: "instrument-serif.woff2", weight: "400", style: "normal" },
  { family: "Instrument Serif", file: "instrument-serif-italic.woff2", weight: "400", style: "italic" },
] as const;

/** @font-face rules pointing at `${baseUrl}/<file>`. */
export function fontFaceCss(baseUrl: string): string {
  return FONT_FILES.map(
    (f) =>
      `@font-face{font-family:"${f.family}";src:url("${baseUrl}/${f.file}") format("woff2");font-weight:${f.weight};font-style:${f.style};font-display:block}`,
  ).join("\n");
}

/** The page every answer renders in. Same wrapper on the server and in the preview. */
export function wrapDocument(code: string, fontBaseUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss(fontBaseUrl)}</style></head><body>${code}</body></html>`;
}

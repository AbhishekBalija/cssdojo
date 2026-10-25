// Removes what a Submit may not use, before it is rendered anywhere.
// The renderer also runs with JavaScript and network off, so this is the first
// of two walls, not the only one.

export interface SanitizeResult {
  code: string;
  removed: string[];
}

const RULES: { name: string; pattern: RegExp }[] = [
  { name: "<script> blocks", pattern: /<script\b[\s\S]*?<\/script\s*>/gi },
  { name: "<script> tags", pattern: /<\/?script\b[^>]*>/gi },
  { name: "embedded media (img, picture, video, audio, iframe, object, embed)", pattern: /<\/?(img|picture|source|video|audio|iframe|object|embed|frame|frameset|canvas)\b[^>]*>/gi },
  { name: "<link>, <meta> and <base> tags", pattern: /<(link|meta|base)\b[^>]*>/gi },
  { name: "SVG <image> and <use> references", pattern: /<\/?(image|use|foreignObject)\b[^>]*>/gi },
  { name: "event handler attributes", pattern: /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi },
  { name: "javascript: links", pattern: /javascript\s*:/gi },
  { name: "@import rules", pattern: /@import\b[^;]*;?/gi },
  { name: "url() values", pattern: /url\s*\([^)]*\)/gi },
  { name: "data: URIs", pattern: /data\s*:[^"'\s)]*/gi },
  { name: "@font-face rules", pattern: /@font-face\s*\{[^}]*\}/gi },
];

export function sanitizeCode(input: string): SanitizeResult {
  let code = input;
  const removed: string[] = [];
  for (const rule of RULES) {
    const next = code.replace(rule.pattern, "");
    if (next !== code) removed.push(rule.name);
    code = next;
  }
  return { code, removed };
}

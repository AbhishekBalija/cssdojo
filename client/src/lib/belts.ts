import type { Belt } from "@cssdojo/shared";

export const BELT_COLOR: Record<Belt, string> = {
  white: "var(--belt-white)",
  yellow: "var(--belt-yellow)",
  green: "var(--belt-green)",
  brown: "var(--belt-brown)",
  black: "var(--belt-black)",
};

export function beltLabel(b: Belt): string {
  return `${b[0]?.toUpperCase() ?? ""}${b.slice(1)} belt`;
}

export function pad3(n: number): string {
  return `#${String(n).padStart(3, "0")}`;
}

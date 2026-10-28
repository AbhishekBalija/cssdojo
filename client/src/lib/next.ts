/** Where to land after sign-in. Only same-site paths are allowed, so `next` can't send people to another origin. */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (raw === "/signin" || raw.startsWith("/signin?")) return "/";
  return raw;
}

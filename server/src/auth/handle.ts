/** A short public name from the OAuth profile: lowercase letters, digits and dashes. */
export function baseHandle(name: string, email: string): string {
  const from = name.trim() || email.split("@")[0] || "player";
  const slug = from
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20)
    .replace(/-+$/, "");
  return slug.length >= 2 ? slug : "player";
}

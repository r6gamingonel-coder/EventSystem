// ASCII-only slug. Arabic titles (the common case here) have no Latin
// characters, so this normally falls back to a short random id — which is
// also safer to share (WhatsApp/Instagram) than a heavily percent-encoded
// Arabic URL, and avoids a routing bug with non-ASCII dynamic segments
// observed in this Next.js/Turbopack version.
export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || Math.random().toString(36).slice(2, 8);
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let i = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${i}`;
    i += 1;
  }
  return candidate;
}

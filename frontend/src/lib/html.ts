// Convert legacy HTML descriptions (entered via the old rich-text field) into
// clean plain text for safe display. Block/line tags become newlines; all other
// tags are stripped; common entities are decoded. No HTML is ever rendered, so
// this is XSS-safe by construction.
export function htmlToText(input: string | undefined | null): string {
  if (!input) return '';
  let s = input;

  // Turn line-breaking tags into newlines before stripping the rest.
  s = s.replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\s*li[^>]*>/gi, '• ');

  // Drop every remaining tag.
  s = s.replace(/<[^>]+>/g, '');

  // Decode the handful of entities that actually show up.
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&#39;': "'", '&apos;': "'", '&rsquo;': '’',
    '&lsquo;': '‘', '&mdash;': '—', '&ndash;': '–',
  };
  s = s.replace(/&[a-z#0-9]+;/gi, (m) => entities[m.toLowerCase()] ?? m);

  // Collapse the whitespace the tags left behind.
  return s.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
}

/** True if the string contains HTML markup (used to decide when to clean). */
export const looksLikeHtml = (s: string | undefined | null): boolean =>
  !!s && /<[a-z/][^>]*>/i.test(s);

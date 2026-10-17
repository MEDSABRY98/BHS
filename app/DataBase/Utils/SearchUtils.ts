// Shared helpers for the DataBase search boxes.
//  - cleanSearch: pasted text often carries invisible characters, non-breaking spaces,
//    line breaks or double spaces, which made a copied phrase match nothing.
//  - searchOrFilters: one PostgREST "or" filter per word (chain .or() = AND between words),
//    values are quoted so commas / brackets typed or pasted in the text cannot break the query.

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF\u00AD]/g;

export function cleanSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchTokens(value: unknown, max = 8): string[] {
  return cleanSearch(value).split(' ').filter(Boolean).slice(0, max);
}

const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** columns must already be PostgREST-safe, e.g. '"CUSTOMER NAME"' or 'TAGS' */
export function searchOrFilters(columns: string[], search: string): string[] {
  return searchTokens(search).map((tok) => columns.map((c) => `${c}.ilike."%${esc(tok)}%"`).join(','));
}

/** client side: every word must appear in at least one of the texts */
export function matchesSearch(texts: unknown[], search: string): boolean {
  const tokens = searchTokens(search);
  if (!tokens.length) return true;
  const hay = texts.map((t) => cleanSearch(t).toLowerCase()).join(' ');
  return tokens.every((t) => hay.includes(t.toLowerCase()));
}

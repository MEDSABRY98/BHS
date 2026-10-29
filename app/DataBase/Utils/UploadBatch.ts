/**
 * Helpers for uploading big Excel files in small batches.
 *
 * Sending the whole file in ONE server call fails on large files: the host rejects big requests
 * (Vercel: ~4.5 MB) and kills long requests (function time limit). Next.js then only shows
 * "An unexpected response was received from the server". So the browser validates the file once
 * and sends it in small batches.
 */

export const UPLOAD_BATCH_SIZE = 1500;

export function chunkRows<T>(rows: T[], size: number = UPLOAD_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * Replaces customer/supplier NAMES with their IDs (same rules the server used before) and
 * returns the entries that do not exist. Rows are changed in place.
 *   idKey   e.g. 'CUSTOMER ID'      nameKey e.g. 'CUSTOMER NAME'
 */
export function resolveReferences(
  rows: any[],
  idKey: string,
  nameKey: string,
  known: { id: string; name: string }[],
): string[] {
  const idMap = new Map<string, string>(); // lower(id) -> id
  const nameMap = new Map<string, string>(); // lower(name) -> id
  for (const k of known) {
    const id = String(k.id ?? '').trim();
    const name = String(k.name ?? '').trim();
    if (!id) continue;
    idMap.set(id.toLowerCase(), id);
    if (name) nameMap.set(name.toLowerCase(), id);
  }

  const invalid = new Set<string>();
  for (const row of rows) {
    const id = row[idKey]?.toString().trim();
    const name = row[nameKey]?.toString().trim();
    if (name) {
      const lower = name.toLowerCase();
      const matched = idMap.get(lower) ?? nameMap.get(lower);
      if (matched) {
        row[idKey] = matched;
        delete row[nameKey];
      } else {
        invalid.add(name);
      }
    } else if (id) {
      const lower = id.toLowerCase();
      const matched = idMap.get(lower) ?? nameMap.get(lower);
      if (matched) row[idKey] = matched;
      else invalid.add(id);
    }
  }
  return Array.from(invalid);
}

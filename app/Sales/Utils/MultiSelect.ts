// Multi-select helpers for the Sales filters.
// A multi-selection is stored in the existing string filter fields, joined with SEP,
// so an empty string still means "no filter" and a single value behaves exactly as before.
export const SEL_SEP = '\u001F';

export function splitSel(value: string | null | undefined): string[] {
  return value ? String(value).split(SEL_SEP).filter(Boolean) : [];
}

export function joinSel(values: string[]): string {
  return values.filter(Boolean).join(SEL_SEP);
}

/** true when no selection is active, or when `itemValue` is one of the selected values */
export function inSel(itemValue: string | null | undefined, selection: string | null | undefined): boolean {
  if (!selection) return true;
  if (!String(selection).includes(SEL_SEP)) return itemValue === selection;
  return splitSel(selection).includes(String(itemValue ?? ''));
}

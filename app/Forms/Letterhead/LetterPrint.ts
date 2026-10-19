'use client';

// Company Letter: prints the letter on a plain white A4 page.
// The top / bottom margins stay empty on EVERY page (repeating table header / footer),
// so the text lands inside the pre-printed letterhead paper.
// @page margin is 0, so the browser has no room to add its own date / URL lines.

export interface LetterMargins {
  top: number; // mm
  bottom: number; // mm
  left: number; // mm
  right: number; // mm
}

export interface LetterSignature {
  id: string;
  name: string;
  title: string;
}

export type SignatureAlign = 'start' | 'center' | 'end';

/** The letterhead space at the top is fixed (the company paper), it can not be changed from the page. */
export const FIXED_TOP_MM = 50;

export const DEFAULT_MARGINS: LetterMargins = { top: FIXED_TOP_MM, bottom: 30, left: 20, right: 20 };

/** Shared look of the letter text, used by the editor on screen and by the printout. */
export const LETTER_CONTENT_CSS = `
.lh-content { font-family: Arial, Tahoma, sans-serif; font-size: 12pt; line-height: 1.5; color: #000; word-wrap: break-word; }
.lh-content p, .lh-content div { margin: 0; }
.lh-content ul { list-style: disc; padding-inline-start: 1.6em; margin: 0.3em 0; }
.lh-content ol { list-style: decimal; padding-inline-start: 1.6em; margin: 0.3em 0; }
.lh-content b, .lh-content strong { font-weight: bold; }
.lh-content i, .lh-content em { font-style: italic; }
.lh-content u { text-decoration: underline; }
.lh-content table { border-collapse: collapse; }
.lh-content td, .lh-content th { border: 1px solid #000; padding: 2px 6px; }
.lh-content hr { border: 0; border-top: 1px solid #000; margin: 0.6em 0; }
.lh-sigs { display: flex; flex-wrap: wrap; gap: 14mm; margin-top: 14mm; break-inside: avoid; page-break-inside: avoid; }
.lh-sig { min-width: 55mm; text-align: center; break-inside: avoid; page-break-inside: avoid; }
.lh-sig-space { height: 16mm; }
.lh-sig-line { border-top: 1px solid #000; margin-bottom: 2mm; }
.lh-sig-name { font-weight: bold; }
.lh-sig-title { font-size: 0.92em; }
`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const JUSTIFY: Record<SignatureAlign, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };

export function signaturesHtml(signatures: LetterSignature[], align: SignatureAlign): string {
  const list = signatures.filter((s) => s.name.trim() || s.title.trim());
  if (!list.length) return '';
  return `<div class="lh-sigs" style="justify-content:${JUSTIFY[align]}">${list
    .map(
      (s) =>
        `<div class="lh-sig"><div class="lh-sig-space"></div><div class="lh-sig-line"></div>` +
        `<div class="lh-sig-name">${esc(s.name.trim())}</div>` +
        (s.title.trim() ? `<div class="lh-sig-title">${esc(s.title.trim())}</div>` : '') +
        `</div>`,
    )
    .join('')}</div>`;
}

export interface LetterPrintOptions {
  html: string;
  dir: 'rtl' | 'ltr';
  margins: LetterMargins;
  signatures: LetterSignature[];
  signatureAlign: SignatureAlign;
  title?: string;
}

/** The full printable page (plain white A4). */
export function buildLetterDocument(opts: LetterPrintOptions): string {
  const { html, dir, margins, signatures, signatureAlign } = opts;
  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${esc(opts.title || 'Letter')}</title>
<style>
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
body { padding: 0 ${margins.right}mm 0 ${margins.left}mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
table.lh-frame { width: 100%; border-collapse: collapse; }
/* signatures sit at the bottom of the last page, like on screen */
.lh-page { display: flex; flex-direction: column; }
.lh-page > .lh-sigs { margin-top: auto; padding-top: 14mm; }
table.lh-frame > thead > tr > td, table.lh-frame > tfoot > tr > td, table.lh-frame > tbody > tr > td { padding: 0; border: 0; }
${LETTER_CONTENT_CSS}
</style></head><body>
<table class="lh-frame">
<thead><tr><td><div style="height:${margins.top}mm"></div></td></tr></thead>
<tfoot><tr><td><div style="height:${margins.bottom}mm"></div></td></tr></tfoot>
<tbody><tr><td><div class="lh-content lh-page" style="min-height:${Math.max(297 - margins.top - margins.bottom, 20)}mm">
<div class="lh-text">${html}</div>${signaturesHtml(signatures, signatureAlign)}
</div></td></tr></tbody>
</table>
</body></html>`;
}

export function printLetter(opts: LetterPrintOptions): void {
  const doc = buildLetterDocument(opts);
  const iframe = document.createElement('iframe');
  // A4 sized but off screen, so the text wraps exactly like on paper and can be measured
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const idoc = iframe.contentDocument;
  if (!win || !idoc) {
    iframe.remove();
    return;
  }
  idoc.open();
  idoc.write(doc);
  idoc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  const go = () => {
    fitToPages(idoc, opts.margins);
    win.focus();
    win.onafterprint = cleanup;
    win.print();
    setTimeout(() => iframe.isConnected && iframe.remove(), 300000);
  };
  const fonts = (idoc as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) fonts.ready.then(() => setTimeout(go, 50)).catch(go);
  else setTimeout(go, 200);
}

/**
 * Long letters: stretch the letter to fill whole pages so the signatures land at the bottom
 * of the LAST page. A small allowance per page covers the lines the printer moves to the next page.
 */
export function fitToPages(doc: Document, margins: LetterMargins): void {
  const page = doc.querySelector<HTMLElement>('.lh-page');
  if (!page) return;
  const pxPerMm = 96 / 25.4;
  const pageMm = Math.max(297 - margins.top - margins.bottom, 20);
  page.style.minHeight = '0';
  const usedMm = page.getBoundingClientRect().height / pxPerMm;
  const pages = Math.max(1, Math.ceil((usedMm + 8) / pageMm));
  const allowance = (pages - 1) * 8; // mm lost at each page break
  page.style.minHeight = `${pages * pageMm - allowance}mm`;
}

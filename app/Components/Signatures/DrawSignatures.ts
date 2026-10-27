// Signatures on a jsPDF page — the same look in every PDF.
// Each box: position (bold), name, a line to sign on, "Signature & Date".
// Up to 4 boxes per row (5 on a landscape page); a short last row is centred.
// Nothing is drawn when no one was chosen.

import type { Signer } from './SignatureTypes';

const AR = /[؀-ۿ]/;
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const GOLD: [number, number, number] = [196, 160, 82];

export const SIGNATURE_ROW_HEIGHT = 32;

interface DrawOptions {
  /** where the part may start (just under the content) */
  y: number;
  margin: number;
  /** true = pushed to the bottom of the page (as the old signatures were); false = right under the content */
  bottom?: boolean;
  /** a small heading above the boxes, e.g. "Approvals" (none when empty) */
  heading?: string;
  /** space kept free at the bottom of the page (page numbers) */
  footer?: number;
}

/** Height the signatures need (0 when nobody signs). */
export function signaturesHeight(doc: any, signers: Signer[], heading = ''): number {
  if (!signers.length) return 0;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const perRow = w > h ? 5 : 4;
  return Math.ceil(signers.length / perRow) * SIGNATURE_ROW_HEIGHT + (heading ? 9 : 0);
}

/** Draws the signatures; returns the y under them (the given y when nobody signs). */
export function drawSignatures(doc: any, signers: Signer[], opts: DrawOptions): number {
  if (!signers.length) return opts.y;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = opts.margin;
  const footer = opts.footer ?? 18;
  const perRow = W > H ? 5 : 4;
  const need = signaturesHeight(doc, signers, opts.heading);

  let y = opts.bottom ? Math.max(opts.y + 10, H - footer - need) : opts.y + 6;
  if (y + need > H - footer) {
    doc.addPage();
    y = opts.bottom ? H - footer - need : 24;
  }

  if (opts.heading) {
    doc.setFillColor(...GOLD);
    doc.rect(M, y - 3.6, 1.6, 4.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(opts.heading, M + 4, y);
    y += 9;
  }

  const gap = 8;
  const rows = Math.ceil(signers.length / perRow);
  const colW = (W - M * 2 - gap * (perRow - 1)) / perRow;
  const prevFont = doc.getFont?.()?.fontName;

  for (let r = 0; r < rows; r++) {
    const row = signers.slice(r * perRow, r * perRow + perRow);
    // fewer boxes than the row holds: wider boxes, centred
    const n = row.length;
    const boxW = n < perRow ? Math.min(colW * 1.4, (W - M * 2 - gap * (n - 1)) / n) : colW;
    const total = n * boxW + gap * (n - 1);
    const x0 = M + (W - M * 2 - total) / 2;
    const top = y + r * SIGNATURE_ROW_HEIGHT;
    row.forEach((s, i) => {
      const x = x0 + i * (boxW + gap);
      const cx = x + boxW / 2;
      // position
      doc.setFont(AR.test(s.title) ? 'Amiri' : 'helvetica', AR.test(s.title) ? 'normal' : 'bold');
      doc.setFontSize(8.6);
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(s.title || ' ', boxW)[0], cx, top, { align: 'center' });
      // name
      if (s.name) {
        doc.setFont(AR.test(s.name) ? 'Amiri' : 'helvetica', 'normal');
        doc.setFontSize(8.4);
        doc.setTextColor(...MUTED);
        doc.text(doc.splitTextToSize(s.name, boxW)[0], cx, top + 4.6, { align: 'center' });
      }
      // signature image (optional)
      if (s.image) {
        try {
          doc.addImage(s.image, 'PNG', cx - 18, top + 6, 36, 12);
        } catch {
          // a broken image is left out
        }
      }
      // the line + caption
      doc.setDrawColor(...INK);
      doc.setLineWidth(0.3);
      doc.line(x + 3, top + 19, x + boxW - 3, top + 19);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...MUTED);
      doc.text('Signature & Date', cx, top + 23.5, { align: 'center' });
    });
  }
  if (prevFont) {
    try {
      doc.setFont(prevFont, 'normal');
    } catch {
      // ignore
    }
  }
  return y + rows * SIGNATURE_ROW_HEIGHT;
}

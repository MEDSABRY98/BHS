'use client';

// File Labels: builds an A4 sheet of spine labels and opens the print dialog.
// Every label is drawn at its real size (cm -> mm); the name is fitted to the label
// (as big as possible, one line, along the length). Print at 100% / Actual size.

export interface LabelSize {
  id: string;
  name: string;
  width: number; // cm (the short side, across the spine)
  length: number; // cm (the long side, along the spine)
}

export interface LabelRow {
  id: string;
  text: string;
  sizeId: string;
  copies: number;
}

export interface LabelPrintOptions {
  sizes: LabelSize[];
  rows: LabelRow[];
  cutLines: boolean;
  font: string;
  bold: boolean;
}

const PAD_MM = 3; // empty space kept inside every label
const GAP_MM = 3; // space between labels (for cutting)
const PAGE_MARGIN_MM = 10;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const fontStack = (font: string) => `'${font.replace(/'/g, '')}', 'Cairo', Tahoma, Arial, sans-serif`;

/** Labels that will be printed (empty names skipped, copies expanded). */
export function expandLabels(opts: Pick<LabelPrintOptions, 'sizes' | 'rows'>) {
  const byId = new Map(opts.sizes.map((s) => [s.id, s]));
  const out: { text: string; size: LabelSize }[] = [];
  for (const r of opts.rows) {
    const text = r.text.trim();
    const size = byId.get(r.sizeId) || opts.sizes[0];
    if (!text || !size) continue;
    const copies = Math.min(Math.max(Math.round(r.copies) || 1, 1), 99);
    for (let i = 0; i < copies; i++) out.push({ text, size });
  }
  return out;
}

function buildDocument(opts: LabelPrintOptions): string {
  const labels = expandLabels(opts)
    .map(
      ({ text, size }) =>
        `<div class="label${opts.cutLines ? ' cut' : ''}" style="width:${size.length * 10}mm;height:${size.width * 10}mm" data-w="${size.length * 10}" data-h="${size.width * 10}"><span dir="auto">${esc(text)}</span></div>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>File Labels</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;800&display=swap">
<style>
@page { size: A4 portrait; margin: ${PAGE_MARGIN_MM}mm; }
html, body { margin: 0; padding: 0; background: #fff; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { display: flex; flex-wrap: wrap; gap: ${GAP_MM}mm; align-content: flex-start; justify-content: center; } /* labels centred on the page */
.label { display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff; color: #000;
  break-inside: avoid; page-break-inside: avoid; box-sizing: border-box; }
.label.cut { outline: 0.3mm dashed #888; outline-offset: 0; }
.label span { display: inline-block; white-space: nowrap; line-height: 1; font-family: ${fontStack(opts.font)}; font-weight: ${opts.bold ? 800 : 600}; }
</style></head><body><div class="sheet">${labels}</div></body></html>`;
}

/**
 * Biggest font size (mm) so the text fits the label on one line, then the INK of the letters
 * (not the font box) is moved to the exact middle of the label - letters like "ى" or "g" that go
 * below the line would otherwise look too low.
 */
function fitLabels(doc: Document, opts: LabelPrintOptions) {
  const ctx = doc.createElement('canvas').getContext('2d');
  if (!ctx) return;
  ctx.font = `${opts.bold ? 800 : 600} 100px ${fontStack(opts.font)}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  doc.querySelectorAll<HTMLElement>('.label').forEach((el) => {
    const span = el.querySelector('span');
    if (!span) return;
    const L = Number(el.dataset.w) || 0;
    const W = Number(el.dataset.h) || 0;
    const m = ctx.measureText(span.textContent || '');
    // ink box around the baseline / start point (100px font)
    const left = m.actualBoundingBoxLeft || 0;
    const right = m.actualBoundingBoxRight || m.width;
    const asc = m.actualBoundingBoxAscent || 70;
    const desc = m.actualBoundingBoxDescent || 20;
    const inkW = Math.max(left + right, 1);
    const inkH = Math.max(asc + desc, 1);
    let size = Math.max(Math.min(((L - 2 * PAD_MM) * 100) / inkW, ((W - 2 * PAD_MM) * 100) / inkH), 0.5);

    // where the browser puts the text: line box = 1em (line-height 1), baseline after the half leading
    const fAsc = m.fontBoundingBoxAscent;
    const fDesc = m.fontBoundingBoxDescent;
    const apply = (s: number) => {
      const k = s / 100; // px at 100px -> mm at this size
      let dy = 0;
      if (fAsc !== undefined && fDesc !== undefined) {
        const baseline = (100 - (fAsc + fDesc)) / 2 + fAsc; // from the top of the line box
        const inkMiddle = baseline + (desc - asc) / 2;
        dy = (50 - inkMiddle) * k;
      }
      const dx = (m.width / 2 - (right - left) / 2) * k;
      span.style.fontSize = `${s.toFixed(3)}mm`;
      span.style.transform = `translate(${dx.toFixed(3)}mm, ${dy.toFixed(3)}mm)`;
    };
    apply(size);

    // safety net: check the width the browser really drew (fallback fonts, very long names ...) and shrink
    // until the text is inside the label. The height is already exact (measured on the letters themselves).
    const pxPerMm = el.clientWidth / L || 0;
    if (pxPerMm > 0) {
      const maxW = (L - 2 * PAD_MM) * pxPerMm;
      for (let i = 0; i < 6; i++) {
        const box = span.getBoundingClientRect();
        const lab = el.getBoundingClientRect();
        const outside = box.left < lab.left - 0.5 || box.right > lab.right + 0.5;
        if (box.width <= maxW + 0.5 && !outside) break;
        size = Math.max(size * Math.min(maxW / Math.max(box.width, 1), 0.97), 0.5);
        apply(size);
      }
    }
  });
}

export function printFileLabels(opts: LabelPrintOptions): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const idoc = iframe.contentDocument;
  if (!win || !idoc) {
    iframe.remove();
    return;
  }
  idoc.open();
  idoc.write(buildDocument(opts));
  idoc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    fitLabels(idoc, opts);
    win.focus();
    win.onafterprint = cleanup;
    win.print();
    setTimeout(() => iframe.isConnected && iframe.remove(), 300000);
  };
  const fonts = (idoc as Document & { fonts?: FontFaceSet }).fonts;
  const family = opts.font.replace(/'/g, '');
  // wait for the stylesheet + web font (Cairo) so the size is measured with the real letters; never more than 4s
  setTimeout(go, 4000);
  const waitFont = () => {
    if (!fonts?.load) return setTimeout(go, 300);
    fonts
      .load(`${opts.bold ? 800 : 600} 20px '${family}'`)
      .then(() => fonts.ready)
      .then(() => setTimeout(go, 50))
      .catch(go);
  };
  const started = Date.now();
  const waitLoad = () => {
    if (idoc.readyState === 'complete' || Date.now() - started > 3000) waitFont();
    else setTimeout(waitLoad, 50);
  };
  waitLoad();
}

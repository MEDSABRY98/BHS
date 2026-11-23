'use client';

// One ZIP with a statement PDF for every supplier (same PDF as the supplier's own statement button).
// The Arabic font is downloaded once and reused for all the PDFs.

import type { SupplierRecord, SupplierTransaction } from '../../Service/suppliers_service';
import { buildSupplierStatement, safeFileName } from './StatementData';
import { buildSupplierStatementDoc } from './StatementPdfCore';

const FONT_URLS = [
  'https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf',
];

async function loadFontBase64(): Promise<string> {
  for (const url of FONT_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    } catch (e) {
      console.warn(`Failed to load font from ${url}`, e);
    }
  }
  throw new Error('Failed to load the Arabic font');
}

export interface StatementsZipResult {
  blob: Blob;
  files: number;
  skipped: number;
}

export async function generateSuppliersStatementsZip(
  suppliers: SupplierRecord[],
  transactions: SupplierTransaction[],
  filterType: 'all' | 'open' | 'closed',
  year: string,
  month: string,
  onProgress?: (done: number, total: number, name: string) => void
): Promise<StatementsZipResult> {
  const [{ default: JSZip }, fontBase64] = await Promise.all([import('jszip'), loadFontBase64()]);
  const addFont = async (doc: any) => {
    doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');
  };

  const zip = new JSZip();
  const used = new Set<string>();
  let files = 0;
  let skipped = 0;

  for (let i = 0; i < suppliers.length; i++) {
    const s = suppliers[i];
    const id = s['SUPPLIER ID'];
    const name = String(s['SUPPLIER NAME'] || id);
    onProgress?.(i + 1, suppliers.length, name);

    const rows = buildSupplierStatement(id, transactions, filterType, year, month);
    if (!rows.length) { skipped++; continue; }

    const doc = await buildSupplierStatementDoc(name, rows, addFont);
    let file = safeFileName(name);
    for (let n = 2; used.has(file.toLowerCase()); n++) file = `${safeFileName(name)} (${n})`;
    used.add(file.toLowerCase());
    zip.file(`${file}_Statement.pdf`, doc.output('blob'));
    files++;
    await new Promise((r) => setTimeout(r, 0)); // let the page breathe
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, files, skipped };
}

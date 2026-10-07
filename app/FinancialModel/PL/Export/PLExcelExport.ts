import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';

/**
 * Styled P&L Excel export that mirrors the on-screen Income Statement design
 * (dark header, section pills, accent borders, category groups, profit rows, margins).
 */

export type PLSectionKey =
  | 'REVENUE'
  | 'COGS'
  | 'DIRECT_EXPENSE'
  | 'INDIRECT_EXPENSE'
  | 'DEPRECIATION'
  | 'FINANCE_COST'
  | 'TAXES';

export type PLExportRow =
  | { kind: 'pill'; label: string; section: PLSectionKey }
  | { kind: 'account'; label: string; section: PLSectionKey; values: number[]; total: number; isForecast?: boolean; percent?: boolean }
  | { kind: 'categoryHeader'; label: string; section: PLSectionKey; count: number }
  | { kind: 'categoryTotal'; label: string; section: PLSectionKey; values: number[]; total: number; percent?: boolean }
  | { kind: 'sectionTotal'; label: string; section: PLSectionKey; values: number[]; total: number; percent?: boolean }
  | { kind: 'profit'; label: string; values: number[]; total: number; isNet?: boolean; percent?: boolean }
  | { kind: 'margin'; label: string; values: number[]; total: number; isNet?: boolean }
  | { kind: 'spacer' };

export interface PLExportOptions {
  title: string;
  subtitle: string;
  monthLabels: string[];
  rows: PLExportRow[];
  fileName: string;
}

const C = {
  black: 'FF0F0F0F',
  black2: 'FF1A1A1A',
  gold: 'FFD4AF37',
  goldDark: 'FFB8952B',
  goldSoft: 'FFFBF8EE',
  goldSoft2: 'FFF7F1DC',
  white: 'FFFFFFFF',
  slate50: 'FFF8FAFC',
  slate100: 'FFF1F5F9',
  slate200: 'FFE2E8F0',
  slate300: 'FFCBD5E1',
  slate400: 'FF94A3B8',
  slate500: 'FF64748B',
  slate700: 'FF334155',
  slate800: 'FF1E293B',
  blue50: 'FFEFF6FF',
  blue600: 'FF2563EB',
  red400: 'FFF87171',
};

const SECTION_STYLE: Record<PLSectionKey, { accent: string; pillBg: string; pillText: string; totalBg: string; totalText: string }> = {
  REVENUE:          { accent: 'FF34D399', pillBg: 'FFECFDF5', pillText: 'FF047857', totalBg: 'FFECFDF5', totalText: 'FF065F46' },
  COGS:             { accent: 'FFF87171', pillBg: 'FFFEF2F2', pillText: 'FFB91C1C', totalBg: 'FFFEF2F2', totalText: 'FF991B1B' },
  DIRECT_EXPENSE:   { accent: 'FFFB923C', pillBg: 'FFFFF7ED', pillText: 'FFC2410C', totalBg: 'FFFFF7ED', totalText: 'FF9A3412' },
  INDIRECT_EXPENSE: { accent: 'FFFACC15', pillBg: 'FFFEFCE8', pillText: 'FFA16207', totalBg: 'FFFEFCE8', totalText: 'FF854D0E' },
  DEPRECIATION:     { accent: 'FF94A3B8', pillBg: 'FFF1F5F9', pillText: 'FF475569', totalBg: 'FFF8FAFC', totalText: 'FF334155' },
  FINANCE_COST:     { accent: 'FF60A5FA', pillBg: 'FFEFF6FF', pillText: 'FF1D4ED8', totalBg: 'FFEFF6FF', totalText: 'FF1E40AF' },
  TAXES:            { accent: 'FFC084FC', pillBg: 'FFFAF5FF', pillText: 'FF7E22CE', totalBg: 'FFFAF5FF', totalText: 'FF6B21A8' },
};

const NUM_FMT = '#,##0.00;[Red]-#,##0.00;"–"';
const PCT_FMT = '0.0%;[Red]-0.0%;"0.0%"';

export async function exportPLToExcel({ title, subtitle, monthLabels, rows, fileName }: PLExportOptions) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BHS';
  wb.created = new Date();

  const ws = wb.addWorksheet('P&L', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  });

  const colCount = monthLabels.length + 2;
  ws.columns = [
    { width: 42 },
    ...monthLabels.map(() => ({ width: 15 })),
    { width: 18 },
  ];

  type BorderSpec = { style: 'thin' | 'medium' | 'thick'; color: { argb: string } };
  const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
  const thin = (argb: string): BorderSpec => ({ style: 'thin', color: { argb } });
  const medium = (argb: string): BorderSpec => ({ style: 'medium', color: { argb } });
  const thick = (argb: string): BorderSpec => ({ style: 'thick', color: { argb } });

  // ---- Title block ----
  ws.mergeCells(1, 1, 1, colCount);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: 'Calibri', size: 18, bold: true, color: { argb: C.white } };
  t.fill = fill(C.black);
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 34;

  ws.mergeCells(2, 1, 2, colCount);
  const st = ws.getCell(2, 1);
  st.value = subtitle;
  st.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.gold } };
  st.fill = fill(C.black);
  st.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  st.border = { bottom: medium(C.gold) };
  ws.getRow(2).height = 22;

  ws.getRow(3).height = 8;

  // ---- Table header ----
  const header = ws.getRow(4);
  header.values = ['ACCOUNT', ...monthLabels.map(m => m.toUpperCase()), 'TOTAL'];
  header.height = 28;
  header.eachCell((cell, col) => {
    cell.fill = fill(C.black);
    cell.font = { bold: true, size: 11, color: { argb: col === colCount ? C.gold : C.slate300 } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: medium(C.gold) };
  });

  const writeValues = (rowIdx: number, values: number[], total: number, percent?: boolean) => {
    const r = ws.getRow(rowIdx);
    values.forEach((v, i) => {
      const c = r.getCell(i + 2);
      c.value = v;
      c.numFmt = percent ? PCT_FMT : NUM_FMT;
    });
    const tc = r.getCell(colCount);
    tc.value = total;
    tc.numFmt = percent ? PCT_FMT : NUM_FMT;
  };

  const styleRow = (
    rowIdx: number,
    opts: {
      bg: string;
      totalBg?: string;
      labelFont: Partial<import('exceljs').Font>;
      valueFont: Partial<import('exceljs').Font>;
      totalFont?: Partial<import('exceljs').Font>;
      accent?: string;
      top?: BorderSpec;
      bottom?: BorderSpec;
      height?: number;
    }
  ) => {
    const r = ws.getRow(rowIdx);
    if (opts.height) r.height = opts.height;
    for (let col = 1; col <= colCount; col++) {
      const c = r.getCell(col);
      const isLabel = col === 1;
      const isTotal = col === colCount;
      c.fill = fill(isTotal && opts.totalBg ? opts.totalBg : opts.bg);
      c.font = isLabel ? opts.labelFont : isTotal ? (opts.totalFont || opts.valueFont) : opts.valueFont;
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = {
        top: opts.top,
        bottom: opts.bottom || thin(C.slate100),
        left: isLabel && opts.accent ? thick(opts.accent) : undefined,
        right: isLabel || col === colCount - 1 ? thin(C.slate200) : undefined,
      };
    }
  };

  let rowIdx = 5;
  for (const row of rows) {
    const r = ws.getRow(rowIdx);
    switch (row.kind) {
      case 'spacer': {
        r.height = 8;
        break;
      }
      case 'pill': {
        const s = SECTION_STYLE[row.section];
        ws.mergeCells(rowIdx, 1, rowIdx, colCount);
        const c = r.getCell(1);
        c.value = `  ${row.label.toUpperCase()}  `;
        c.font = { bold: true, size: 10, color: { argb: s.pillText } };
        c.fill = fill(s.pillBg);
        c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        c.border = { left: thick(s.accent), bottom: thin(s.accent) };
        r.height = 24;
        break;
      }
      case 'categoryHeader': {
        ws.mergeCells(rowIdx, 1, rowIdx, colCount);
        const c = r.getCell(1);
        c.value = `${row.label.toUpperCase()}   (${row.count})`;
        c.font = { bold: true, size: 10, color: { argb: C.slate700 } };
        c.fill = fill(C.slate100);
        c.alignment = { vertical: 'middle', horizontal: 'left', indent: 2 };
        c.border = { left: thick(C.gold), top: thin(C.slate200), bottom: thin(C.slate200) };
        r.height = 22;
        break;
      }
      case 'account': {
        const s = SECTION_STYLE[row.section];
        r.getCell(1).value = row.label;
        writeValues(rowIdx, row.values, row.total, row.percent);
        styleRow(rowIdx, {
          bg: row.isForecast === undefined ? C.white : C.white,
          totalBg: row.isForecast ? C.blue50 : C.slate50,
          labelFont: { bold: true, size: 11, color: { argb: C.slate700 } },
          valueFont: { size: 12, color: { argb: row.isForecast ? C.blue600 : C.slate800 } },
          totalFont: { bold: true, size: 12, color: { argb: row.isForecast ? C.blue600 : C.slate800 } },
          accent: s.accent,
          height: 22,
        });
        break;
      }
      case 'categoryTotal': {
        const s = SECTION_STYLE[row.section];
        r.getCell(1).value = `TOTAL  ${row.label}`;
        writeValues(rowIdx, row.values, row.total, row.percent);
        styleRow(rowIdx, {
          bg: C.goldSoft,
          totalBg: C.goldSoft2,
          labelFont: { bold: true, size: 11, color: { argb: C.goldDark } },
          valueFont: { bold: true, size: 11, color: { argb: C.slate800 } },
          totalFont: { bold: true, size: 11, color: { argb: 'FF0F172A' } },
          accent: s.accent,
          bottom: medium('FFE9D9A3'),
          height: 22,
        });
        break;
      }
      case 'sectionTotal': {
        const s = SECTION_STYLE[row.section];
        r.getCell(1).value = `TOTAL ${row.label.toUpperCase()}`;
        writeValues(rowIdx, row.values, row.total, row.percent);
        styleRow(rowIdx, {
          bg: s.totalBg,
          labelFont: { bold: true, size: 11, color: { argb: s.totalText } },
          valueFont: { bold: true, size: 11, color: { argb: s.totalText } },
          accent: s.accent,
          bottom: thin(C.slate200),
          height: 24,
        });
        break;
      }
      case 'profit': {
        r.getCell(1).value = row.label.toUpperCase();
        writeValues(rowIdx, row.values, row.total, row.percent);
        if (row.isNet) {
          styleRow(rowIdx, {
            bg: C.black,
            totalBg: C.black2,
            labelFont: { bold: true, size: 12, color: { argb: C.white } },
            valueFont: { bold: true, size: 12, color: { argb: C.gold } },
            totalFont: { bold: true, size: 13, color: { argb: C.gold } },
            top: thick(C.gold),
            bottom: thin(C.black),
            height: 30,
          });
          // red for negatives on dark background
          for (let col = 2; col <= colCount; col++) {
            const c = r.getCell(col);
            if (typeof c.value === 'number' && c.value < 0) c.font = { ...c.font, color: { argb: C.red400 } };
            c.numFmt = row.percent ? '0.0%;-0.0%;"0.0%"' : '#,##0.00;-#,##0.00;"–"';
          }
        } else {
          styleRow(rowIdx, {
            bg: C.slate100,
            totalBg: C.slate200,
            labelFont: { bold: true, size: 12, color: { argb: C.slate800 } },
            valueFont: { bold: true, size: 12, color: { argb: C.slate800 } },
            totalFont: { bold: true, size: 12, color: { argb: 'FF0F172A' } },
            top: medium(C.slate300),
            height: 28,
          });
        }
        break;
      }
      case 'margin': {
        r.getCell(1).value = row.label.toUpperCase();
        writeValues(rowIdx, row.values, row.total, true);
        styleRow(rowIdx, {
          bg: row.isNet ? C.black2 : C.slate100,
          totalBg: row.isNet ? 'FF222222' : C.slate200,
          labelFont: { bold: true, italic: true, size: 11, color: { argb: row.isNet ? C.gold : C.slate500 } },
          valueFont: { bold: true, italic: true, size: 11, color: { argb: row.isNet ? C.gold : C.slate500 } },
          top: thin(row.isNet ? 'FF4A3F1A' : C.slate200),
          height: 22,
        });
        break;
      }
    }
    rowIdx++;
  }

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveTrackedAs(blob, fileName);
}

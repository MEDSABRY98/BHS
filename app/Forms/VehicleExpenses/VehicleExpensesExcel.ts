'use client';

// Vehicle Expenses form — Excel template and reading the uploaded file (browser only).
// Columns: Vehicle No, Driver Name, Fuel, Maintenance.

import ExcelJS from 'exceljs';
import { saveTrackedAs } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { cleanText, round2, type VehicleExpenseLine } from './VehicleExpensesTypes';

// Same look as the other BHS Excel exports
const HEADER_FILL = 'FF000000';
const HEADER_TEXT = 'FFFFFFFF';
const GOLD_BORDER = 'FFC9A84C';
const NUM_FMT = '#,##0.00;-#,##0.00;"-"';

type ReadField = keyof VehicleExpenseLine;
const HEADER_ALIASES: Record<ReadField, string[]> = {
  VEHICLE: ['vehicleno', 'vehiclenumber', 'vehicle', 'carno', 'carnumber', 'car', 'plateno', 'platenumber', 'plate', 'رقمالسيارة', 'السيارة'],
  DRIVER: ['drivername', 'driver', 'اسمالسائق', 'السائق'],
  FUEL: ['fuel', 'petrol', 'fuelamount', 'بترول', 'البترول', 'بنزين', 'البنزين', 'قيمةالبترول'],
  MAINTENANCE: ['maintenance', 'maintenanceamount', 'repair', 'repairs', 'صيانة', 'الصيانة', 'قيمةالصيانة'],
};

// Arabic letters are kept so Arabic headers also match
function headerKey(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');
}

/** The empty template. */
export async function downloadVehicleExpensesTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BHS Analysis';
  const ws = wb.addWorksheet('Vehicles', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws.columns = [
    { header: 'Vehicle No', key: 'vehicle', width: 18 },
    { header: 'Driver Name', key: 'driver', width: 32 },
    { header: 'Fuel', key: 'fuel', width: 16 },
    { header: 'Maintenance', key: 'maintenance', width: 16 },
  ];
  const header = ws.getRow(1);
  header.height = 25;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD_BORDER } } };
  });
  for (let r = 2; r <= 200; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 4; c++) row.getCell(c).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    row.getCell(3).numFmt = NUM_FMT;
    row.getCell(4).numFmt = NUM_FMT;
  }
  ws.autoFilter = { from: 'A1', to: 'D1' };
  const buffer = await wb.xlsx.writeBuffer();
  saveTrackedAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Vehicle_Expenses_Template.xlsx');
}

// ─────────────────────────────────────────────────────────────
//  Upload: read the file
// ─────────────────────────────────────────────────────────────
function cellPlain(value: any): any {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) return cellPlain(value.result); // formula
    if (Array.isArray(value.richText)) return value.richText.map((p: any) => p.text).join('');
    if ('text' in value) return value.text; // hyperlink
    if ('error' in value) return null;
  }
  return value;
}

function toAmount(raw: any): number | null {
  const v = cellPlain(raw);
  if (v === null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? round2(v) : null;
  const s = cleanText(v).replace(/,/g, '');
  if (!s || s === '-') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}

function toText(raw: any): string {
  return cleanText(cellPlain(raw));
}

export interface ParsedExcel {
  lines: (VehicleExpenseLine & { ROW: number })[];
  errors: { row: number; message: string }[];
  sheetName: string;
}

export async function readVehicleExpensesFile(file: File): Promise<ParsedExcel> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  // First sheet that has a header row with the vehicle and at least one amount column
  for (const ws of wb.worksheets) {
    let headerRow = 0;
    let cols: Partial<Record<ReadField, number>> = {};

    for (let r = 1; r <= Math.min(ws.rowCount, 15) && !headerRow; r++) {
      const found: Partial<Record<ReadField, number>> = {};
      ws.getRow(r).eachCell((cell, col) => {
        const key = headerKey(cellPlain(cell.value));
        (Object.keys(HEADER_ALIASES) as ReadField[]).forEach((field) => {
          if (found[field] === undefined && HEADER_ALIASES[field].includes(key)) found[field] = col;
        });
      });
      if (found.VEHICLE && (found.FUEL || found.MAINTENANCE)) {
        headerRow = r;
        cols = found;
      }
    }
    if (!headerRow) continue;

    const lines: ParsedExcel['lines'] = [];
    const errors: ParsedExcel['errors'] = [];
    const get = (row: ExcelJS.Row, field: ReadField) => (cols[field] ? row.getCell(cols[field]!).value : null);

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const vehicle = toText(get(row, 'VEHICLE'));
      const driver = toText(get(row, 'DRIVER'));
      const fuel = toAmount(get(row, 'FUEL'));
      const maintenance = toAmount(get(row, 'MAINTENANCE'));

      // empty rows are skipped; a "Total" row is skipped too
      if (!vehicle && !driver && !fuel && !maintenance) continue;
      if (/^(total|الاجمالي|الإجمالي|المجموع)$/i.test(vehicle || driver)) continue;

      if (!vehicle) { errors.push({ row: r, message: 'Missing vehicle number' }); continue; }
      if (fuel === null || maintenance === null) { errors.push({ row: r, message: 'Fuel / Maintenance is not a number' }); continue; }
      if (fuel < 0 || maintenance < 0) { errors.push({ row: r, message: 'Negative amount' }); continue; }
      if (fuel === 0 && maintenance === 0) { errors.push({ row: r, message: 'Fuel and maintenance are both zero' }); continue; }

      lines.push({ ROW: r, VEHICLE: vehicle, DRIVER: driver, FUEL: fuel, MAINTENANCE: maintenance });
    }
    return { lines, errors, sheetName: ws.name };
  }

  throw new Error('No sheet with the columns Vehicle No and Fuel / Maintenance was found');
}

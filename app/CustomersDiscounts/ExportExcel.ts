import { saveAs } from 'file-saver';
import { bhs_supabase, fetchAllData } from "@/lib/supabase";
import { parseSettlementId } from "./Utils/settlementUtils";
import type { Worksheet } from 'exceljs';

const GOLD_BORDER = 'FFC9A84C';
const LIGHT_ROW_BORDER = 'FFEEEEEE';
const NEGATIVE_FILL = 'FFFEF2F2';
const NEGATIVE_TEXT = 'FFB91C1C';
const NUM_FMT = '#,##0.00';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Discount = {
  id: string;
  name: string;
  type: string;
  value: number;
};

type CustomerView = {
  customerId: string;
  customerName: string;
  city: string;
  discounts: Discount[];
};

type SettlementEntry = {
  id: string;
  status: string;
};

type MonthColumn = {
  key: string;
  year: number;
  month: number;
};

function getPendingDiscountLabel(
  settlement: SettlementEntry,
  discounts: Discount[]
): string {
  const parsed = parseSettlementId(settlement.id);
  const discountId = parsed?.discountId;
  const discount = discounts.find((d) => d.id === discountId);
  return discount?.name || discountId || "Unknown";
}

function getMonthCellValue(
  monthSettlements: SettlementEntry[],
  discounts: Discount[]
): string {
  if (monthSettlements.length === 0) return "-";

  const pending = monthSettlements.filter((s) => s.status === "Pending");
  if (pending.length === 0) return "✔";
  if (pending.length === monthSettlements.length) return "X";

  return pending.map((s) => getPendingDiscountLabel(s, discounts)).join(", ");
}

function isNegativeMonthCell(value: unknown): boolean {
  return value === "X" || (typeof value === "string" && value !== "✔" && value !== "-");
}

function formatShortMonth(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1]}-${String(year).slice(-2)}`;
}

function getMaxMonthForYear(year: number): number {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  if (year > currentYear) return 0;
  if (year === currentYear) return currentMonth;
  return 12;
}

function buildMonthColumns(years: number[], useShortLabels: boolean): MonthColumn[] {
  const columns: MonthColumn[] = [];

  for (const year of years) {
    const maxMonth = getMaxMonthForYear(year);
    for (let month = 1; month <= maxMonth; month++) {
      columns.push({
        key: useShortLabels ? formatShortMonth(year, month) : MONTH_NAMES[month - 1],
        year,
        month,
      });
    }
  }

  return columns;
}

function buildCustomerRows(
  filteredCustomers: CustomerView[],
  monthColumns: MonthColumn[],
  settlementsByYear: Record<number, Record<string, Record<number, SettlementEntry[]>>>
): Record<string, string | number>[] {
  return filteredCustomers.map((customer, index) => {
    const row: Record<string, string | number> = {
      "#": index + 1,
      "Customer Name": customer.customerName,
    };

    let totalDiscount = 0;
    let totalRent = 0;
    customer.discounts.forEach((d) => {
      if (d.type === "percentage") {
        totalDiscount += Number(d.value) || 0;
      } else {
        totalRent += Number(d.value) || 0;
      }
    });

    row["Discount (%)"] = totalDiscount > 0 ? totalDiscount : 0;
    row["Rent (AED)"] = totalRent > 0 ? totalRent : 0;

    const customerSettlementsByYear = settlementsByYear;

    for (const col of monthColumns) {
      const customerKey = String(customer.customerId || "").trim();
      const yearSettlements = customerSettlementsByYear[col.year]?.[customerKey] || {};
      const monthSettlements = yearSettlements[col.month] || [];
      row[col.key] = getMonthCellValue(monthSettlements, customer.discounts);
    }

    return row;
  });
}

function buildColumnKeys(monthColumns: MonthColumn[]): string[] {
  return ["#", "Customer Name", "Discount (%)", "Rent (AED)", ...monthColumns.map((col) => col.key)];
}

function applyWorksheetStyles(worksheet: Worksheet, keys: string[]) {
  worksheet.eachRow((row, rowNumber) => {
    row.height = 25;

    row.eachCell((cell, colNumber) => {
      const columnKey = keys[colNumber - 1];

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };

      if (rowNumber === 1) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF000000' },
        };
        cell.border = {
          bottom: { style: 'medium', color: { argb: GOLD_BORDER } },
        };
        return;
      }

      if (columnKey === "Rent (AED)") {
        const val = Number(cell.value);
        if (!isNaN(val) && val > 0) {
          cell.numFmt = NUM_FMT;
        }
      }

      if (columnKey === "Discount (%)") {
        const val = Number(cell.value);
        if (!isNaN(val) && val > 0) {
          cell.value = `${val}%`;
        }
      }

      if (isNegativeMonthCell(cell.value)) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: NEGATIVE_FILL },
        };
        cell.font = { color: { argb: NEGATIVE_TEXT }, bold: true };
      }

      if (cell.value === "✔") {
        cell.font = { color: { argb: 'FF15803D' }, bold: true };
      }

      cell.border = {
        bottom: { style: 'thin', color: { argb: LIGHT_ROW_BORDER } },
      };
    });
  });
}

function addDataSheet(
  workbook: import('exceljs').Workbook,
  sheetName: string,
  filteredCustomers: CustomerView[],
  monthColumns: MonthColumn[],
  settlementsByYear: Record<number, Record<string, Record<number, SettlementEntry[]>>>
) {
  const exportData = buildCustomerRows(filteredCustomers, monthColumns, settlementsByYear);
  if (exportData.length === 0) return;

  const keys = buildColumnKeys(monthColumns);
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false }],
  });

  worksheet.columns = keys.map((key) => {
    let width = 14;
    if (key === "Customer Name") width = 50;
    if (key === "#") width = 9;
    return { header: key, key, width };
  });

  worksheet.addRows(exportData);
  applyWorksheetStyles(worksheet, keys);
}

export async function exportCustomersExcel(
  filteredCustomers: CustomerView[],
  cityFilter: string | null = null
) {
  if (filteredCustomers.length === 0) {
    alert("No customers to export.");
    return;
  }

  const settlementsData = await fetchAllData(() =>
    bhs_supabase.from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS").select("*")
  );

  const settlementsByYear: Record<number, Record<string, Record<number, SettlementEntry[]>>> = {};
  const allYears = new Set<number>();

  settlementsData.forEach((row: any) => {
    const year = Number(row.YEAR);
    if (!year || isNaN(year)) return;

    allYears.add(year);
    const cId = String(row.CUSTOMER_ID || "").trim();
    const month = Number(row.MONTH);
    if (!cId || !month || Number.isNaN(month)) return;

    if (!settlementsByYear[year]) settlementsByYear[year] = {};
    if (!settlementsByYear[year][cId]) settlementsByYear[year][cId] = {};
    if (!settlementsByYear[year][cId][month]) settlementsByYear[year][cId][month] = [];

    settlementsByYear[year][cId][month].push({
      id: row.ID,
      status: row.STATUS || "Pending",
    });
  });

  const yearsArray = Array.from(allYears).sort((a, b) => a - b);
  if (yearsArray.length === 0) {
    yearsArray.push(new Date().getFullYear());
  }

  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();

  const summaryColumns = buildMonthColumns(yearsArray, true);
  addDataSheet(workbook, "Summary", filteredCustomers, summaryColumns, settlementsByYear);

  for (const year of yearsArray) {
    const yearColumns = buildMonthColumns([year], false);
    if (yearColumns.length === 0) continue;
    addDataSheet(workbook, year.toString(), filteredCustomers, yearColumns, settlementsByYear);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(
    blob,
    cityFilter
      ? `Customers_Discounts_${cityFilter.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`
      : `Customers_Discounts_All_Cities_${new Date().toISOString().split("T")[0]}.xlsx`
  );
}

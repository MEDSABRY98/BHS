import { saveAs } from 'file-saver';
import { bhs_supabase, fetchAllData } from "@/lib/supabase";

const GOLD_BORDER = 'FFC9A84C';
const LIGHT_ROW_BORDER = 'FFEEEEEE';
const NEGATIVE_FILL = 'FFFEF2F2';
const NEGATIVE_TEXT = 'FFB91C1C';
const NUM_FMT = '#,##0.00';

type CustomerView = {
  customerId: string;
  customerName: string;
  city: string;
  discounts: any[];
};

export async function exportCustomersExcel(filteredCustomers: CustomerView[]) {
  if (filteredCustomers.length === 0) {
    alert("No customers to export.");
    return;
  }

  // 1. Fetch all settlements
  const settlementsData = await fetchAllData(() =>
    bhs_supabase.from("web_CUSTOMERS_DISCOUNTS_SETTLEMENTS").select("*")
  );

  // Group settlements by Year -> Customer ID -> Month -> Status
  const settlementsByYear: Record<number, Record<string, Record<number, string[]>>> = {};
  const allYears = new Set<number>();
  
  settlementsData.forEach((row: any) => {
    const year = Number(row.YEAR);
    if (!year || isNaN(year)) return;
    
    allYears.add(year);
    const cId = row.CUSTOMER_ID;
    const month = row.MONTH;
    const status = row.STATUS;
    
    if (!settlementsByYear[year]) settlementsByYear[year] = {};
    if (!settlementsByYear[year][cId]) settlementsByYear[year][cId] = {};
    if (!settlementsByYear[year][cId][month]) settlementsByYear[year][cId][month] = [];
    
    settlementsByYear[year][cId][month].push(status);
  });

  const yearsArray = Array.from(allYears).sort((a, b) => a - b);
  if (yearsArray.length === 0) {
    yearsArray.push(new Date().getFullYear());
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // 2. Initialize Workbook
  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();

  // 3. Create a sheet for each year
  for (const year of yearsArray) {
    const yearSettlements = settlementsByYear[year] || {};

    const exportData = filteredCustomers.map((customer, index) => {
      const row: Record<string, any> = {
        "#": index + 1,
        "Customer Name": customer.customerName,
      };

      // Calculate total discount and total rent
      let totalDiscount = 0;
      let totalRent = 0;
      customer.discounts.forEach(d => {
        if (d.type === "percentage") {
          totalDiscount += Number(d.value) || 0;
        } else {
          totalRent += Number(d.value) || 0;
        }
      });

      row["Discount (%)"] = totalDiscount > 0 ? totalDiscount : 0;
      row["Rent (AED)"] = totalRent > 0 ? totalRent : 0;

      // Fill months
      const customerSettlements = yearSettlements[customer.customerId] || {};
      
      // Determine max month for this year
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      let maxMonth = 12;
      if (year === currentYear) {
        maxMonth = currentMonth;
      } else if (year > currentYear) {
        maxMonth = 0;
      }

      // For each month, check if there are pending settlements
      for (let m = 1; m <= maxMonth; m++) {
        const statuses = customerSettlements[m];
        const monthName = monthNames[m - 1];
        
        if (!statuses || statuses.length === 0) {
          row[monthName] = "-"; // No configs for this customer in this month
        } else {
          const hasPending = statuses.includes("Pending");
          if (hasPending) {
            row[monthName] = "X";
          } else {
            row[monthName] = "✔"; // Settled
          }
        }
      }

      return row;
    });

    const worksheet = workbook.addWorksheet(year.toString(), {
      views: [{ showGridLines: false }],
    });

    const keys = Object.keys(exportData[0] || {});
    if (keys.length === 0) continue;
    
    worksheet.columns = keys.map((key) => {
      // User requested 64px for #, 350px for Customer Name, 100px for others.
      // ExcelJS width is in characters. 1 character ~ 7 pixels.
      let width = 14; // ~100px
      if (key === "Customer Name") width = 50; // ~350px
      if (key === "#") width = 9; // ~64px
      
      return { header: key, key, width };
    });

    worksheet.addRows(exportData);

    // Style the worksheet
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

        // Format numeric columns
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

        // Highlight X cells in red
        if (cell.value === "X") {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: NEGATIVE_FILL },
          };
          cell.font = { color: { argb: NEGATIVE_TEXT }, bold: true };
        }
        
        // Settled cells color
        if (cell.value === "✔") {
          cell.font = { color: { argb: 'FF15803D' }, bold: true }; // Green
        }

        cell.border = {
          bottom: { style: 'thin', color: { argb: LIGHT_ROW_BORDER } },
        };
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `Customers_Discounts_${new Date().toISOString().split('T')[0]}.xlsx`);
}

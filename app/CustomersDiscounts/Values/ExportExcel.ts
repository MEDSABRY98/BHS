import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';

const GOLD_BORDER = 'FFC9A84C';
const LIGHT_ROW_BORDER = 'FFEEEEEE';
const NUM_FMT = '#,##0.00';

export type DiscountValuesExportRow = {
  customerName: string;
  city: string;
  discountPercent: number;
  netSales: number;
  discountValue: number;
  rent: number;
};

export async function exportDiscountValuesExcel(
  rows: DiscountValuesExportRow[],
  dateFrom: string,
  dateTo: string,
) {
  if (rows.length === 0) {
    alert('No rows to export.');
    return;
  }

  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();
  const keys = [
    '#',
    'Customer Name',
    'City',
    'Discount (%)',
    'Net Sales',
    'Discount Value',
    'D %',
    'Rent (AED)',
    'R %',
  ];

  const worksheet = workbook.addWorksheet('Values', {
    views: [{ showGridLines: false }],
  });

  worksheet.columns = keys.map((key) => {
    let width = 16;
    if (key === '#') width = 9;
    if (key === 'Customer Name') width = 40;
    if (key === 'City') width = 22;
    if (key === 'Discount (%)') width = 14;
    if (key === 'D %') width = 12;
    if (key === 'R %') width = 12;
    return { header: key, key, width };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.netSales += row.netSales;
      acc.discountValue += row.discountValue;
      acc.rent += row.rent;
      return acc;
    },
    { netSales: 0, discountValue: 0, rent: 0 },
  );

  const exportData = [
    ...rows.map((row, index) => ({
      '#': index + 1,
      'Customer Name': row.customerName,
      City: row.city || 'Unknown',
      'Discount (%)': row.discountPercent > 0 ? row.discountPercent : 0,
      'Net Sales': row.netSales,
      'Discount Value': row.discountValue,
      'D %': totals.discountValue > 0 ? (row.discountValue / totals.discountValue) * 100 : 0,
      'Rent (AED)': row.rent > 0 ? row.rent : 0,
      'R %': totals.rent > 0 ? (row.rent / totals.rent) * 100 : 0,
    })),
    {
      '#': '',
      'Customer Name': 'TOTALS',
      City: '',
      'Discount (%)': '',
      'Net Sales': totals.netSales,
      'Discount Value': totals.discountValue,
      'D %': totals.discountValue > 0 ? 100 : 0,
      'Rent (AED)': totals.rent,
      'R %': totals.rent > 0 ? 100 : 0,
    },
  ];

  worksheet.addRows(exportData);

  worksheet.eachRow((row, rowNumber) => {
    row.height = 25;
    const isTotal = rowNumber === exportData.length + 1;

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

      if (isTotal) {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F172A' },
        };
      }

      if ((columnKey === 'Discount (%)' || columnKey === 'D %' || columnKey === 'R %') && !isTotal) {
        const val = Number(cell.value);
        if (!isNaN(val) && val > 0) {
          if (columnKey === 'Discount (%)') {
            cell.value = `${val}%`;
          } else {
            cell.value = `${val.toFixed(2)}%`;
          }
        } else {
          cell.value = '0%';
        }
      }

      if (isTotal && (columnKey === 'D %' || columnKey === 'R %')) {
        cell.value = `${cell.value}%`;
      }

      if (
        columnKey === 'Net Sales' ||
        columnKey === 'Discount Value' ||
        columnKey === 'Rent (AED)'
      ) {
        const val = Number(cell.value);
        if (!isNaN(val)) {
          cell.numFmt = NUM_FMT;
        }
      }

      cell.border = {
        bottom: { style: 'thin', color: { argb: LIGHT_ROW_BORDER } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveTrackedAs(blob, `Discount_Values_${dateFrom}_to_${dateTo}.xlsx`);
}

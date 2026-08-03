import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';
import JSZip from 'jszip';

const GOLD_BORDER = 'FFC9A84C';
const LIGHT_ROW_BORDER = 'FFEEEEEE';

export async function exportInventoryExcel(data: any[], sheetName: string, fileName: string) {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }

  const ExcelJSModule = (await import('exceljs')).default;
  const workbook = new ExcelJSModule.Workbook();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false }],
  });

  const keys = Object.keys(data[0] || {});
  if (keys.length === 0) return;
  
  worksheet.columns = keys.map((key) => {
    // 14 character width is roughly 100 pixels in Excel
    return { header: key, key, width: 14 }; 
  });

  worksheet.addRows(data);

  // Style the worksheet
  worksheet.eachRow((row, rowNumber) => {
    row.height = 25;

    row.eachCell((cell, colNumber) => {
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

      cell.border = {
        bottom: { style: 'thin', color: { argb: LIGHT_ROW_BORDER } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveTrackedAs(blob, fileName);
}

export async function exportAllCategoriesZip(
  categoriesMap: Record<string, any[]>,
  zipFileName: string
) {
  const ExcelJSModule = (await import('exceljs')).default;
  const zip = new JSZip();

  for (const [categoryName, data] of Object.entries(categoriesMap)) {
    if (data.length === 0) continue;

    const workbook = new ExcelJSModule.Workbook();
    const worksheet = workbook.addWorksheet('Inventory', {
      views: [{ showGridLines: false }],
    });

    const keys = Object.keys(data[0] || {});
    if (keys.length > 0) {
      worksheet.columns = keys.map((key) => ({ header: key, key, width: 14 }));
      worksheet.addRows(data);

      worksheet.eachRow((row, rowNumber) => {
        row.height = 25;
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          if (rowNumber === 1) {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
            cell.border = { bottom: { style: 'medium', color: { argb: GOLD_BORDER } } };
            return;
          }
          cell.border = { bottom: { style: 'thin', color: { argb: LIGHT_ROW_BORDER } } };
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    // Use regex to sanitize the file name, allowing Arabic characters as well
    const safeName = categoryName.replace(/[^a-zA-Z0-9-_\u0600-\u06FF\s]/g, '_').trim();
    zip.file(`${safeName}_inventory.xlsx`, buffer);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveTrackedAs(zipBlob, zipFileName);
}

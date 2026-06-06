const XLSX = require('xlsx');

const filePath = 'C:/Users/MEDSA/Downloads/Customer_Mapping_AlAin_05.06.2026.xlsx';
console.log('Reading file:', filePath);

try {
  const wb = XLSX.readFile(filePath);
  const wsname = wb.SheetNames[0];
  const ws = wb.Sheets[wsname];
  const dataRows = XLSX.utils.sheet_to_json(ws);

  console.log('Total rows found:', dataRows.length);

  if (dataRows.length > 0) {
    console.log('First row raw:', dataRows[0]);
  }

  const mapping = {};
  dataRows.forEach(rawRow => {
    const row = {};
    Object.keys(rawRow).forEach(key => {
      row[key.toString().trim().toUpperCase()] = rawRow[key];
    });

    const id = row['CUSTOMER ID']?.toString().trim();
    if (id) {
      mapping[id] = {
        customerMainName: row['CUSTOMER MAIN NAME']?.toString().trim() || '',
        customerName: row['CUSTOMER SUB NAME']?.toString().trim() || '',
        area: row['AREA']?.toString().trim() || '',
        market: row['MARKETS']?.toString().trim() || '',
        merchandiser: row['MERCHANDISER']?.toString().trim() || '',
        salesRep: row['SALESREP']?.toString().trim() || '',
      };
    }
  });

  console.log('Generated mapping keys count:', Object.keys(mapping).length);
  
  if (Object.keys(mapping).length > 0) {
    const firstKey = Object.keys(mapping)[0];
    console.log('First mapping item:', { [firstKey]: mapping[firstKey] });
  } else {
    console.log('ERROR: Mapping is empty. Headers might not match.');
  }

} catch (e) {
  console.error('Error reading excel file:', e.message);
}

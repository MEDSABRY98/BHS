const XLSX = require('xlsx');

const filePath = 'C:\\Users\\MEDSA\\Downloads\\Stock Move (stock.move) (10).xlsx';

try {
  const workbook = XLSX.readFile(filePath);
  console.log('Sheet Names:', workbook.SheetNames);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log('Total Rows:', data.length);
  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample Rows (first 3):', JSON.stringify(data.slice(0, 3), null, 2));
  }
} catch (err) {
  console.error('Error reading excel:', err);
}

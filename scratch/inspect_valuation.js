const XLSX = require('xlsx');

const filePath = 'C:\\Users\\MEDSA\\Downloads\\Pivot Untitled (stock.valuation.layer).xlsx';
const wb = XLSX.readFile(filePath);
console.log('Sheet Names:', wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
console.log('Total Rows:', data.length);
if (data.length > 0) {
  console.log('Columns:', Object.keys(data[0]));
  console.log('\nFirst 5 rows:');
  console.log(JSON.stringify(data.slice(0, 5), null, 2));
  console.log('\nLast 2 rows:');
  console.log(JSON.stringify(data.slice(-2), null, 2));
}

const XLSX = require('xlsx');

const filePath = 'C:\\Users\\MEDSA\\Downloads\\Stock Move (stock.move) (11).xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

console.log('Sheet Names:', workbook.SheetNames);
console.log('Total Rows:', data.length);
if (data.length > 0) {
  console.log('Columns:', Object.keys(data[0]));
  console.log('\nSample Rows (first 3):');
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
}

// Show all unique locations
const srcLocs = new Set();
const dstLocs = new Set();
for (const row of data) {
  if (row['Source Location']) srcLocs.add(row['Source Location']);
  if (row['Intermediate Location']) dstLocs.add(row['Intermediate Location']);
}
console.log('\nSource Locations:', [...srcLocs].sort());
console.log('Destination Locations:', [...dstLocs].sort());

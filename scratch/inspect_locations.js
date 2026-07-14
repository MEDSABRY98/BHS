const XLSX = require('xlsx');

const filePath = 'C:\\Users\\MEDSA\\Downloads\\Stock Move (stock.move) (10).xlsx';
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

const sourceLocations = new Set();
const destLocations = new Set();

for (const row of data) {
  if (row['Source Location']) sourceLocations.add(row['Source Location']);
  if (row['Intermediate Location']) destLocations.add(row['Intermediate Location']);
}

console.log('=== SOURCE LOCATIONS (من فين) ===');
[...sourceLocations].sort().forEach(loc => console.log(' -', loc));

console.log('\n=== INTERMEDIATE/DESTINATION LOCATIONS (وصل لفين) ===');
[...destLocations].sort().forEach(loc => console.log(' -', loc));

// Show combo stats
console.log('\n=== LOCATION PAIR COMBINATIONS & COUNTS ===');
const pairCount = {};
for (const row of data) {
  const key = `${row['Source Location']} --> ${row['Intermediate Location']}`;
  pairCount[key] = (pairCount[key] || 0) + 1;
}
Object.entries(pairCount)
  .sort((a, b) => b[1] - a[1])
  .forEach(([pair, count]) => console.log(` ${count.toString().padStart(6)} | ${pair}`));

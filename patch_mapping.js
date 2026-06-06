const fs = require('fs');

const files = [
  'app/api/Sales/Top10/route.ts',
  'app/api/Sales/Customers/route.ts',
  'app/api/Sales/CustomerDetails/route.ts',
  'app/api/Sales/CustomersComparison/route.ts',
  'app/api/Sales/InactiveCustomers/route.ts',
  'app/api/Sales/Categories/route.ts',
  'app/api/Sales/Statistics/route.ts',
  'app/api/Sales/DailySales/route.ts',
  'app/api/Sales/StockReport/route.ts',
  'app/api/Sales/ProductDetails/route.ts',
  'app/api/Sales/Metadata/route.ts'
];

const newBlock = `    // Mapping (memory cache — no DB call after first request)
    const mappingMap = userId ? await getMappingServer(userId) : new Map();
    const augmentedData = mappingMap.size > 0
      ? rawData.map((item: any) => applyMapping(item, mappingMap))
      : rawData;`;

let count = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  const regex = /\/\/\s*Apply Mapping[^\n]*\n\s*let mappingMap = new Map<string, any>\(\);[\s\S]*?let augmentedData = rawData;[\s\S]*?if \(mappingMap\.size > 0\) \{[\s\S]*?augmentedData = rawData\.map\(\(item: any\) => \{[\s\S]*?const mapping = mappingMap\.get\(item\.customerId\);[\s\S]*?if \(mapping\) \{[\s\S]*?return \{[\s\S]*?\.\.\.item,[\s\S]*?customerMainName:[\s\S]*?salesRep:[\s\S]*?return item;\s*\}\);\s*\}/s;
  
  const regex2 = /\/\/\s*Apply Mapping[^\n]*\n\s*let mappingMap = new Map<string, any>\(\);[\s\S]*?let augmentedData = rawData;[\s\S]*?if \(mappingMap\.size > 0\) \{[\s\S]*?augmentedData = rawData\.map\(item => \{[\s\S]*?const mapping = mappingMap\.get\(item\.customerId\);[\s\S]*?if \(mapping\) \{[\s\S]*?return \{[\s\S]*?\.\.\.item,[\s\S]*?customerMainName:[\s\S]*?salesRep:[\s\S]*?return item;\s*\}\);\s*\}/s;

  if (regex.test(content)) {
    content = content.replace(regex, newBlock);
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Patched (regex1): ' + file);
    count++;
  } else if (regex2.test(content)) {
    content = content.replace(regex2, newBlock);
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Patched (regex2): ' + file);
    count++;
  } else {
    console.log('⚠️ Pattern not matched: ' + file);
  }
}
console.log('Done. Patched ' + count + ' files.');

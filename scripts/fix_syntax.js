const fs = require('fs');
const path = require('path');

const files = [
  'app/Debit/Components/SalesRepsTab.tsx',
  'app/Debit/Components/MonthsTab.tsx',
  'app/Debit/Components/CustomerDetailsTab/CustomerDetailsTab.tsx',
];

for (const file of files) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  let code = fs.readFileSync(p, 'utf8');

  // Replace using a regex to catch any spacing
  const regex = /useEffect\(\(\) => \{\s*const fetchClosedCustomers = async \(\) => \{\s*try \{\s*\);\s*setClosedCustomers\(normalizedSet\);\s*\}\s*\} catch \(error\) \{\s*console\.error\('Failed to fetch closed customers:', error\);\s*\}\s*\};\s*fetchClosedCustomers\(\);\s*\}, \[\]\);/;
  
  code = code.replace(regex, '');

  fs.writeFileSync(p, code, 'utf8');
}

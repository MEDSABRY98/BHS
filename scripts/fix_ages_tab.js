const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'app', 'Debit', 'Components', 'AgesTab.tsx');
let code = fs.readFileSync(p, 'utf8');

// Use regex to remove closedCustomers related logic
code = code.replace(/const \[closedCustomers,\s*setClosedCustomers\] = useState<Set<string>>\(new Set\(\)\);\n?/g, '');
code = code.replace(/useEffect\(\(\) => \{\s*\/\/ Fetch Closed list[\s\S]*?fetchLists\(\);\s*\}, \[\]\);\n?/g, '');
code = code.replace(/const \[statusFilter, setStatusFilter\] = useState<'all' \| 'active' \| 'closed'>\('all'\);\n?/g, '');
code = code.replace(/\s*\/\/ Filter by status \(Shop Status\)[\s\S]*?if \(statusFilter === 'closed'\) \{\s*return isClosed;\s*\}\s*return true;\s*}\);\s*}/g, '');
code = code.replace(/,\s*statusFilter,\s*closedCustomers/g, '');
code = code.replace(/\{\/\* Status Filter \*\/\}\s*<select[\s\S]*?<\/select>/g, '');
code = code.replace(/let filterDesc = 'All Customers';\s*if \(statusFilter === 'active'\) filterDesc = 'Active Customers Only';\s*if \(statusFilter === 'closed'\) filterDesc = 'Closed Customers Only';/g, "let filterDesc = 'All Customers';");

fs.writeFileSync(p, code, 'utf8');

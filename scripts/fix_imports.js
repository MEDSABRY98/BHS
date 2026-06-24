const fs = require('fs');
const path = require('path');

const dirToProcess = path.join(process.cwd(), 'app');

const inventoryExports = new Set([
  'ICItem', 'ICRecord', 'getSingleProductAnalysis', 'getProductOrdersData', 
  'updateProductColumn', 'getItemCodesData', 'getProductMovementsData', 
  'updateICItem', 'getNormalICTotal', 'getDamageICTotal', 'getNormalICRecord', 
  'getDamageICRecord', 'migrateICFromGoogleSheets', 'migrateICProductsFromGoogleSheets'
]);

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@\/lib\/Sheets\/[^'"]+['"];?/g;

  content = content.replace(importRegex, (match, importsStr) => {
    changed = true;
    const imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
    
    const inventoryImports = [];
    const supabaseImports = [];

    for (const imp of imports) {
      if (inventoryExports.has(imp)) {
        inventoryImports.push(imp);
      } else {
        supabaseImports.push(imp);
      }
    }

    let result = '';
    if (inventoryImports.length > 0) {
      result += `import { ${inventoryImports.join(', ')} } from '@/lib/Inventory';\n`;
    }
    if (supabaseImports.length > 0) {
      result += `import { ${supabaseImports.join(', ')} } from '@/lib/supabase';\n`;
    }

    // Dynamic imports handling like: await import('@/lib/Sheets/GoogleSheets')
    // handled separately if any.

    return result.trim() + ';';
  });

  // Handle dynamic imports
  if (content.includes("await import('@/lib/Sheets/GoogleSheets')")) {
    content = content.replace(/await import\('@\/lib\/Sheets\/GoogleSheets'\)/g, "await import('@/lib/supabase')");
    changed = true;
  }
  if (content.includes("await import('@/lib/Sheets/Invoices')")) {
    content = content.replace(/await import\('@\/lib\/Sheets\/Invoices'\)/g, "await import('@/lib/supabase')");
    changed = true;
  }
  if (content.includes("await import('@/lib/Sheets/Payments')")) {
    content = content.replace(/await import\('@\/lib\/Sheets\/Payments'\)/g, "await import('@/lib/supabase')");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

walk(dirToProcess);

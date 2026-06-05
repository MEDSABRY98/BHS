const fs = require('fs');
const path = require('path');

const dir = 'D:/APPS/BH/BHS - WEB/components/Sales';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && !f.includes('Details') && !f.includes('Sidebar'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Find export default function ComponentName({ props }: Type)
  const argMatch = content.match(/export default function (\w+)\(\{\s*([^}]*?)\s*\}\s*:\s*\w+\)/);
  if (argMatch && !argMatch[2].includes('refreshTrigger')) {
    const newArgs = argMatch[2] + ', refreshTrigger';
    content = content.replace(argMatch[0], `export default function ${argMatch[1]}({ ${newArgs} }: ${argMatch[1]}Props)`);
    // Wait, replacing the type with ${argMatch[1]}Props might break if it was just Props.
    // Let's use the matched type.
  }

  // A safer regex
  content = content.replace(/(export default function \w+\(\{\s*)([^}]*?)(\s*\}\s*:\s*\w+\s*\) {)/g, (match, p1, p2, p3) => {
    if (p2.includes('refreshTrigger')) return match;
    changed = true;
    return p1 + p2 + ', refreshTrigger' + p3;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed props for ' + file);
  }
});

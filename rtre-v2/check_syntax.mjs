import { parse } from 'acorn';
import fs from 'fs';
import path from 'path';

const files = [
  'src/App.jsx',
  'src/components/tabs/ChartTab.jsx', 
  'src/components/tabs/InputTab.jsx',
  'src/components/tabs/TableTab.jsx',
  'src/components/ui/index.jsx',
  'src/components/AuthPages.jsx',
  'src/components/AdminPage.jsx',
  'src/utils/statistics.js',
  'src/utils/modelAdvisor.js',
  'src/utils/export.js',
  'src/theme.js',
  'src/firebase.js',
];

for (const f of files) {
  try {
    const code = fs.readFileSync(f, 'utf8');
    parse(code, { ecmaVersion: 2022, sourceType: 'module', jsx: true });
    console.log(`✓ ${f}`);
  } catch (e) {
    console.log(`✗ ${f}: ${e.message.slice(0, 200)}`);
  }
}

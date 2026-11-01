import fs from 'fs';
let code = fs.readFileSync('pages/SubjectWorkspace.tsx', 'utf-8');
const lines = code.split('\n');

for (let i = 1502; i < 1682; i++) {
  const line = lines[i];
  const o = (line.match(/\{/g) || []).length;
  const c = (line.match(/\}/g) || []).length;
  if (o !== c) {
    console.log(`Line ${i + 1}: +${o} -${c} => ${line}`);
  }
}

import fs from 'fs';
let code = fs.readFileSync('pages/SubjectWorkspace.tsx', 'utf-8');
const lines = code.split('\n');
let balance = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue;
  
  let o = (line.match(/\{/g) || []).length;
  let c = (line.match(/\}/g) || []).length;
  
  balance += o;
  balance -= c;
}
console.log('Final balance:', balance);

let localBalance = 0;
for (let i = 1500; i < 1682; i++) {
  const line = lines[i];
  if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue;
  let o = (line.match(/\{/g) || []).length;
  let c = (line.match(/\}/g) || []).length;
  localBalance += o;
  localBalance -= c;
  console.log(`Line ${i+1}: bl=${localBalance} -> ${line.trim()}`);
}

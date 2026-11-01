import fs from 'fs';
const code = fs.readFileSync('pages/SubjectWorkspace.tsx', 'utf-8');
const lines = code.split('\n');
let activeDivs = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue;
  let p = 0;
  while (p < line.length) {
    const o = line.indexOf('<div', p);
    const c = line.indexOf('</div', p);
    if (o !== -1 && (c === -1 || o < c)) {
      activeDivs.push(i + 1);
      p = o + 4;
    } else if (c !== -1) {
      if (activeDivs.length > 0) activeDivs.pop();
      p = c + 5;
    } else {
      break;
    }
  }
}
console.log('Unclosed divs started at lines:', activeDivs);

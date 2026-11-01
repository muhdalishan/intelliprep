import fs from 'fs';

const P = 'pages/SubjectWorkspace.tsx';
const buf = fs.readFileSync(P, 'utf-8');

// I will just use basic regex to count ALL `<div` and `</div` ignoring comments:
// We just remove block comments and line comments first.
let code = buf;
code = code.replace(/\/\*[\s\S]*?\*\//g, '');
code = code.replace(/\/\/.*/g, '');

const opens = code.match(/<div[^\w]/g) || [];
const closes = code.match(/<\/div>/g) || [];
console.log('<div> count:', opens.length);
console.log('</div> count:', closes.length);

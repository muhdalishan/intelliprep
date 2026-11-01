import fs from 'fs';
let code = fs.readFileSync('pages/SubjectWorkspace.tsx', 'utf-8');
code = code.replace(/\/\*[\s\S]*?\*\//g, '');
code = code.replace(/\/\/.*/g, '');

const openBrace = code.match(/\{/g) || [];
const closeBrace = code.match(/\}/g) || [];
console.log('{ count:', openBrace.length);
console.log('} count:', closeBrace.length);

const openParen = code.match(/\(/g) || [];
const closeParen = code.match(/\)/g) || [];
console.log('( count:', openParen.length);
console.log(') count:', closeParen.length);

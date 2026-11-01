import fs from 'fs';
let code = fs.readFileSync('pages/SubjectWorkspace.tsx', 'utf-8');
code = code.replace(/\/\*[\s\S]*?\*\//g, '');
code = code.replace(/\/\/.*/g, '');

const selfClosing = code.match(/<div[^>]*\/>/g) || [];
console.log('Self-closing <div> count:', selfClosing.length);

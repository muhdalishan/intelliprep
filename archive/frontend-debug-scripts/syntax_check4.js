import fs from 'fs';
let code = fs.readFileSync('pages/SubjectWorkspace.tsx', 'utf-8');
const lines = code.split('\n');
const block = lines.slice(2118, 2339).join('\n'); // studyroom

const openBrace = block.match(/\{/g) || [];
const closeBrace = block.match(/\}/g) || [];
console.log('Studyroom { count:', openBrace.length);
console.log('Studyroom } count:', closeBrace.length);

const blockFlash = lines.slice(1502, 1682).join('\n'); // flashcards
console.log('Flash { count:', (blockFlash.match(/\{/g) || []).length);
console.log('Flash } count:', (blockFlash.match(/\}/g) || []).length);

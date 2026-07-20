
const fs = require('fs');
const dir = 'D:/claudeworkspace/KM v3.0/km-app/assets/tab-icons';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
for (const f of files) {
  const svg = fs.readFileSync(dir + '/' + f, 'utf8');
  const m = svg.match(/base64,([^"]+)/);
  if (m) {
    fs.writeFileSync(dir + '/' + f.replace('.svg','.png'), Buffer.from(m[1], 'base64'));
    console.log('Created: ' + f.replace('.svg','.png'));
  }
}

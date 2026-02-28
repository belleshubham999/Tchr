import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const publicDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

// Copy all files from public to dist
if (fs.existsSync(publicDir)) {
  const files = fs.readdirSync(publicDir);
  
  files.forEach(file => {
    const src = path.join(publicDir, file);
    const dest = path.join(distDir, file);
    
    const stat = fs.statSync(src);
    if (stat.isFile()) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${file} to dist/`);
    }
  });
}

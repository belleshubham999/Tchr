import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const publicDir = path.join(__dirname, 'public');
const distDir = path.join(__dirname, 'dist');

const imagesToOptimize = [
  { src: 'auth.png', quality: 75 },
  { src: 'auth2.png', quality: 75 }
];

async function optimizeImages() {
  for (const image of imagesToOptimize) {
    const inputPath = path.join(publicDir, image.src);
    const outputPath = path.join(publicDir, image.src.replace('.png', '.webp'));
    const distOutputPath = path.join(distDir, image.src.replace('.png', '.webp'));

    if (fs.existsSync(inputPath)) {
      try {
        await sharp(inputPath)
          .webp({ quality: image.quality })
          .toFile(outputPath);
        
        // Also copy to dist
        if (fs.existsSync(distDir)) {
          fs.copyFileSync(outputPath, distOutputPath);
        }
        
        const origSize = fs.statSync(inputPath).size / 1024;
        const newSize = fs.statSync(outputPath).size / 1024;
        console.log(`✓ ${image.src} → ${image.src.replace('.png', '.webp')} (${origSize.toFixed(0)}KB → ${newSize.toFixed(0)}KB)`);
      } catch (error) {
        console.error(`✗ Failed to optimize ${image.src}:`, error.message);
      }
    }
  }
}

optimizeImages().catch(console.error);

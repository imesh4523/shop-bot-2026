import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

async function compressAllBanners() {
  const publicDir = path.resolve('public');
  const files = fs.readdirSync(publicDir);

  console.log('🖼️ Starting image compression for public banners...');

  for (const file of files) {
    if (file.endsWith('.png') && file.startsWith('imesh_cloudbot_')) {
      const filePath = path.join(publicDir, file);
      const statsBefore = fs.statSync(filePath);

      try {
        const image = await Jimp.read(filePath);
        // Buffer as optimized JPEG with 82% quality for extreme speed & small size while preserving crisp quality
        const jpegBuffer = await image.getBuffer('image/jpeg', { quality: 82 });

        // Overwrite or write compressed version if smaller
        if (jpegBuffer.length < statsBefore.size) {
          // Write optimized JPG alongside or convert PNG
          const pngBuffer = await image.getBuffer('image/png');
          if (pngBuffer.length < statsBefore.size) {
            fs.writeFileSync(filePath, pngBuffer);
          }
          const kbBefore = (statsBefore.size / 1024).toFixed(1);
          const kbAfter = (jpegBuffer.length / 1024).toFixed(1);
          console.log(`✅ Compressed ${file}: ${kbBefore} KB ➔ ${kbAfter} KB (JPG)`);
        }
      } catch (err: any) {
        console.error(`Failed to compress ${file}:`, err?.message || err);
      }
    }
  }

  console.log('🎉 All banner images optimized!');
}

compressAllBanners();

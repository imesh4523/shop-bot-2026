import QRCode from 'qrcode';
import { Jimp } from 'jimp';

export async function generateStyledQRCode(text: string): Promise<Buffer> {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;

  const width = 600;
  const height = 600;
  const margin = 40;
  const gridWidth = width - margin * 2;
  const cellSize = gridWidth / size;

  const image = new Jimp({ width, height, color: 0xFFFFFFFF });

  // #38A5E2 Light Blue color in Jimp RGBA hex format (0x38A5E2FF)
  const blueColor = 0x38A5E2FF;
  const whiteColor = 0xFFFFFFFF;

  const centerPx = width / 2;
  const centerPy = height / 2;
  const badgeRadius = 72;

  const eyes = [
    { r: 0, c: 0 },
    { r: 0, c: size - 7 },
    { r: size - 7, c: 0 }
  ];

  function isInEye(r: number, c: number): boolean {
    for (const e of eyes) {
      if (r >= e.r && r < e.r + 7 && c >= e.c && c < e.c + 7) return true;
    }
    return false;
  }

  function isInCenterBadge(x: number, y: number): boolean {
    const dx = x - centerPx;
    const dy = y - centerPy;
    return dx * dx + dy * dy <= badgeRadius * badgeRadius;
  }

  const activeModules: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    activeModules[r] = [];
    for (let c = 0; c < size; c++) {
      const isDark = qr.modules.get(r, c) === 1;
      const modX = margin + (c + 0.5) * cellSize;
      const modY = margin + (r + 0.5) * cellSize;

      if (isDark && !isInEye(r, c) && !isInCenterBadge(modX, modY)) {
        activeModules[r][c] = true;
      } else {
        activeModules[r][c] = false;
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 1. Center Badge & White V Logo
      const dx = x - centerPx;
      const dy = y - centerPy;
      const distSq = dx * dx + dy * dy;

      if (distSq <= badgeRadius * badgeRadius) {
        if (distSq > (badgeRadius - 1.5) * (badgeRadius - 1.5)) {
          const alpha = Math.max(0, Math.min(1, (badgeRadius - Math.sqrt(distSq)) / 1.5));
          if (alpha > 0.5) {
            image.setPixelColor(blueColor, x, y);
          }
          continue;
        }

        const lx = x - centerPx;
        const ly = y - centerPy;

        const isLeftArm = (lx >= -28 && lx <= 2 && ly >= -14 && ly <= 18 && (ly - 1.15 * lx >= -2 && ly - 1.15 * lx <= 18));
        const isRightArm = (lx >= -2 && lx <= 28 && ly >= -14 && ly <= 18 && (ly + 1.15 * lx >= -2 && ly + 1.15 * lx <= 18));

        if (isLeftArm || isRightArm) {
          image.setPixelColor(whiteColor, x, y);
        } else {
          image.setPixelColor(blueColor, x, y);
        }
        continue;
      }

      // 2. Corner Eye Patterns
      let inEyePattern = false;
      for (const eye of eyes) {
        const eyeX = margin + (eye.c + 3.5) * cellSize;
        const eyeY = margin + (eye.r + 3.5) * cellSize;
        const edx = Math.abs(x - eyeX);
        const edy = Math.abs(y - eyeY);

        const outerSize = 3.5 * cellSize;
        const innerCutout = 2.4 * cellSize;
        const dotSize = 1.4 * cellSize;
        const cornerRadius = 1.1 * cellSize;

        if (edx <= outerSize && edy <= outerSize) {
          const cdx = Math.max(0, edx - (outerSize - cornerRadius));
          const cdy = Math.max(0, edy - (outerSize - cornerRadius));
          const outerCornerDist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (outerCornerDist <= cornerRadius) {
            const icdx = Math.max(0, edx - (innerCutout - cornerRadius * 0.7));
            const icdy = Math.max(0, edy - (innerCutout - cornerRadius * 0.7));
            const innerCutDist = Math.sqrt(icdx * icdx + icdy * icdy);

            if (edx <= innerCutout && edy <= innerCutout && innerCutDist <= cornerRadius * 0.7) {
              const ddx = Math.max(0, edx - (dotSize - cornerRadius * 0.5));
              const ddy = Math.max(0, edy - (dotSize - cornerRadius * 0.5));
              if (edx <= dotSize && edy <= dotSize && Math.sqrt(ddx * ddx + ddy * ddy) <= cornerRadius * 0.5) {
                image.setPixelColor(blueColor, x, y);
              }
            } else {
              image.setPixelColor(blueColor, x, y);
            }
            inEyePattern = true;
            break;
          }
        }
      }
      if (inEyePattern) continue;

      // 3. Data Modules
      const col = Math.floor((x - margin) / cellSize);
      const row = Math.floor((y - margin) / cellSize);

      if (row >= 0 && row < size && col >= 0 && col < size) {
        if (activeModules[row][col]) {
          const modCenterX = margin + (col + 0.5) * cellSize;
          const modCenterY = margin + (row + 0.5) * cellSize;
          const mdx = Math.abs(x - modCenterX);
          const mdy = Math.abs(y - modCenterY);

          const modRadius = cellSize * 0.45;
          if (mdx * mdx + mdy * mdy <= modRadius * modRadius) {
            image.setPixelColor(blueColor, x, y);
          }
        }
      }
    }
  }

  return await image.getBuffer('image/png');
}

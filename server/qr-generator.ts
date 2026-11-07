import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const EMBEDDED_CENTER_LOGO_B64 = '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';

let cachedLogoPng: PNG | null = null;

function getCenterLogoPng(): PNG | null {
  if (cachedLogoPng) return cachedLogoPng;
  try {
    const candidatePaths = [
      path.join(process.cwd(), 'server', 'assets', 'qr_center_logo.png'),
      path.join(process.cwd(), 'public', 'qr_center_logo.png'),
      path.join(process.cwd(), 'scratch', 'center_crop.png'),
      path.join(__dirname, 'assets', 'qr_center_logo.png'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        cachedLogoPng = PNG.sync.read(fs.readFileSync(p));
        return cachedLogoPng;
      }
    }
    // Fallback to embedded base64
    cachedLogoPng = PNG.sync.read(Buffer.from(EMBEDDED_CENTER_LOGO_B64, 'base64'));
    return cachedLogoPng;
  } catch (err) {
    console.error('[getCenterLogoPng Error]:', err);
    try {
      cachedLogoPng = PNG.sync.read(Buffer.from(EMBEDDED_CENTER_LOGO_B64, 'base64'));
      return cachedLogoPng;
    } catch {
      return null;
    }
  }
}

export async function generateStyledQRCode(text: string): Promise<Buffer> {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
    const size = qr.modules.size;

    const width = 1024;
    const height = 1024;
    const margin = 60;
    const gridWidth = width - margin * 2;
    const cellSize = gridWidth / size;

    // Exact cyan/sky blue from user's reference image: #45a4de -> RGB(69, 164, 222)
    const blueR = 69, blueG = 164, blueB = 222;

    const centerPx = width / 2;
    const centerPy = height / 2;
    const badgeRadius = 98;
    const clearance = cellSize * 0.45;

    // Finder pattern coordinates (7x7 top-left, top-right, bottom-left)
    const eyes = [
      { r: 0, c: 0 },
      { r: 0, c: size - 7 },
      { r: size - 7, c: 0 }
    ];

    function isInEye(r: number, c: number) {
      for (const e of eyes) {
        if (r >= e.r && r < e.r + 7 && c >= e.c && c < e.c + 7) return true;
      }
      return false;
    }

    function isInCenterBadgeArea(x: number, y: number) {
      const dx = x - centerPx;
      const dy = y - centerPy;
      return dx * dx + dy * dy <= (badgeRadius + clearance) * (badgeRadius + clearance);
    }

    function isDark(r: number, c: number) {
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      if (isInEye(r, c)) return false;
      const modX = margin + (c + 0.5) * cellSize;
      const modY = margin + (r + 0.5) * cellSize;
      if (isInCenterBadgeArea(modX, modY)) return false;
      return qr.modules.get(r, c) === 1;
    }

    const png = new PNG({ width, height });

    // Fill background with pure white
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 255;
      png.data[i + 1] = 255;
      png.data[i + 2] = 255;
      png.data[i + 3] = 255;
    }

    function blendPixel(x: number, y: number, alpha: number) {
      if (x < 0 || x >= width || y < 0 || y >= height || alpha <= 0.01) return;
      const idx = (width * y + x) << 2;
      if (alpha >= 0.99) {
        png.data[idx] = blueR;
        png.data[idx + 1] = blueG;
        png.data[idx + 2] = blueB;
      } else {
        const existingAlpha = (255 - png.data[idx]) / (255 - blueR);
        const combinedAlpha = Math.min(1, Math.max(alpha, existingAlpha));
        png.data[idx] = Math.round(255 * (1 - combinedAlpha) + blueR * combinedAlpha);
        png.data[idx + 1] = Math.round(255 * (1 - combinedAlpha) + blueG * combinedAlpha);
        png.data[idx + 2] = Math.round(255 * (1 - combinedAlpha) + blueB * combinedAlpha);
      }
    }

    // 1. Draw Liquid Data Modules with Analytic Anti-Aliasing
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isInEye(r, c)) continue;

        const cellLeft = Math.floor(margin + c * cellSize);
        const cellTop = Math.floor(margin + r * cellSize);
        const cellRight = Math.ceil(margin + (c + 1) * cellSize);
        const cellBottom = Math.ceil(margin + (r + 1) * cellSize);

        const dark = isDark(r, c);
        const north = isDark(r - 1, c);
        const south = isDark(r + 1, c);
        const west = isDark(r, c - 1);
        const east = isDark(r, c + 1);

        const cellW = cellRight - cellLeft;
        const cellH = cellBottom - cellTop;
        const rad = cellW / 2;

        for (let y = cellTop; y < cellBottom; y++) {
          for (let x = cellLeft; x < cellRight; x++) {
            const px = x - cellLeft;
            const py = y - cellTop;

            if (dark) {
              let alpha = 1.0;

              // Convex corner cuts on dark modules
              if (!north && !west && px < rad && py < rad) {
                const cdx = rad - px;
                const cdy = rad - py;
                const dist = Math.sqrt(cdx * cdx + cdy * cdy);
                alpha = Math.max(0, Math.min(1, rad + 0.5 - dist));
              } else if (!north && !east && px >= cellW - rad && py < rad) {
                const cdx = px - (cellW - rad);
                const cdy = rad - py;
                const dist = Math.sqrt(cdx * cdx + cdy * cdy);
                alpha = Math.max(0, Math.min(1, rad + 0.5 - dist));
              } else if (!south && !west && px < rad && py >= cellH - rad) {
                const cdx = rad - px;
                const cdy = py - (cellH - rad);
                const dist = Math.sqrt(cdx * cdx + cdy * cdy);
                alpha = Math.max(0, Math.min(1, rad + 0.5 - dist));
              } else if (!south && !east && px >= cellW - rad && py >= cellH - rad) {
                const cdx = px - (cellW - rad);
                const cdy = py - (cellH - rad);
                const dist = Math.sqrt(cdx * cdx + cdy * cdy);
                alpha = Math.max(0, Math.min(1, rad + 0.5 - dist));
              }

              if (alpha > 0) blendPixel(x, y, alpha);
            } else {
              // Concave fillets in light modules at orthogonal junctions
              const nw = isDark(r - 1, c - 1);
              const ne = isDark(r - 1, c + 1);
              const sw = isDark(r + 1, c - 1);
              const se = isDark(r + 1, c + 1);

              let alpha = 0.0;
              if (north && west && nw && px < rad && py < rad) {
                const cdx = rad - px;
                const cdy = rad - py;
                const dist = Math.sqrt(cdx * cdx + cdy * cdy);
                alpha = Math.max(0, Math.min(1, dist - (rad - 0.5)));
              } else if (north && east && ne && px >= cellW - rad && py < rad) {
                const cdx = px - (cellW - rad);
                const cdy = rad - py;
                const dist = Math.sqrt(cdx * cdx + cdy * cdy);
                alpha = Math.max(0, Math.min(1, dist - (rad - 0.5)));
              } else if (south && west && sw && px < rad && py >= cellH - rad) {
                const cdx = rad - px;
                const cdy = py - (cellH - rad);
                const dist = Math.sqrt(cdx * cdx + cdy * cdy);
                alpha = Math.max(0, Math.min(1, dist - (rad - 0.5)));
              } else if (south && east && se && px >= cellW - rad && py >= cellH - rad) {
                const cdx = px - (cellW - rad);
                const cdy = py - (cellH - rad);
                const dist = Math.sqrt(cdx * cdx + cdy * cdy);
                alpha = Math.max(0, Math.min(1, dist - (rad - 0.5)));
              }

              if (alpha > 0) blendPixel(x, y, alpha);
            }
          }
        }
      }
    }

    // 2. Draw 3 Corner Eyes (Smooth Squircles with Anti-Aliased Concentric Borders)
    const outerHalf = 3.5 * cellSize;
    const innerHalf = 2.45 * cellSize;
    const dotHalf = 1.45 * cellSize;
    const outerR = 1.9 * cellSize;
    const innerR = 1.25 * cellSize;
    const dotR = 1.15 * cellSize;

    for (const eye of eyes) {
      const eyeX = margin + (eye.c + 3.5) * cellSize;
      const eyeY = margin + (eye.r + 3.5) * cellSize;

      const minX = Math.floor(eyeX - outerHalf - 2);
      const maxX = Math.ceil(eyeX + outerHalf + 2);
      const minY = Math.floor(eyeY - outerHalf - 2);
      const maxY = Math.ceil(eyeY + outerHalf + 2);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = Math.abs(x - eyeX);
          const dy = Math.abs(y - eyeY);

          if (dx <= outerHalf + 1 && dy <= outerHalf + 1) {
            const cdx = Math.max(0, dx - (outerHalf - outerR));
            const cdy = Math.max(0, dy - (outerHalf - outerR));
            const outerDist = Math.sqrt(cdx * cdx + cdy * cdy);
            const outerAlpha = Math.max(0, Math.min(1, outerR + 0.5 - outerDist));

            if (outerAlpha <= 0) continue;

            // Cutout
            const icdx = Math.max(0, dx - (innerHalf - innerR));
            const icdy = Math.max(0, dy - (innerHalf - innerR));
            const innerDist = Math.sqrt(icdx * icdx + icdy * icdy);
            const cutoutAlpha = (dx <= innerHalf + 1 && dy <= innerHalf + 1)
              ? Math.max(0, Math.min(1, innerR + 0.5 - innerDist))
              : 0;

            // Center Dot
            const ddx = Math.max(0, dx - (dotHalf - dotR));
            const ddy = Math.max(0, dy - (dotHalf - dotR));
            const dotDist = Math.sqrt(ddx * ddx + ddy * ddy);
            const dotAlpha = (dx <= dotHalf + 1 && dy <= dotHalf + 1)
              ? Math.max(0, Math.min(1, dotR + 0.5 - dotDist))
              : 0;

            const eyeAlpha = Math.min(1, Math.max(0, outerAlpha * (1 - cutoutAlpha) + dotAlpha));
            if (eyeAlpha > 0) blendPixel(x, y, eyeAlpha);
          }
        }
      }
    }

    // 3. Composite Center Logo Badge with Circular Anti-Aliased Mask
    const logoPng = getCenterLogoPng();
    if (logoPng) {
      const logoW = logoPng.width;
      const logoH = logoPng.height;
      const destX = Math.round(centerPx - logoW / 2);
      const destY = Math.round(centerPy - logoH / 2);
      const logoRadius = 97.5;

      for (let ly = 0; ly < logoH; ly++) {
        for (let lx = 0; lx < logoW; lx++) {
          const cdx = lx - (logoW / 2 - 0.5);
          const cdy = ly - (logoH / 2 - 0.5);
          const dist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (dist > logoRadius + 1.0) continue;

          const maskAlpha = Math.max(0, Math.min(1, logoRadius + 0.5 - dist));
          const srcIdx = (logoW * ly + lx) << 2;
          const srcA = (logoPng.data[srcIdx + 3] / 255) * maskAlpha;

          if (srcA > 0.01) {
            const targetX = destX + lx;
            const targetY = destY + ly;
            if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
              const destIdx = (width * targetY + targetX) << 2;
              png.data[destIdx] = Math.round(png.data[destIdx] * (1 - srcA) + logoPng.data[srcIdx] * srcA);
              png.data[destIdx + 1] = Math.round(png.data[destIdx + 1] * (1 - srcA) + logoPng.data[srcIdx + 1] * srcA);
              png.data[destIdx + 2] = Math.round(png.data[destIdx + 2] * (1 - srcA) + logoPng.data[srcIdx + 2] * srcA);
              png.data[destIdx + 3] = 255;
            }
          }
        }
      }
    }

    return PNG.sync.write(png);
  } catch (err) {
    console.error('[generateStyledQRCode Exception]:', err);
    // Safe standard fallback
    return await QRCode.toBuffer(text, {
      width: 1024,
      margin: 2,
      color: {
        dark: '#45a4de',
        light: '#ffffff'
      }
    });
  }
}

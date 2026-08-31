import QRCode from 'qrcode';
import { Jimp } from 'jimp';

export async function generateStyledQRCode(text: string): Promise<Buffer> {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size; // e.g. 37

  const width = 800;
  const height = 800;
  const margin = 50;
  const gridWidth = width - margin * 2;
  const cellSize = gridWidth / size;
  const cornerR = cellSize * 0.45; // Rounded corner radius for liquid modules

  const image = new Jimp({ width, height, color: 0xFFFFFFFF });

  // Light Blue color: #38A5E2 -> RGBA: 0x38A5E2FF
  const blueColor = 0x38A5E2FF;
  // Lighter blue for left wing of V logo: #BCE3FA -> RGBA: 0xBCE3FAFF
  const lightBlueLogo = 0xBCE3FAFF;
  const whiteColor = 0xFFFFFFFF;

  const centerPx = width / 2;
  const centerPy = height / 2;
  const badgeRadius = 90; // Center circular badge radius

  // Eyes coordinates (7x7 top-left, top-right, bottom-left)
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

  function isInCenterBadgeArea(x: number, y: number): boolean {
    const dx = x - centerPx;
    const dy = y - centerPy;
    return dx * dx + dy * dy <= (badgeRadius + 10) * (badgeRadius + 10);
  }

  function isDarkMod(r: number, c: number): boolean {
    if (r < 0 || r >= size || c < 0 || c >= size) return false;
    if (isInEye(r, c)) return false;
    const modX = margin + (c + 0.5) * cellSize;
    const modY = margin + (r + 0.5) * cellSize;
    if (isInCenterBadgeArea(modX, modY)) return false;
    return qr.modules.get(r, c) === 1;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerPx;
      const dy = y - centerPy;
      const distSq = dx * dx + dy * dy;

      // 1. CENTER BADGE WITH COMPACT TWO-TONE "V" LOGO
      if (distSq <= badgeRadius * badgeRadius) {
        if (distSq > (badgeRadius - 1.5) * (badgeRadius - 1.5)) {
          const alpha = Math.max(0, Math.min(1, (badgeRadius - Math.sqrt(distSq)) / 1.5));
          if (alpha < 0.5) continue;
        }

        const lx = x - centerPx;
        const ly = y - centerPy;

        // Compact V-Logo dimensions (scaled down for exact fit)
        const isLeftArm = (lx >= -28 && lx <= 1 && ly >= -14 && ly <= 18 && (ly - 1.15 * lx >= -2 && ly - 1.15 * lx <= 18));
        const isRightArm = (lx >= -1 && lx <= 28 && ly >= -14 && ly <= 18 && (ly + 1.15 * lx >= -2 && ly + 1.15 * lx <= 18));

        if (isLeftArm) {
          image.setPixelColor(lightBlueLogo, x, y);
        } else if (isRightArm) {
          image.setPixelColor(whiteColor, x, y);
        } else {
          image.setPixelColor(blueColor, x, y);
        }
        continue;
      }

      // 2. CORNER EYE POSITION DETECTION PATTERNS (Deep Smooth Curved Squircles)
      let inEyePattern = false;
      for (const eye of eyes) {
        const eyeX = margin + (eye.c + 3.5) * cellSize;
        const eyeY = margin + (eye.r + 3.5) * cellSize;
        const edx = Math.abs(x - eyeX);
        const edy = Math.abs(y - eyeY);

        const outerSize = 3.5 * cellSize;
        const innerCutout = 2.3 * cellSize;
        const dotSize = 1.35 * cellSize;
        const frameRadius = 1.65 * cellSize; // Deep curved corner radius
        const dotRadius = 0.85 * cellSize;   // Extra rounded center dot

        if (edx <= outerSize && edy <= outerSize) {
          const cdx = Math.max(0, edx - (outerSize - frameRadius));
          const cdy = Math.max(0, edy - (outerSize - frameRadius));
          const outerCornerDist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (outerCornerDist <= frameRadius) {
            const icdx = Math.max(0, edx - (innerCutout - frameRadius * 0.7));
            const icdy = Math.max(0, edy - (innerCutout - frameRadius * 0.7));
            const innerCutDist = Math.sqrt(icdx * icdx + icdy * icdy);

            if (edx <= innerCutout && edy <= innerCutout && innerCutDist <= frameRadius * 0.7) {
              const ddx = Math.max(0, edx - (dotSize - dotRadius));
              const ddy = Math.max(0, edy - (dotSize - dotRadius));
              if (edx <= dotSize && edy <= dotSize && Math.sqrt(ddx * ddx + ddy * ddy) <= dotRadius) {
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

      // 3. LIQUID CONNECTED MODULES ALGORITHM
      const col = Math.floor((x - margin) / cellSize);
      const row = Math.floor((y - margin) / cellSize);

      if (row >= 0 && row < size && col >= 0 && col < size) {
        if (isDarkMod(row, col)) {
          const cellLeft = margin + col * cellSize;
          const cellTop = margin + row * cellSize;
          const pxInCell = x - cellLeft;
          const pyInCell = y - cellTop;

          const topDark = isDarkMod(row - 1, col);
          const bottomDark = isDarkMod(row + 1, col);
          const leftDark = isDarkMod(row, col - 1);
          const rightDark = isDarkMod(row, col + 1);

          // Top-Left corner rounding check
          if (pxInCell < cornerR && pyInCell < cornerR && !topDark && !leftDark) {
            const cdx = cornerR - pxInCell;
            const cdy = cornerR - pyInCell;
            if (cdx * cdx + cdy * cdy > cornerR * cornerR) continue;
          }
          // Top-Right corner rounding check
          if (pxInCell > cellSize - cornerR && pyInCell < cornerR && !topDark && !rightDark) {
            const cdx = pxInCell - (cellSize - cornerR);
            const cdy = cornerR - pyInCell;
            if (cdx * cdx + cdy * cdy > cornerR * cornerR) continue;
          }
          // Bottom-Left corner rounding check
          if (pxInCell < cornerR && pyInCell > cellSize - cornerR && !bottomDark && !leftDark) {
            const cdx = cornerR - pxInCell;
            const cdy = pyInCell - (cellSize - cornerR);
            if (cdx * cdx + cdy * cdy > cornerR * cornerR) continue;
          }
          // Bottom-Right corner rounding check
          if (pxInCell > cellSize - cornerR && pyInCell > cellSize - cornerR && !bottomDark && !rightDark) {
            const cdx = pxInCell - (cellSize - cornerR);
            const cdy = pyInCell - (cellSize - cornerR);
            if (cdx * cdx + cdy * cdy > cornerR * cornerR) continue;
          }

          image.setPixelColor(blueColor, x, y);
        } else {
          // Check for inward rounded corner fillets between adjacent dark modules
          const cellLeft = margin + col * cellSize;
          const cellTop = margin + row * cellSize;
          const pxInCell = x - cellLeft;
          const pyInCell = y - cellTop;

          // Corner 1: Top-Left inward fillet
          if (isDarkMod(row - 1, col) && isDarkMod(row, col - 1) && !isDarkMod(row - 1, col - 1)) {
            if (pxInCell < cornerR && pyInCell < cornerR) {
              const cdx = pxInCell;
              const cdy = pyInCell;
              if (cdx * cdx + cdy * cdy <= cornerR * cornerR) {
                image.setPixelColor(blueColor, x, y);
              }
            }
          }
          // Corner 2: Top-Right inward fillet
          if (isDarkMod(row - 1, col) && isDarkMod(row, col + 1) && !isDarkMod(row - 1, col + 1)) {
            if (pxInCell > cellSize - cornerR && pyInCell < cornerR) {
              const cdx = cellSize - pxInCell;
              const cdy = pyInCell;
              if (cdx * cdx + cdy * cdy <= cornerR * cornerR) {
                image.setPixelColor(blueColor, x, y);
              }
            }
          }
          // Corner 3: Bottom-Left inward fillet
          if (isDarkMod(row + 1, col) && isDarkMod(row, col - 1) && !isDarkMod(row + 1, col - 1)) {
            if (pxInCell < cornerR && pyInCell > cellSize - cornerR) {
              const cdx = pxInCell;
              const cdy = cellSize - pyInCell;
              if (cdx * cdx + cdy * cdy <= cornerR * cornerR) {
                image.setPixelColor(blueColor, x, y);
              }
            }
          }
          // Corner 4: Bottom-Right inward fillet
          if (isDarkMod(row + 1, col) && isDarkMod(row, col + 1) && !isDarkMod(row + 1, col + 1)) {
            if (pxInCell > cellSize - cornerR && pyInCell > cellSize - cornerR) {
              const cdx = cellSize - pxInCell;
              const cdy = cellSize - pyInCell;
              if (cdx * cdx + cdy * cdy <= cornerR * cornerR) {
                image.setPixelColor(blueColor, x, y);
              }
            }
          }
        }
      }
    }
  }

  return await image.getBuffer('image/png');
}

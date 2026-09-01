import { Jimp, loadFont } from "jimp";
import path from "path";
import fs from "fs";

// 1280x720 Banner Specs (16:9 Aspect Ratio)
const WIDTH = 1280;
const HEIGHT = 720;

// Color Definitions (RGBA)
const BG_COLOR = 0x0b0e17ff;         // Deep dark navy
const CARD_BG = 0x0f1420ff;          // Inner card background
const GOLD_COLOR = 0xffc107ff;       // Vibrant gold yellow
const CORAL_COLOR = 0xff3d00ff;      // Bright coral red
const WHITE_COLOR = 0xffffffff;      // Pure white
const BADGE_BG = 0xf0f2f5ff;         // Light silver white for badge
const GRID_COLOR = 0x1a2332ff;       // Grid line color
const GLOW_COLOR = 0x2d3a52ff;       // Soft inner glow

const banners = [
  { filename: "imesh_cloudbot_banner.png", title: "WELCOME", subtitle: "MAIN MENU", accent: 0xff9100ff },
  { filename: "imesh_cloudbot_catalog_banner.png", title: "CATALOG", subtitle: "PRODUCT CENTER", accent: 0x00e676ff },
  { filename: "imesh_cloudbot_profile_banner.png", title: "PROFILE", subtitle: "USER DASHBOARD", accent: 0x00b0ffff },
  { filename: "imesh_cloudbot_orders_banner.png", title: "MY PURCHASES", subtitle: "ORDER CENTER", accent: 0xff3d00ff },
  { filename: "imesh_cloudbot_referral_banner.png", title: "REFERRAL PROGRAM", subtitle: "REWARD CENTER", accent: 0xe040fbff },
  { filename: "imesh_cloudbot_promocode_banner.png", title: "PROMO CODE", subtitle: "REDEEM CENTER", accent: 0xffd600ff },
  { filename: "imesh_cloudbot_transactions_banner.png", title: "TRANSACTIONS", subtitle: "HISTORY CENTER", accent: 0x00bfa5ff },
  { filename: "imesh_cloudbot_balance_banner.png", title: "TOP UP", subtitle: "BALANCE CENTER", accent: 0x76ff03ff },
  { filename: "imesh_cloudbot_info_banner.png", title: "USEFUL LINKS", subtitle: "INFO CENTER", accent: 0x29b6f6ff },
  { filename: "imesh_cloudbot_payment_banner.png", title: "PAYMENT", subtitle: "CHECKOUT CENTER", accent: 0xffab00ff },
  { filename: "imesh_cloudbot_currency_banner.png", title: "CURRENCY", subtitle: "PRICE DISPLAY", accent: 0xab47bcff },
  { filename: "imesh_cloudbot_settings_banner.png", title: "SETTINGS", subtitle: "PREFERENCES", accent: 0x78909cff },
];

async function generateBanners() {
  const font64Path = path.resolve("node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-64-white/open-sans-64-white.fnt");
  const font32Path = path.resolve("node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-32-white/open-sans-32-white.fnt");
  const font16Path = path.resolve("node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-16-black/open-sans-16-black.fnt");

  const font64 = await loadFont(font64Path);
  const font32 = await loadFont(font32Path);
  const font16 = await loadFont(font16Path);

  const publicDir = path.resolve("public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  for (const item of banners) {
    console.log(`Generating 16:9 ultra banner: ${item.filename} (${item.title})...`);

    // Create 1280x720 canvas
    const img = new Jimp({ width: WIDTH, height: HEIGHT, color: BG_COLOR });

    // 1. Draw Perspective Grid Background
    for (let x = 0; x < WIDTH; x += 40) {
      for (let y = 0; y < HEIGHT; y++) {
        if (x % 80 === 0) {
          img.setPixelColor(GRID_COLOR, x, y);
        }
      }
    }
    for (let y = 0; y < HEIGHT; y += 40) {
      for (let x = 0; x < WIDTH; x++) {
        img.setPixelColor(GRID_COLOR, x, y);
      }
    }

    // Add bright starry background dots
    const starCoords = [
      [150, 100], [350, 80], [900, 60], [1100, 120],
      [200, 650], [450, 680], [850, 670], [1050, 630],
      [50, 300], [1230, 250], [60, 480], [1220, 500]
    ];
    for (const [sx, sy] of starCoords) {
      img.setPixelColor(WHITE_COLOR, sx, sy);
      img.setPixelColor(WHITE_COLOR, sx + 1, sy);
      img.setPixelColor(WHITE_COLOR, sx, sy + 1);
    }

    // 2. Draw Top Right Coral Red Corner Ribbon
    for (let y = 0; y < 140; y++) {
      for (let x = WIDTH - (140 - y) * 2; x < WIDTH; x++) {
        if (x >= 0 && x < WIDTH) {
          img.setPixelColor(CORAL_COLOR, x, y);
        }
      }
    }

    // 3. Draw Bottom Left Golden Yellow Corner Ribbon
    for (let y = HEIGHT - 140; y < HEIGHT; y++) {
      for (let x = 0; x < (y - (HEIGHT - 140)) * 2; x++) {
        if (x >= 0 && x < WIDTH) {
          img.setPixelColor(GOLD_COLOR, x, y);
        }
      }
    }

    // 4. Draw Main Card Container (60, 50, 1160, 620)
    const cardX = 60;
    const cardY = 50;
    const cardW = 1160;
    const cardH = 620;
    const borderRadius = 32;

    for (let y = cardY; y < cardY + cardH; y++) {
      for (let x = cardX; x < cardX + cardW; x++) {
        const inTL = (x - (cardX + borderRadius)) ** 2 + (y - (cardY + borderRadius)) ** 2 <= borderRadius ** 2;
        const inTR = (x - (cardX + cardW - borderRadius)) ** 2 + (y - (cardY + borderRadius)) ** 2 <= borderRadius ** 2;
        const inBL = (x - (cardX + borderRadius)) ** 2 + (y - (cardY + cardH - borderRadius)) ** 2 <= borderRadius ** 2;
        const inBR = (x - (cardX + cardW - borderRadius)) ** 2 + (y - (cardY + cardH - borderRadius)) ** 2 <= borderRadius ** 2;

        const isCornerZone =
          (x < cardX + borderRadius && y < cardY + borderRadius) ||
          (x > cardX + cardW - borderRadius && y < cardY + borderRadius) ||
          (x < cardX + borderRadius && y > cardY + cardH - borderRadius) ||
          (x > cardX + cardW - borderRadius && y > cardY + cardH - borderRadius);

        const insideCard = !isCornerZone || inTL || inTR || inBL || inBR;

        if (insideCard) {
          const isBorder =
            x < cardX + 4 || x >= cardX + cardW - 4 ||
            y < cardY + 4 || y >= cardY + cardH - 4 ||
            (inTL && (x - (cardX + borderRadius)) ** 2 + (y - (cardY + borderRadius)) ** 2 >= (borderRadius - 4) ** 2) ||
            (inTR && (x - (cardX + cardW - borderRadius)) ** 2 + (y - (cardY + borderRadius)) ** 2 >= (borderRadius - 4) ** 2) ||
            (inBL && (x - (cardX + borderRadius)) ** 2 + (y - (cardY + cardH - borderRadius)) ** 2 >= (borderRadius - 4) ** 2) ||
            (inBR && (x - (cardX + cardW - borderRadius)) ** 2 + (y - (cardY + cardH - borderRadius)) ** 2 >= (borderRadius - 4) ** 2);

          if (isBorder) {
            img.setPixelColor(GOLD_COLOR, x, y);
          } else {
            // Subtle Radial Inner Lighting Effect inside Card
            const distCenter = Math.sqrt((x - 640) ** 2 + (y - 360) ** 2);
            if (distCenter < 280) {
              img.setPixelColor(GLOW_COLOR, x, y);
            } else {
              img.setPixelColor(CARD_BG, x, y);
            }
          }
        }
      }
    }

    // 5. Draw 4 Decorative Corner Circles (Matching Design Frame)
    const corners = [
      [cardX + 12, cardY + 12],
      [cardX + cardW - 12, cardY + 12],
      [cardX + 12, cardY + cardH - 12],
      [cardX + cardW - 12, cardY + cardH - 12]
    ];
    for (const [cx, cy] of corners) {
      const circleR = 26;
      for (let cy_pos = cy - circleR; cy_pos <= cy + circleR; cy_pos++) {
        for (let cx_pos = cx - circleR; cx_pos <= cx + circleR; cx_pos++) {
          const distSq = (cx_pos - cx) ** 2 + (cy_pos - cy) ** 2;
          if (distSq <= circleR ** 2 && distSq >= (circleR - 3) ** 2) {
            if (cx_pos >= 0 && cx_pos < WIDTH && cy_pos >= 0 && cy_pos < HEIGHT) {
              img.setPixelColor(GOLD_COLOR, cx_pos, cy_pos);
            }
          }
        }
      }
    }

    // 6. Draw Top Left White Glass Badge Pill ("IMESH CLOUD STORE")
    const badgeX = 90;
    const badgeY = 85;
    const badgeW = 260;
    const badgeH = 44;
    const badgeR = 22;

    for (let y = badgeY; y < badgeY + badgeH; y++) {
      for (let x = badgeX; x < badgeX + badgeW; x++) {
        const inTL = (x - (badgeX + badgeR)) ** 2 + (y - (badgeY + badgeR)) ** 2 <= badgeR ** 2;
        const inTR = (x - (badgeX + badgeW - badgeR)) ** 2 + (y - (badgeY + badgeR)) ** 2 <= badgeR ** 2;
        const inBL = (x - (badgeX + badgeR)) ** 2 + (y - (badgeY + badgeH - badgeR)) ** 2 <= badgeR ** 2;
        const inBR = (x - (badgeX + badgeW - badgeR)) ** 2 + (y - (badgeY + badgeW - badgeR)) ** 2 <= badgeR ** 2;

        const isCornerZone =
          (x < badgeX + badgeR && y < badgeY + badgeR) ||
          (x > badgeX + badgeW - badgeR && y < badgeY + badgeR) ||
          (x < badgeX + badgeR && y > badgeY + badgeH - badgeR) ||
          (x > badgeX + badgeW - badgeR && y > badgeY + badgeH - badgeR);

        if (!isCornerZone || inTL || inTR || inBL || inBR) {
          img.setPixelColor(BADGE_BG, x, y);
        }
      }
    }

    // Print Badge Text
    img.print({ font: font16, x: badgeX + 18, y: badgeY + 12, text: "IMESH CLOUD STORE" });

    // 7. Draw Center Title Text (64px White)
    img.print({
      font: font64,
      x: 0,
      y: 245,
      text: {
        text: item.title,
        alignmentX: 2, // CENTER
      },
      maxWidth: WIDTH
    });

    // 8. Draw Subtitle Capsule Pill Frame with Section Accent Border
    const subW = Math.max(290, item.subtitle.length * 20 + 60);
    const subH = 56;
    const subX = Math.round((WIDTH - subW) / 2);
    const subY = 365;
    const subR = 28;

    for (let y = subY; y < subY + subH; y++) {
      for (let x = subX; x < subX + subW; x++) {
        const inTL = (x - (subX + subR)) ** 2 + (y - (subY + subR)) ** 2 <= subR ** 2;
        const inTR = (x - (subX + subW - subR)) ** 2 + (y - (subY + subR)) ** 2 <= subR ** 2;
        const inBL = (x - (subX + subR)) ** 2 + (y - (subY + subH - subR)) ** 2 <= subR ** 2;
        const inBR = (x - (subX + subW - subR)) ** 2 + (y - (subY + subH - subR)) ** 2 <= subR ** 2;

        const isCornerZone =
          (x < subX + subR && y < subY + subR) ||
          (x > subX + subW - subR && y < subY + subR) ||
          (x < subX + subR && y > subY + subH - subR) ||
          (x > subX + subW - subR && y > subY + subH - subR);

        const insideSub = !isCornerZone || inTL || inTR || inBL || inBR;

        if (insideSub) {
          const isBorder =
            x < subX + 3 || x >= subX + subW - 3 ||
            y < subY + 3 || y >= subY + subH - 3 ||
            (inTL && (x - (subX + subR)) ** 2 + (y - (subY + subR)) ** 2 >= (subR - 3) ** 2) ||
            (inTR && (x - (subX + subW - subR)) ** 2 + (y - (subY + subR)) ** 2 >= (subR - 3) ** 2) ||
            (inBL && (x - (subX + subR)) ** 2 + (y - (subY + subR)) ** 2 >= (subR - 3) ** 2) ||
            (inBR && (x - (subX + subW - subR)) ** 2 + (y - (subY + subH - subR)) ** 2 >= (subR - 3) ** 2);

          if (isBorder) {
            img.setPixelColor(GOLD_COLOR, x, y);
          } else {
            img.setPixelColor(CARD_BG, x, y);
          }
        }
      }
    }

    // Print Subtitle Text (32px White) inside Subtitle Capsule Pill
    img.print({
      font: font32,
      x: subX,
      y: subY + 11,
      text: {
        text: item.subtitle,
        alignmentX: 2, // CENTER
      },
      maxWidth: subW
    });

    // 9. Draw Bottom Accent Lines
    const lineY = 590;
    for (let x = 90; x < 950; x++) {
      img.setPixelColor(GOLD_COLOR, x, lineY);
      img.setPixelColor(GOLD_COLOR, x, lineY + 1);
    }
    for (let x = 90; x < 720; x++) {
      img.setPixelColor(CORAL_COLOR, x, lineY + 6);
      img.setPixelColor(CORAL_COLOR, x, lineY + 7);
    }

    // 10. Draw Bottom Right Circular Play Button Icon (Golden Circle with White Play Triangle)
    const playCenterX = 1100;
    const playCenterY = 570;
    const playR = 42;

    for (let y = playCenterY - playR; y <= playCenterY + playR; y++) {
      for (let x = playCenterX - playR; x <= playCenterX + playR; x++) {
        const distSq = (x - playCenterX) ** 2 + (y - playCenterY) ** 2;
        if (distSq <= playR ** 2) {
          img.setPixelColor(GOLD_COLOR, x, y);
        }
      }
    }

    // Draw White Play Triangle inside golden circle
    for (let py = -20; py <= 20; py++) {
      const maxX = Math.round(20 * (1 - Math.abs(py) / 20));
      for (let px = -10; px <= -10 + maxX; px++) {
        img.setPixelColor(WHITE_COLOR, playCenterX + px + 4, playCenterY + py);
      }
    }

    // Save image file in public/
    const targetPath = path.join(publicDir, item.filename);
    await img.write(targetPath);
    console.log(`Saved ultra banner: ${targetPath}`);
  }

  console.log("All 12 banners regenerated successfully!");
}

generateBanners().catch(err => {
  console.error("Banner generation error:", err);
  process.exit(1);
});

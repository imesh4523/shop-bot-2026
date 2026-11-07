import { Jimp, loadFont } from "jimp";
import path from "path";
import fs from "fs";

// 1280x720 Specs (16:9 Landscape)
const WIDTH = 1280;
const HEIGHT = 720;

const BG_COLOR = 0x090c12ff;     // Dark cyber obsidian
const CARD_BG = 0x0e131dff;      // Inner card texture
const PCB_GRID = 0x161f2eff;      // PCB circuit line color
const WHITE_COLOR = 0xffffffff;  // Pure white

const banners = [
  { filename: "imesh_cloudbot_banner.png", title: "WELCOME", subtitle: "MAIN MENU", neon: 0x00e676ff },
  { filename: "imesh_cloudbot_catalog_banner.png", title: "CATALOG", subtitle: "PRODUCT CENTER", neon: 0x00e5ffff },
  { filename: "imesh_cloudbot_profile_banner.png", title: "PROFILE", subtitle: "USER DASHBOARD", neon: 0x00b0ffff },
  { filename: "imesh_cloudbot_balance_banner.png", title: "BALANCE", subtitle: "USER WALLET", neon: 0x00e676ff },
  { filename: "imesh_cloudbot_payment_banner.png", title: "PAYMENT", subtitle: "CHECKOUT CENTER", neon: 0xffd600ff },
  { filename: "imesh_cloudbot_orders_banner.png", title: "MY PURCHASES", subtitle: "ORDER CENTER", neon: 0xff3d00ff },
  { filename: "imesh_cloudbot_referral_banner.png", title: "REFERRAL PROGRAM", subtitle: "REWARD CENTER", neon: 0xe040fbff },
  { filename: "imesh_cloudbot_promocode_banner.png", title: "PROMO CODE", subtitle: "REDEEM CENTER", neon: 0xffab00ff },
  { filename: "imesh_cloudbot_transactions_banner.png", title: "TRANSACTIONS", subtitle: "HISTORY CENTER", neon: 0x00bfa5ff },
  { filename: "imesh_cloudbot_info_banner.png", title: "USEFUL LINKS", subtitle: "INFO CENTER", neon: 0x29b6f6ff },
  { filename: "imesh_cloudbot_currency_banner.png", title: "CURRENCY", subtitle: "PRICE DISPLAY", neon: 0xab47bcff },
  { filename: "imesh_cloudbot_settings_banner.png", title: "SETTINGS", subtitle: "PREFERENCES", neon: 0x00e5ffff },
];

async function generateAllFinalBanners() {
  const font64Path = path.resolve("node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-64-white/open-sans-64-white.fnt");
  const font32Path = path.resolve("node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-32-white/open-sans-32-white.fnt");
  const font16Path = path.resolve("node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-16-black/open-sans-16-black.fnt");

  const font64 = await loadFont(font64Path);
  const font32 = await loadFont(font32Path);
  const font16 = await loadFont(font16Path);

  const publicDir = path.resolve("public");

  for (const item of banners) {
    console.log(`Generating final cyber banner: ${item.filename} (${item.title})...`);

    const img = new Jimp({ width: WIDTH, height: HEIGHT, color: BG_COLOR });

    // 1. Draw PCB Circuit Board Grid Texture
    for (let x = 0; x < WIDTH; x += 40) {
      for (let y = 0; y < HEIGHT; y++) {
        if (x % 80 === 0) img.setPixelColor(PCB_GRID, x, y);
      }
    }
    for (let y = 0; y < HEIGHT; y += 40) {
      for (let x = 0; x < WIDTH; x++) {
        img.setPixelColor(PCB_GRID, x, y);
      }
    }

    // Add PCB Circuit Nodes (Dots & Traces)
    const pcbNodes = [
      [200, 150], [400, 120], [880, 140], [1080, 180],
      [180, 560], [420, 580], [860, 570], [1100, 520],
      [140, 360], [1140, 340]
    ];
    for (const [nx, ny] of pcbNodes) {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
          if (dx * dx + dy * dy <= 9) {
            img.setPixelColor(item.neon, nx + dx, ny + dy);
          }
        }
      }
    }

    // 2. Draw Rounded Outer Cyber Glass Container (60, 50, 1160, 620)
    const cardX = 60;
    const cardY = 50;
    const cardW = 1160;
    const cardH = 620;
    const borderRadius = 40;

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
          // 4px Glowing Neon Border
          const isBorder =
            x < cardX + 4 || x >= cardX + cardW - 4 ||
            y < cardY + 4 || y >= cardY + cardH - 4 ||
            (inTL && (x - (cardX + borderRadius)) ** 2 + (y - (cardY + borderRadius)) ** 2 >= (borderRadius - 4) ** 2) ||
            (inTR && (x - (cardX + cardW - borderRadius)) ** 2 + (y - (cardY + borderRadius)) ** 2 >= (borderRadius - 4) ** 2) ||
            (inBL && (x - (cardX + borderRadius)) ** 2 + (y - (cardY + cardH - borderRadius)) ** 2 >= (borderRadius - 4) ** 2) ||
            (inBR && (x - (cardX + cardW - borderRadius)) ** 2 + (y - (cardY + cardH - borderRadius)) ** 2 >= (borderRadius - 4) ** 2);

          if (isBorder) {
            img.setPixelColor(item.neon, x, y);
          } else {
            img.setPixelColor(CARD_BG, x, y);
          }
        }
      }
    }

    // 3. Draw Top Left White Badge Pill ("IMESH CLOUD STORE")
    const badgeX = 95;
    const badgeY = 85;
    const badgeW = 260;
    const badgeH = 44;
    const badgeR = 22;

    for (let y = badgeY; y < badgeY + badgeH; y++) {
      for (let x = badgeX; x < badgeX + badgeW; x++) {
        const inTL = (x - (badgeX + badgeR)) ** 2 + (y - (badgeY + badgeR)) ** 2 <= badgeR ** 2;
        const inTR = (x - (badgeX + badgeW - badgeR)) ** 2 + (y - (badgeY + badgeR)) ** 2 <= badgeR ** 2;
        const inBL = (x - (badgeX + badgeR)) ** 2 + (y - (badgeY + badgeH - badgeR)) ** 2 <= badgeR ** 2;
        const inBR = (x - (badgeX + badgeW - badgeR)) ** 2 + (y - (badgeY + badgeH - badgeR)) ** 2 <= badgeR ** 2;

        const isCornerZone =
          (x < badgeX + badgeR && y < badgeY + badgeR) ||
          (x > badgeX + badgeW - badgeR && y < badgeY + badgeR) ||
          (x < badgeX + badgeR && y > badgeY + badgeH - badgeR) ||
          (x > badgeX + badgeW - badgeR && y > badgeY + badgeH - badgeR);

        if (!isCornerZone || inTL || inTR || inBL || inBR) {
          img.setPixelColor(0xf0f2f5ff, x, y);
        }
      }
    }
    img.print({ font: font16, x: badgeX + 18, y: badgeY + 12, text: "IMESH CLOUD STORE" });

    // 4. Center Bold Title Text (64px White)
    img.print({
      font: font64,
      x: 0,
      y: 250,
      text: { text: item.title, alignmentX: 2 },
      maxWidth: WIDTH
    });

    // 5. Centered Subtitle Capsule Pill with Neon Border
    const subW = Math.max(300, item.subtitle.length * 22 + 60);
    const subH = 58;
    const subX = Math.round((WIDTH - subW) / 2);
    const subY = 375;
    const subR = 29;

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
            img.setPixelColor(item.neon, x, y);
          } else {
            img.setPixelColor(CARD_BG, x, y);
          }
        }
      }
    }
    img.print({ font: font32, x: subX, y: subY + 12, text: { text: item.subtitle, alignmentX: 2 }, maxWidth: subW });

    // 6. Bottom Right Circular Neon Play Button Icon
    const playCenterX = 1100;
    const playCenterY = 560;
    const playR = 46;

    for (let y = playCenterY - playR; y <= playCenterY + playR; y++) {
      for (let x = playCenterX - playR; x <= playCenterX + playR; x++) {
        if ((x - playCenterX) ** 2 + (y - playCenterY) ** 2 <= playR ** 2) {
          img.setPixelColor(item.neon, x, y);
        }
      }
    }
    // Draw Dark Play Triangle
    for (let py = -22; py <= 22; py++) {
      const maxX = Math.round(22 * (1 - Math.abs(py) / 22));
      for (let px = -12; px <= -12 + maxX; px++) {
        img.setPixelColor(0x0e131dff, playCenterX + px + 5, playCenterY + py);
      }
    }

    // Save in public/
    const targetPath = path.join(publicDir, item.filename);
    await img.write(targetPath);
    console.log(`Saved final cyber banner: ${targetPath}`);
  }

  console.log("ALL 12 FINAL CYBER BANNERS GENERATED SUCCESSFULLY!");
}

generateAllFinalBanners().catch(console.error);

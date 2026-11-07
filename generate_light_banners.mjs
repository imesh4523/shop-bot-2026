import { Jimp, loadFont } from "jimp";
import path from "path";
import fs from "fs";

const baseUploadedImage = "C:\\Users\\Administrator\\.gemini\\antigravity-ide\\brain\\959fee94-9679-4f75-b4d4-4759213192d6\\.user_uploaded\\media_1790077287683.png";
const catalogImg = "C:\\Users\\Administrator\\.gemini\\antigravity-ide\\brain\\959fee94-9679-4f75-b4d4-4759213192d6\\catalog_banner_1790077391496.jpg";
const profileImg = "C:\\Users\\Administrator\\.gemini\antigravity-ide\\brain\\959fee94-9679-4f75-b4d4-4759213192d6\\profile_banner_1790077411565.jpg";
const ordersImg = "C:\\Users\\Administrator\\.gemini\\antigravity-ide\\brain\\959fee94-9679-4f75-b4d4-4759213192d6\\orders_banner_1790077433672.jpg";

const publicDir = path.resolve("public");
const distPublicDir = path.resolve("dist", "public");

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(distPublicDir)) fs.mkdirSync(distPublicDir, { recursive: true });

async function run() {
  console.log("🎨 Starting Light 3D Banner Generation in exact reference style...");

  // 1. Direct copy for AI generated ultra-exact banners
  fs.copyFileSync(baseUploadedImage, path.join(publicDir, "imesh_cloudbot_banner.png"));
  fs.copyFileSync(baseUploadedImage, path.join(distPublicDir, "imesh_cloudbot_banner.png"));
  console.log("✅ imesh_cloudbot_banner.png (Main Menu) updated with user template!");

  if (fs.existsSync(catalogImg)) {
    fs.copyFileSync(catalogImg, path.join(publicDir, "imesh_cloudbot_catalog_banner.png"));
    fs.copyFileSync(catalogImg, path.join(distPublicDir, "imesh_cloudbot_catalog_banner.png"));
    console.log("✅ imesh_cloudbot_catalog_banner.png (Catalog) updated!");
  }

  if (fs.existsSync(profileImg)) {
    fs.copyFileSync(profileImg, path.join(publicDir, "imesh_cloudbot_profile_banner.png"));
    fs.copyFileSync(profileImg, path.join(distPublicDir, "imesh_cloudbot_profile_banner.png"));
    console.log("✅ imesh_cloudbot_profile_banner.png (Profile) updated!");
  }

  if (fs.existsSync(ordersImg)) {
    fs.copyFileSync(ordersImg, path.join(publicDir, "imesh_cloudbot_orders_banner.png"));
    fs.copyFileSync(ordersImg, path.join(distPublicDir, "imesh_cloudbot_orders_banner.png"));
    console.log("✅ imesh_cloudbot_orders_banner.png (Orders) updated!");
  }

  // 2. Composite remaining banners by custom rendering the glowing gradient pill button
  const font32Path = path.resolve("node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-32-white/open-sans-32-white.fnt");
  const font32 = await loadFont(font32Path);

  const customBanners = [
    { file: "imesh_cloudbot_balance_banner.png", text: "TOP UP BALANCE", base: baseUploadedImage },
    { file: "imesh_cloudbot_payment_banner.png", text: "PAYMENT CENTER", base: baseUploadedImage },
    { file: "imesh_cloudbot_referral_banner.png", text: "REFERRAL PROGRAM", base: baseUploadedImage },
    { file: "imesh_cloudbot_promocode_banner.png", text: "PROMO CODE", base: baseUploadedImage },
    { file: "imesh_cloudbot_transactions_banner.png", text: "TRANSACTIONS", base: baseUploadedImage },
    { file: "imesh_cloudbot_info_banner.png", text: "USEFUL LINKS", base: baseUploadedImage },
    { file: "imesh_cloudbot_currency_banner.png", text: "CURRENCY", base: baseUploadedImage },
    { file: "imesh_cloudbot_settings_banner.png", text: "SETTINGS", base: baseUploadedImage },
    { file: "imesh_cloudbot_binance_banner.png", text: "BINANCE PAY", base: baseUploadedImage },
    { file: "imesh_cloudbot_cryptobot_banner.png", text: "CRYPTO BOT", base: baseUploadedImage },
    { file: "imesh_cloudbot_trc20_banner.png", text: "TRC20 USDT", base: baseUploadedImage },
    { file: "imesh_cloudbot_bep20_banner.png", text: "BEP20 USDT", base: baseUploadedImage },
    { file: "imesh_cloudbot_aptos_banner.png", text: "APTOS PAY", base: baseUploadedImage },
  ];

  for (const b of customBanners) {
    console.log(`Rendering matching banner for: ${b.file} (${b.text})...`);
    const img = await Jimp.read(b.base);
    const W = img.bitmap.width;
    const H = img.bitmap.height;

    // Calculate pill button geometry scaled to image size
    // In reference 1920x1080: pill center is approx (x: 960, y: 660, w: 760, h: 180)
    // Or in relative coords:
    const pillCenterX = Math.round(W * 0.50);
    const pillCenterY = Math.round(H * 0.61);
    const pillWidth = Math.round(Math.max(W * 0.38, b.text.length * (W * 0.016) + (W * 0.12)));
    const pillHeight = Math.round(H * 0.16);
    const pillRadius = Math.round(pillHeight / 2);
    const pillX = Math.round(pillCenterX - pillWidth / 2);
    const pillY = Math.round(pillCenterY - pillHeight / 2);

    // Render smooth multi-color sunset gradient pill (Orange -> Magenta -> Indigo -> Cyan)
    for (let y = pillY; y < pillY + pillHeight; y++) {
      for (let x = pillX; x < pillX + pillWidth; x++) {
        const inLeftCircle = (x - (pillX + pillRadius)) ** 2 + (y - (pillY + pillRadius)) ** 2 <= pillRadius ** 2;
        const inRightCircle = (x - (pillX + pillWidth - pillRadius)) ** 2 + (y - (pillY + pillRadius)) ** 2 <= pillRadius ** 2;
        const inCenterRect = x >= pillX + pillRadius && x <= pillX + pillWidth - pillRadius;

        if (inLeftCircle || inRightCircle || inCenterRect) {
          const t = (x - pillX) / pillWidth; // 0.0 to 1.0

          // Interpolate Colors: (255, 140, 0) -> (255, 0, 128) -> (70, 50, 255) -> (0, 150, 255)
          let r, g, b_val;
          if (t < 0.33) {
            const st = t / 0.33;
            r = Math.round(255 * (1 - st) + 255 * st);
            g = Math.round(140 * (1 - st) + 0 * st);
            b_val = Math.round(0 * (1 - st) + 128 * st);
          } else if (t < 0.66) {
            const st = (t - 0.33) / 0.33;
            r = Math.round(255 * (1 - st) + 70 * st);
            g = Math.round(0 * (1 - st) + 50 * st);
            b_val = Math.round(128 * (1 - st) + 255 * st);
          } else {
            const st = (t - 0.66) / 0.34;
            r = Math.round(70 * (1 - st) + 0 * st);
            g = Math.round(50 * (1 - st) + 160 * st);
            b_val = Math.round(255 * (1 - st) + 255 * st);
          }

          // Top highlight / glass shine
          if (y < pillY + pillHeight * 0.35) {
            r = Math.min(255, r + 40);
            g = Math.min(255, g + 40);
            b_val = Math.min(255, b_val + 40);
          }

          const color = (r << 24) | (g << 16) | (b_val << 8) | 0xff;
          img.setPixelColor(color, x, y);
        }
      }
    }

    // Outer glow border
    const borderThickness = 4;
    for (let y = pillY - borderThickness; y <= pillY + pillHeight + borderThickness; y++) {
      for (let x = pillX - borderThickness; x <= pillX + pillWidth + borderThickness; x++) {
        const distL = Math.sqrt((x - (pillX + pillRadius)) ** 2 + (y - (pillY + pillRadius)) ** 2);
        const distR = Math.sqrt((x - (pillX + pillWidth - pillRadius)) ** 2 + (y - (pillY + pillRadius)) ** 2);
        const isBorderL = distL >= pillRadius && distL <= pillRadius + borderThickness && x < pillX + pillRadius;
        const isBorderR = distR >= pillRadius && distR <= pillRadius + borderThickness && x > pillX + pillWidth - pillRadius;
        const isBorderTopBottom = (Math.abs(y - pillY) <= borderThickness || Math.abs(y - (pillY + pillHeight)) <= borderThickness) && x >= pillX + pillRadius && x <= pillX + pillWidth - pillRadius;

        if (isBorderL || isBorderR || isBorderTopBottom) {
          if (x >= 0 && x < W && y >= 0 && y < H) {
            img.setPixelColor(0xffffffcc, x, y); // Semi-transparent white glow
          }
        }
      }
    }

    // Draw Arrow circle icon on left of pill
    const arrowCircleX = pillX + Math.round(pillHeight * 0.5);
    const arrowCircleY = pillCenterY;
    const arrowRadius = Math.round(pillHeight * 0.36);

    for (let y = arrowCircleY - arrowRadius; y <= arrowCircleY + arrowRadius; y++) {
      for (let x = arrowCircleX - arrowRadius; x <= arrowCircleX + arrowRadius; x++) {
        const d = Math.sqrt((x - arrowCircleX) ** 2 + (y - arrowCircleY) ** 2);
        if (d <= arrowRadius && d >= arrowRadius - 3) {
          img.setPixelColor(0xffffffff, x, y);
        }
      }
    }

    // Print Text centered in remaining space
    const textStartX = pillX + Math.round(pillHeight * 1.05);
    const textAvailableW = pillWidth - Math.round(pillHeight * 1.2);
    img.print({
      font: font32,
      x: textStartX,
      y: pillCenterY - 18,
      text: {
        text: `->  ${b.text}`,
        alignmentX: 2 // Center
      },
      maxWidth: textAvailableW
    });

    // Save banner to both public and dist/public
    await img.write(path.join(publicDir, b.file));
    await img.write(path.join(distPublicDir, b.file));
    console.log(`✅ Saved ${b.file}`);
  }

  console.log("🎉 All 3D Light Banners generated and deployed successfully!");
}

run().catch(console.error);

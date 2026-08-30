import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import path from "path";
import axios from "axios";

// Read token from db/env
import dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || "";
console.log("Token present:", !!token);

const banner1 = path.join(process.cwd(), "public", "imesh_cloudbot_banner.png");
const banner2 = path.join(process.cwd(), "public", "imesh_cloudbot_catalog_banner.png");

console.log("Banner 1 exists:", fs.existsSync(banner1));
console.log("Banner 2 exists:", fs.existsSync(banner2));

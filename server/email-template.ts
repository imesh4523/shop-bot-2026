/**
 * YouuHost Luxury Email Templates & Dispatch Engine
 * Generates responsive, pixel-perfect HTML emails matching the official YouuHost & AgentBunny luxury design system
 * and generates downloadable/attachable PDF invoices.
 * 
 * Uses email-client-safe rendering (table layout, inline styles, verified badges & icons8 CDN assets)
 * so Gmail, Apple Mail, Outlook, iOS, and Android display 100% of the content without stripping.
 */

import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

export interface TransactionEmailProps {
  toEmail: string;
  recipientName?: string;
  subject?: string;
  planTitle?: string;
  amount: string; // e.g. "LKR 14,990.00" or "$50.00 USD"
  secondaryAmount?: string;
  referenceId: string; // e.g. "INV-2026-812010"
  paymentMethod: "card" | "payhere" | "mastercard" | "visa" | "binance" | "binance_pay" | "cryptomus" | "crypto" | "wallet_balance" | string;
  paymentMethodDetails?: string; // e.g. "Mastercard ending in •••• 9876"
  dateStr?: string;
  billingCycle?: string; // e.g. "Monthly"
  ctaText?: string;
  ctaUrl?: string;
  customNote?: string;
  credentials?: string[];
  newBalance?: string;
}

export interface OrderCredentialsEmailProps {
  toEmail: string;
  recipientName?: string;
  subject?: string;
  orderId: string | number;
  productName: string;
  quantity: number;
  amount: string; // e.g. "$5.50 USD" or "Rs. 1,815 LKR"
  credentials?: string[];
  dateStr?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export interface OtpEmailProps {
  toEmail: string;
  recipientName?: string;
  otpCode: string;
  expiryMinutes?: number;
  ipAddress?: string;
}

export interface CustomEmailProps {
  toEmail: string;
  recipientName?: string;
  subject: string;
  badgeText?: string;
  badgeColor?: string;
  heading: string;
  message: string;
  ctaText?: string;
  ctaUrl?: string;
  detailsList?: { label: string; value: string }[];
}

/**
 * Clean and format currency string so it never shows dual/mixed conversions or garbled non-ascii chars
 */
export function sanitizeCurrencyAmount(amountRaw: string, fallbackDefault = "LKR 14,990.00"): string {
  if (!amountRaw || typeof amountRaw !== "string") return fallbackDefault;
  let str = amountRaw.trim();

  // If contains dual conversion parentheses e.g. "LKR 14,990.00 (≈ $50.00 USD)" or "$5.50 USD (≈ Rs. 1,815 LKR)"
  if (str.includes("(") || str.includes("≈") || str.includes("~")) {
    const parts = str.split(/[\(≈~]/);
    str = (parts[0] || "").trim();
  }

  // Remove any non-ASCII characters that can break jsPDF
  str = str.replace(/[^\x20-\x7E]/g, "").trim();

  // If LKR format
  if (str.toUpperCase().includes("LKR") || str.toUpperCase().includes("RS")) {
    const numMatch = str.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
    if (numMatch) {
      const val = parseFloat(numMatch[1]);
      if (str.toUpperCase().includes("RS")) {
        return `Rs. ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LKR`;
      }
      return `LKR ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  // If USD format
  if (str.toUpperCase().includes("USD") || str.includes("$")) {
    const numMatch = str.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
    if (numMatch) {
      const val = parseFloat(numMatch[1]);
      return `$${val.toFixed(2)} USD`;
    }
  }

  return str || fallbackDefault;
}

/**
 * Helper to get YouuHost Logo Public URL
 */
function getLogoDataUri(): string {
  return "https://youuhost.com/youuhost_gradient_logo.png";
}

/**
 * Generate PDF Invoice matching Image 2 table layout & AgentBunny standards
 */
export function generateInvoicePdf(props: TransactionEmailProps): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const invoiceNo = props.referenceId || `INV-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateStr = props.dateStr || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const recipientName = props.recipientName || "Valued Customer";
  const toEmail = props.toEmail || "customer@youuhost.com";
  const plan = props.planTitle || "Enterprise Cloud Service";
  const billingCycle = props.billingCycle || "Monthly";
  const amount = sanitizeCurrencyAmount(props.amount || "LKR 14,990.00");

  const left = 20;
  const right = 190;
  let y = 28;

  // Header (Logo on Left, INVOICE on Right)
  try {
    const logoPath = path.join(process.cwd(), "public", "youuhost_gradient_logo.png");
    if (fs.existsSync(logoPath)) {
      const imgData = fs.readFileSync(logoPath);
      doc.addImage(imgData, "PNG", left, y - 8, 46, 13);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(0, 209, 102);
      doc.text("youu", left, y);
      doc.setTextColor(17, 24, 39);
      doc.text("host", left + 17, y);
    }
  } catch (e) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 209, 102);
    doc.text("youuhost", left, y);
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("INVOICE", right, y, { align: "right" });

  y += 12;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(left, y, right, y);

  y += 12;

  // Invoice Details & Billed To
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Invoice Details:", left, y);
  doc.text("Billed To:", 120, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);

  doc.text(`Invoice No: ${invoiceNo}`, left, y);
  doc.setTextColor(17, 24, 39);
  doc.text(recipientName, 120, y);

  y += 5;
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${dateStr}`, left, y);
  doc.text(toEmail, 120, y);

  y += 5;
  doc.text("Payment Status: ", left, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 209, 102);
  doc.text("PAID", left + 26, y);

  y += 16;

  // Table Header matching Image 2: Description, Unit price, Qty, Amount
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(left, y - 2, right, y - 2);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Description", left, y + 4);
  doc.text("Unit price", 120, y + 4, { align: "right" });
  doc.text("Qty", 145, y + 4, { align: "center" });
  doc.text("Amount", right, y + 4, { align: "right" });

  doc.line(left, y + 7, right, y + 7);

  y += 15;

  // Table Row
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const cleanPlanText = plan.length > 40 ? plan.substring(0, 38) + "..." : plan;
  doc.text(cleanPlanText, left, y);
  doc.text(amount, 120, y, { align: "right" });
  doc.text("1", 145, y, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text(amount, right, y, { align: "right" });

  y += 8;
  doc.setDrawColor(241, 245, 249);
  doc.line(left, y, right, y);

  y += 12;

  // Breakdown rows matching Image 2
  const isLkr = amount.toUpperCase().includes("LKR") || amount.toUpperCase().includes("RS");
  const zeroStr = isLkr ? "LKR 0.00" : "$0.00";

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);

  doc.text("Discounts", 145, y, { align: "right" });
  doc.text(zeroStr, right, y, { align: "right" });

  y += 5;
  doc.text("Subtotal", 145, y, { align: "right" });
  doc.text(amount, right, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Total", 145, y, { align: "right" });
  doc.text(amount, right, y, { align: "right" });

  y += 6;
  doc.setTextColor(0, 209, 102);
  doc.text("Payment", 145, y, { align: "right" });
  doc.text(amount, right, y, { align: "right" });

  // Footer
  y = 240;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Thank you for choosing YouuHost! Your subscription is now fully active.", 105, y, { align: "center" });
  y += 5;
  doc.text("For any billing queries or support, contact support@youuhost.com", 105, y, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Payment Method Icon Resolver using AgentBunny icons8 standards
 */
function getPaymentMethodDetails(method: string, details?: string): { iconUrl: string; title: string; subtitle: string; isBrandIcon: boolean } {
  const m = (method || "").toLowerCase();

  if (m.includes("master")) {
    return {
      iconUrl: "https://img.icons8.com/color/96/mastercard.png",
      title: "Payment Method",
      subtitle: details || "Mastercard ending in •••• 9876",
      isBrandIcon: true,
    };
  }

  if (m.includes("visa") || m.includes("card") || m.includes("payhere")) {
    return {
      iconUrl: "https://img.icons8.com/color/96/visa.png",
      title: "Payment Method",
      subtitle: details || "Visa ending in •••• 4122",
      isBrandIcon: true,
    };
  }

  if (m.includes("binance")) {
    return {
      iconUrl: "https://img.icons8.com/color/96/binance.png",
      title: "Payment Method",
      subtitle: details || "Binance Pay • Instant Crypto Settlement",
      isBrandIcon: true,
    };
  }

  if (m.includes("cryptomus") || m.includes("crypto") || m.includes("usdt")) {
    return {
      iconUrl: "https://img.icons8.com/color/96/tether.png",
      title: "Payment Method",
      subtitle: details || "Cryptomus Gateway • Verified USDT Invoice",
      isBrandIcon: true,
    };
  }

  return {
    iconUrl: "https://img.icons8.com/material-outlined/48/00d166/wallet.png",
    title: "Payment Method",
    subtitle: details || "YouuHost Instant Wallet Balance",
    isBrandIcon: false,
  };
}

/**
 * Generate Luxury Transaction / Payment Successful HTML Email matching AgentBunny
 */
export function buildPaymentSuccessEmailHtml(props: TransactionEmailProps): string {
  const name = props.recipientName || "Valued Customer";
  const plan = props.planTitle || "Enterprise AI Plan";
  const amount = sanitizeCurrencyAmount(props.amount || "LKR 14,990.00");
  const billingCycle = props.billingCycle || "Monthly";
  const ctaText = props.ctaText || "Manage Orders";
  const ctaUrl = props.ctaUrl || "https://youuhost.com/shop";
  const paymentInfo = getPaymentMethodDetails(props.paymentMethod, props.paymentMethodDetails);
  const logoUri = getLogoDataUri();

  const subFeatures = [
    {
      iconUrl: "https://img.icons8.com/material-outlined/48/00d166/wallet.png",
      title: "Transaction Details",
      desc: `Plan: ${plan} &bull; Amount: <strong style="color: #00d166;">${amount}</strong> &bull; Billing: ${billingCycle}`,
      isBrandIcon: false
    },
    {
      iconUrl: paymentInfo.iconUrl,
      title: paymentInfo.title,
      desc: paymentInfo.subtitle,
      isBrandIcon: paymentInfo.isBrandIcon
    },
    {
      iconUrl: "https://img.icons8.com/material-outlined/48/00d166/document.png",
      title: "Invoice Attachment",
      desc: "A copy of your official PDF invoice has been attached to this email for your records.",
      isBrandIcon: false
    }
  ];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - YouuHost</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        
        <!-- Logo -->
        <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td align="center" style="vertical-align: middle;">
              <a href="https://youuhost.com" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${logoUri}" alt="youuhost" style="max-width: 170px; height: auto; display: block; border: 0;" />
              </a>
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 24px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); border: 1px solid #f1f5f9; padding: 38px 28px;">
          <tr>
            <td>
              <h2 style="font-size: 23px; font-weight: 700; color: #111827; margin: 0 0 14px 0; text-align: center; letter-spacing: -0.5px;">
                Payment Successful
                <img src="https://img.icons8.com/color/96/verified-badge.png" width="22" height="22" style="width: 22px; height: 22px; vertical-align: middle; display: inline-block; margin-left: 6px; border: 0;" />
              </h2>

              <div style="font-size: 14.5px; font-weight: 600; color: #475569; margin-bottom: 10px; text-align: center;">Hello ${name},</div>

              <p style="font-size: 13.5px; line-height: 1.6; color: #64748b; margin: 0 auto 26px auto; text-align: center; max-width: 380px;">
                Your payment and subscription have been processed successfully. Thank you for choosing YouuHost!
              </p>

              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto; width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; width: 100%; max-width: 320px; background-color: #00d166; color: #ffffff !important; text-decoration: none; border-radius: 30px; padding: 14px 28px; font-size: 15px; font-weight: 700; text-align: center; box-shadow: 0 4px 14px rgba(0, 209, 102, 0.25); box-sizing: border-box;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 24px;">
                Best Regards,<br>
                <strong style="color: #111827;">YouuHost Team</strong>
              </div>

              <!-- Sub-features / Transaction Details list -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #f1f5f9; padding-top: 24px;">
                ${subFeatures.map(feat => `
                <tr>
                  <td style="vertical-align: top; width: 44px; padding-bottom: 18px;">
                    <table border="0" cellpadding="0" cellspacing="0" style="background-color: ${feat.isBrandIcon ? '#f8fafc' : '#f0fdf4'}; border-radius: 12px; width: 38px; height: 38px;">
                      <tr>
                        <td align="center" style="vertical-align: middle; height: 38px; width: 38px; padding: 0;">
                          <img src="${feat.iconUrl}" width="${feat.isBrandIcon ? '26' : '20'}" height="${feat.isBrandIcon ? '26' : '20'}" style="width: ${feat.isBrandIcon ? '26px' : '20px'}; height: ${feat.isBrandIcon ? '26px' : '20px'}; display: block; margin: 0 auto; border: 0;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align: top; padding-bottom: 18px; padding-left: 10px;">
                    <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 3px;">${feat.title}</div>
                    <div style="font-size: 12.5px; line-height: 1.5; color: #64748b;">${feat.desc}</div>
                  </td>
                </tr>
                `).join('')}
              </table>

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 24px; max-width: 480px;">
          <tr>
            <td align="center" style="font-size: 11.5px; color: #94a3b8; line-height: 1.6;">
              <p style="margin: 0 0 6px 0;"><a href="https://www.youuhost.com" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">www.youuhost.com</a></p>
              <p style="margin: 0;">You received this automated email notification because you are a registered user of YouuHost. Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Order Confirmation & Invoice Receipt Email Template
 * EXACT MATCH to Image 2 invoice receipt table (Description, Unit price, Qty, Amount, Subtotal, Total)
 */
export function buildOrderCredentialsEmailHtml(props: OrderCredentialsEmailProps): string {
  const name = props.recipientName || "Valued Customer";
  const orderId = props.orderId || `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const prodName = props.productName || "Cloud VPS - 4 vCPU 8GB RAM High Speed";
  const qty = props.quantity || 1;
  const amount = sanitizeCurrencyAmount(props.amount || "$50.00 USD", "$50.00 USD");
  const ctaText = props.ctaText || "Manage Orders";
  const ctaUrl = props.ctaUrl || "https://youuhost.com/shop";
  const logoUri = getLogoDataUri();
  const isLkr = amount.toUpperCase().includes("LKR") || amount.toUpperCase().includes("RS");
  const zeroStr = isLkr ? "LKR 0.00" : "$0.00";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed #${orderId} - YouuHost</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">

        <!-- Top Logo -->
        <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td align="center" style="vertical-align: middle;">
              <a href="https://youuhost.com" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${logoUri}" alt="youuhost" style="max-width: 170px; height: auto; display: block; border: 0;" />
              </a>
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 24px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); border: 1px solid #f1f5f9; padding: 38px 28px;">
          <tr>
            <td>
              
              <!-- Header -->
              <h2 style="font-size: 23px; font-weight: 700; color: #111827; margin: 0 0 14px 0; text-align: center; letter-spacing: -0.5px;">
                Order Confirmed
                <img src="https://img.icons8.com/color/96/verified-badge.png" width="22" height="22" style="width: 22px; height: 22px; vertical-align: middle; display: inline-block; margin-left: 6px; border: 0;" />
              </h2>

              <div style="font-size: 14.5px; font-weight: 600; color: #475569; margin-bottom: 8px; text-align: center;">Hello ${name},</div>
              <p style="font-size: 13.5px; line-height: 1.5; color: #64748b; margin: 0 auto 22px auto; text-align: center; max-width: 380px;">
                Your purchase has been processed successfully. Below are the order receipt details for Order <strong>#${orderId}</strong>.
              </p>

              <!-- OFFICIAL INVOICE TABLE (EXACT MATCH TO PHOTO 2) -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0 24px 0; border-collapse: collapse;">
                <thead>
                  <tr style="border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                    <th align="left" style="padding: 10px 4px; font-size: 12.5px; font-weight: 600; color: #111827;">Description</th>
                    <th align="right" style="padding: 10px 4px; font-size: 12.5px; font-weight: 600; color: #111827;">Unit price</th>
                    <th align="center" style="padding: 10px 4px; font-size: 12.5px; font-weight: 600; color: #111827;">Qty</th>
                    <th align="right" style="padding: 10px 4px; font-size: 12.5px; font-weight: 600; color: #111827;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td align="left" style="padding: 14px 4px; font-size: 13px; color: #475569; line-height: 1.4;">${prodName}</td>
                    <td align="right" style="padding: 14px 4px; font-size: 13px; color: #475569;">${amount}</td>
                    <td align="center" style="padding: 14px 4px; font-size: 13px; color: #475569;">${qty}</td>
                    <td align="right" style="padding: 14px 4px; font-size: 13px; font-weight: 600; color: #111827;">${amount}</td>
                  </tr>
                  <tr style="border-top: 1px solid #f1f5f9;">
                    <td colspan="2"></td>
                    <td align="right" style="padding: 10px 4px 4px 4px; font-size: 12px; color: #64748b;">Discounts</td>
                    <td align="right" style="padding: 10px 4px 4px 4px; font-size: 12px; color: #64748b;">${zeroStr}</td>
                  </tr>
                  <tr>
                    <td colspan="2"></td>
                    <td align="right" style="padding: 4px 4px; font-size: 12px; color: #64748b;">Subtotal</td>
                    <td align="right" style="padding: 4px 4px; font-size: 12px; color: #64748b;">${amount}</td>
                  </tr>
                  <tr>
                    <td colspan="2"></td>
                    <td align="right" style="padding: 6px 4px; font-size: 13px; font-weight: 700; color: #111827;">Total</td>
                    <td align="right" style="padding: 6px 4px; font-size: 13px; font-weight: 700; color: #111827;">${amount}</td>
                  </tr>
                  <tr>
                    <td colspan="2"></td>
                    <td align="right" style="padding: 4px 4px 14px 4px; font-size: 13px; font-weight: 700; color: #00d166;">Payment</td>
                    <td align="right" style="padding: 4px 4px 14px 4px; font-size: 13px; font-weight: 700; color: #00d166;">${amount}</td>
                  </tr>
                </tbody>
              </table>

              <!-- CTA BUTTON -->
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto; width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" target="_blank" style="display: inline-block; width: 100%; max-width: 320px; background-color: #00d166; color: #ffffff !important; text-decoration: none; border-radius: 30px; padding: 14px 28px; font-size: 15px; font-weight: 700; text-align: center; box-shadow: 0 4px 14px rgba(0, 209, 102, 0.25); box-sizing: border-box;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- FOOTER SIGN-OFF -->
              <div style="text-align: center; font-size: 12.5px; color: #64748b; line-height: 1.5; margin-bottom: 8px;">
                Your official PDF receipt has also been attached to this email.<br>
                Best Regards, <strong style="color: #111827;">YouuHost Team</strong>
              </div>

            </td>
          </tr>
        </table>

        <!-- FOOTER -->
        <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 24px; max-width: 500px;">
          <tr>
            <td align="center" style="font-size: 11.5px; color: #94a3b8; line-height: 1.6;">
              <p style="margin: 0 0 6px 0;"><a href="https://www.youuhost.com" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">www.youuhost.com</a></p>
              <p style="margin: 0;">Automated delivery dispatch. Keep your credentials secure.</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * YouuHost OTP Security Verification Code Email Template
 * Matching AgentBunny standards with crisp icons8 vector shield & timer
 */
export function buildOtpVerificationEmailHtml(props: OtpEmailProps): string {
  const name = props.recipientName || "Valued Customer";
  const code = props.otpCode || "519283";
  const expiry = props.expiryMinutes || 10;
  const logoUri = getLogoDataUri();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code: ${code} - YouuHost</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">

        <!-- Top Logo -->
        <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td align="center" style="vertical-align: middle;">
              <a href="https://youuhost.com" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${logoUri}" alt="youuhost" style="max-width: 170px; height: auto; display: block; border: 0;" />
              </a>
            </td>
          </tr>
        </table>

        <!-- Main Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 24px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); border: 1px solid #f1f5f9; padding: 38px 28px; text-align: center;">
          <tr>
            <td>
              
              <!-- Professional Icon Badge (icons8 lock) -->
              <table border="0" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 16px; width: 54px; height: 54px; margin: 0 auto 16px auto; border: 1px solid #dcfce7;">
                <tr>
                  <td align="center" style="vertical-align: middle; height: 54px; width: 54px; padding: 0;">
                    <img src="https://img.icons8.com/material-outlined/48/00d166/lock.png" width="28" height="28" style="width: 28px; height: 28px; display: block; margin: 0 auto; border: 0;" />
                  </td>
                </tr>
              </table>

              <!-- Emerald Green Title -->
              <h2 style="font-size: 22px; font-weight: 700; color: #00d166; margin: 0 0 12px 0; letter-spacing: -0.3px;">
                Account Verification Code
              </h2>

              <p style="font-size: 13.5px; color: #64748b; line-height: 1.5; margin: 0 0 24px 0;">
                Hello ${name}, please use the 6-digit one-time verification code below to complete your authentication with YouuHost.
              </p>

              <!-- BIG OTP CODE BOX -->
              <div style="background-color: #f8fafc; border-radius: 16px; padding: 18px 24px; margin: 0 auto 20px auto; border: 2px dashed #00d166; max-width: 300px; text-align: center;">
                <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 34px; font-weight: 900; color: #111827; letter-spacing: 6px;">
                  ${code}
                </div>
              </div>

              <!-- Sleek Timer Badge -->
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
                <tr>
                  <td style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 20px; padding: 6px 18px; font-size: 12.5px; font-weight: 600; color: #00d166; text-align: center;">
                    <img src="https://img.icons8.com/material-outlined/48/00d166/clock.png" width="14" height="14" style="width: 14px; height: 14px; vertical-align: -2px; display: inline-block; margin-right: 6px; border: 0;" />
                    Expires in ${expiry} minutes
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0 0 20px 0; border-top: 1px solid #f1f5f9; padding-top: 18px;">
                If you did not request this verification code, please ignore this email or contact security support immediately. Do not share this code with anyone.
              </p>

              <div style="font-size: 12.5px; color: #64748b;">
                Best Regards,<br>
                <strong style="color: #111827;">YouuHost Security Team</strong>
              </div>

            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 24px; max-width: 480px;">
          <tr>
            <td align="center" style="font-size: 11.5px; color: #94a3b8;">
              <p style="margin: 0 0 6px 0;"><a href="https://www.youuhost.com" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">www.youuhost.com</a></p>
              <p style="margin: 0;">Security Notification &bull; YouuHost Identity Gateway</p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Custom Broadcast / Announcement Template
 */
export function buildCustomEmailHtml(props: CustomEmailProps): string {
  const name = props.recipientName || "Valued Customer";
  const ctaText = props.ctaText || "Manage Orders";
  const ctaUrl = props.ctaUrl || "https://youuhost.com/shop";
  const logoUri = getLogoDataUri();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${props.subject} - YouuHost</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td align="center">
              <a href="https://youuhost.com" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${logoUri}" alt="youuhost" style="max-width: 170px; height: auto; display: block; border: 0;" />
              </a>
            </td>
          </tr>
        </table>

        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 24px; padding: 38px 28px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03); border: 1px solid #f1f5f9; text-align: center;">
          <tr>
            <td>
              <h2 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 16px 0;">
                ${props.heading}
                <img src="https://img.icons8.com/color/96/verified-badge.png" width="20" height="20" style="width: 20px; height: 20px; vertical-align: middle; display: inline-block; margin-left: 6px; border: 0;" />
              </h2>
              <p style="font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 12px;">Hello ${name},</p>
              <div style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; white-space: pre-line;">${props.message}</div>
              <a href="${ctaUrl}" style="display: inline-block; width: 100%; max-width: 320px; padding: 14px 28px; background-color: #00d166; color: #ffffff !important; font-weight: 700; font-size: 15px; text-align: center; text-decoration: none; border-radius: 30px; box-shadow: 0 4px 14px rgba(0, 209, 102, 0.25); box-sizing: border-box;">${ctaText}</a>
              <div style="margin-top: 28px; font-size: 13px; color: #64748b;">
                Best Regards,<br>
                <strong style="color: #111827;">YouuHost Team</strong>
              </div>
            </td>
          </tr>
        </table>

        <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 24px; max-width: 480px;">
          <tr>
            <td align="center" style="font-size: 11.5px; color: #94a3b8;">
              <p><a href="https://www.youuhost.com" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">www.youuhost.com</a></p>
              <p>You received this message from YouuHost. Please contact support if you have questions.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}



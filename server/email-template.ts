/**
 * YouuHost Luxury Email Templates & Dispatch Engine
 * Generates responsive, pixel-perfect HTML emails matching the official YouuHost invoice receipt design
 * and generates downloadable/attachable PDF invoices.
 * 
 * Uses email-client-safe rendering (table layout, inline styles, bulletproof verified badges & icons)
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
  credentials: string[];
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
 * Helper to get YouuHost Logo Public URL (Lightweight & Email-Safe, prevents Gmail clipping)
 */
function getLogoDataUri(): string {
  return "https://youuhost.com/youuhost_gradient_logo.png";
}

/**
 * Generate PDF Invoice matching official YouuHost Invoice design (Clean Single-Currency Layout)
 */
export function generateInvoicePdf(props: TransactionEmailProps): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const invoiceNo = props.referenceId || `INV-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateStr = props.dateStr || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const recipientName = props.recipientName || "Test User";
  const toEmail = props.toEmail || "customer@youuhost.com";
  const plan = props.planTitle || "Enterprise AI Plan";
  const billingCycle = props.billingCycle || "Monthly";
  const amount = sanitizeCurrencyAmount(props.amount || "LKR 14,990.00");

  // Margins
  const left = 20;
  const right = 190;
  let y = 30;

  // Try embedding logo image in PDF if available
  try {
    const logoPath = path.join(process.cwd(), "public", "youuhost_gradient_logo.png");
    if (fs.existsSync(logoPath)) {
      const imgData = fs.readFileSync(logoPath);
      doc.addImage(imgData, "PNG", left, y - 10, 48, 14);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(0, 194, 105);
      doc.text("youu", left, y);
      doc.setTextColor(17, 24, 39);
      doc.text("host", left + 17, y);
    }
  } catch (e) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 194, 105);
    doc.text("youuhost", left, y);
  }

  // Right: INVOICE
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("INVOICE", right, y, { align: "right" });

  y += 14;
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.5);
  doc.line(left, y, right, y);

  y += 14;

  // 2 Columns: Invoice Details (Left) and Billed To (Right)
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Invoice Details:", left, y);
  doc.text("Billed To:", 115, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);

  doc.text(`Invoice No: ${invoiceNo}`, left, y);
  doc.setTextColor(17, 24, 39);
  doc.text(recipientName, 115, y);

  y += 5;
  doc.setTextColor(107, 114, 128);
  doc.text(`Date: ${dateStr}`, left, y);
  doc.text(toEmail, 115, y);

  y += 5;
  doc.text("Payment Status: ", left, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 194, 105); // PAID green
  doc.text("PAID", left + 26, y);

  y += 16;

  // Table Header
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(left, y - 2, right, y - 2);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Description", left, y + 4);
  doc.text("Billing Cycle", 115, y + 4);
  doc.text("Amount", right, y + 4, { align: "right" });

  doc.line(left, y + 7, right, y + 7);

  y += 15;

  // Table Row
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 81);
  const cleanPlanText = plan.length > 42 ? plan.substring(0, 40) + "..." : plan;
  doc.text(`${cleanPlanText}`, left, y);
  doc.text(billingCycle, 115, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text(amount, right, y, { align: "right" });

  y += 6;
  doc.setDrawColor(241, 245, 249);
  doc.line(left, y, right, y);

  y += 14;

  // Total Paid Row
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Total Paid:", 120, y);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 194, 105); // green amount
  doc.text(amount, right, y, { align: "right" });

  // Footer Message
  y = 235;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(156, 163, 175);
  doc.text("Thank you for choosing YouuHost! Your service is now fully active.", 105, y, { align: "center" });
  y += 5;
  doc.text("For any billing queries or support, contact support@youuhost.com", 105, y, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Payment Method Icon Renderer for HTML Emails (Professional Brand Icons matching YouuHost)
 */
function getPaymentMethodHtml(method: string, details?: string): { iconHtml: string; title: string; subtitle: string } {
  const m = (method || "").toLowerCase();

  // 1. VISA CARD
  if (m.includes("visa")) {
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 42px; height: 28px; background-color: #1A1F71; border-radius: 6px; text-align: center; vertical-align: middle; box-shadow: 0 2px 6px rgba(26, 31, 113, 0.25);">
            <span style="color: #FFFFFF; font-weight: 900; font-size: 11px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: 1px; font-style: italic;">VISA</span>
          </td>
        </tr>
      </table>
    `;
    return {
      iconHtml,
      title: "Payment Method",
      subtitle: details || "Visa ending in &bull;&bull;&bull;&bull; 4122",
    };
  }

  // 2. MASTERCARD
  if (m.includes("master") || m.includes("card") || m.includes("payhere")) {
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 42px; height: 28px; background-color: #0F172A; border-radius: 6px; text-align: center; vertical-align: middle; padding: 0 4px; border: 1px solid #1E293B; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="width: 14px; height: 14px; background-color: #EB001B; border-radius: 50%;"></td>
                <td style="width: 14px; height: 14px; background-color: #F79E1B; border-radius: 50%; margin-left: -6px;"></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
    return {
      iconHtml,
      title: "Payment Method",
      subtitle: details || "Mastercard ending in &bull;&bull;&bull;&bull; 9876",
    };
  }

  // 3. BINANCE PAY
  if (m.includes("binance")) {
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 42px; height: 28px; background-color: #F3BA2F; border-radius: 6px; text-align: center; vertical-align: middle; box-shadow: 0 2px 6px rgba(243, 186, 47, 0.3);">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="color: #12161C; font-weight: 900; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0.5px;">
                  BINANCE
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
    return {
      iconHtml,
      title: "Payment Method",
      subtitle: details || "Binance Pay &bull; Instant Crypto Settlement",
    };
  }

  // 4. CRYPTOMUS
  if (m.includes("cryptomus") || m.includes("crypto") || m.includes("usdt")) {
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 42px; height: 28px; background: linear-gradient(135deg, #5B42F3 0%, #4328EB 100%); border-radius: 6px; text-align: center; vertical-align: middle; box-shadow: 0 2px 6px rgba(91, 66, 243, 0.3);">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="color: #FFFFFF; font-weight: 900; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0.5px;">
                  CRYPTOMUS
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
    return {
      iconHtml,
      title: "Payment Method",
      subtitle: details || "Cryptomus Gateway &bull; Verified USDT Invoice",
    };
  }

  // 5. YOUUHOST WALLET BALANCE
  const iconHtml = `
    <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
      <tr>
        <td style="width: 42px; height: 28px; background: linear-gradient(135deg, #00C269 0%, #059669 100%); border-radius: 6px; text-align: center; vertical-align: middle; box-shadow: 0 2px 6px rgba(0, 194, 105, 0.25);">
          <span style="color: #FFFFFF; font-weight: 900; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: 0.5px;">WALLET</span>
        </td>
      </tr>
    </table>
  `;
  return {
    iconHtml,
    title: "Payment Method",
    subtitle: details || "YouuHost Instant Wallet Balance",
  };
}

/**
 * Generate Luxury Transaction Verified / Payment Successful HTML Email
 * - Real YouuHost Gradient Logo centered ABOVE the card with transparent background
 * - Payment Successful heading with official blue checkmark badge
 * - Green CTA button: Manage Orders
 * - All 3 Sections: Transaction Details, Payment Method, Invoice Attachment (Professional Vector Badges)
 * - Official footer with link
 */
export function buildPaymentSuccessEmailHtml(props: TransactionEmailProps): string {
  const name = props.recipientName || "Test User";
  const plan = props.planTitle || "Enterprise AI Plan";
  const amount = sanitizeCurrencyAmount(props.amount || "LKR 14,990.00");
  const billingCycle = props.billingCycle || "Monthly";
  const ctaText = props.ctaText || "Manage Orders";
  const ctaUrl = props.ctaUrl || "https://youuhost.com/shop";
  const paymentInfo = getPaymentMethodHtml(props.paymentMethod, props.paymentMethodDetails);
  const logoUri = getLogoDataUri();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Subscription Invoice - YouuHost</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B;">
  <div style="width: 100%; background-color: #F8FAFC; padding: 40px 16px 48px 16px; box-sizing: border-box;">
    <div style="max-width: 480px; margin: 0 auto;">

      <!-- TOP YOUUHOST TRANSPARENT GRADIENT LOGO (ABOVE WHITE CARD) -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://youuhost.com" target="_blank" style="text-decoration: none; display: inline-block;">
          <img src="${logoUri}" alt="youuhost" style="max-width: 180px; height: auto; display: block; border: 0; outline: none; background: transparent;" />
        </a>
      </div>

      <!-- MAIN WHITE CARD -->
      <div style="background-color: #FFFFFF; border-radius: 28px; padding: 38px 28px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04); border: 1px solid #F1F5F9;">
        
        <!-- Payment Successful + Verified Blue Badge (Bulletproof HTML) -->
        <h1 style="text-align: center; font-size: 24px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0; letter-spacing: -0.5px;">
          Payment Successful
          <span style="display: inline-block; vertical-align: middle; width: 22px; height: 22px; background-color: #38BDF8; border-radius: 50%; color: #FFFFFF; font-size: 13px; font-weight: 900; line-height: 22px; text-align: center; margin-left: 6px; box-shadow: 0 2px 6px rgba(56, 189, 248, 0.35);">&#10003;</span>
        </h1>

        <!-- Personalized Greeting -->
        <div style="text-align: center; font-size: 15px; font-weight: 600; color: #475569; margin-bottom: 12px;">Hello ${name},</div>

        <!-- Description text -->
        <p style="text-align: center; font-size: 13.5px; color: #64748B; line-height: 1.6; margin: 0 auto 26px auto; max-width: 380px;">
          Your payment and subscription have been processed successfully. Thank you for choosing YouuHost!
        </p>

        <!-- Manage Orders Button -->
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${ctaUrl}" style="display: inline-block; width: 100%; max-width: 320px; padding: 14px 24px; background-color: #00C269; color: #FFFFFF !important; font-weight: 700; font-size: 15px; text-align: center; text-decoration: none; border-radius: 9999px; box-shadow: 0 6px 18px rgba(0, 194, 105, 0.32); box-sizing: border-box;">
            ${ctaText}
          </a>
        </div>

        <!-- Best Regards Sign-off -->
        <div style="text-align: center; font-size: 13px; color: #64748B; line-height: 1.5; margin-bottom: 28px;">
          Best Regards,<br>
          <strong style="color: #0F172A;">YouuHost Team</strong>
        </div>

        <div style="border-top: 1px solid #F1F5F9; margin: 28px 0;"></div>

        <!-- SECTION 1: Transaction Details (Vector Luxury Card Badge) -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 48px; vertical-align: top; padding-right: 12px;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); border: 1px solid #A7F3D0; text-align: center;">
                <tr>
                  <td align="center" valign="middle" style="color: #059669; font-weight: 900; font-size: 13px; font-family: monospace;">
                    &#9776;
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle;">
              <div style="font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 3px;">Transaction Details</div>
              <div style="font-size: 12.5px; color: #64748B; line-height: 1.5;">
                Plan: ${plan} &bull; Amount: <strong style="color: #00C269;">${amount}</strong> &bull; Billing: ${billingCycle}
              </div>
            </td>
          </tr>
        </table>

        <!-- SECTION 2: Payment Method (Official Real Badge) -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 48px; vertical-align: top; padding-right: 12px;">
              ${paymentInfo.iconHtml}
            </td>
            <td style="vertical-align: middle;">
              <div style="font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 3px;">${paymentInfo.title}</div>
              <div style="font-size: 12.5px; color: #64748B; line-height: 1.5;">
                ${paymentInfo.subtitle}
              </div>
            </td>
          </tr>
        </table>

        <!-- SECTION 3: Invoice Attachment (Official PDF Badge) -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 48px; vertical-align: top; padding-right: 12px;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); border: 1px solid #FECACA; text-align: center;">
                <tr>
                  <td align="center" valign="middle" style="color: #DC2626; font-weight: 900; font-size: 10px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; letter-spacing: 0.5px;">
                    PDF
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle;">
              <div style="font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 3px;">Invoice Attachment</div>
              <div style="font-size: 12.5px; color: #64748B; line-height: 1.5;">
                A copy of your official PDF invoice has been attached to this email for your records.
              </div>
            </td>
          </tr>
        </table>

      </div>

      <!-- FOOTER (OUTSIDE CARD) -->
      <div style="text-align: center; margin-top: 26px; font-size: 11.5px; color: #94A3B8; line-height: 1.6;">
        <p style="margin: 0 0 8px 0;">
          <a href="https://www.youuhost.com" style="color: #3B82F6; font-weight: 600; text-decoration: underline;">www.youuhost.com</a>
        </p>
        <p style="margin: 0;">
          You received this automated email notification because you are a registered user of YouuHost. Please do not reply directly to this email.
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Custom Broadcast / Announcement Template with Top Logo
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
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${props.subject} - YouuHost</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <div style="width: 100%; background-color: #F8FAFC; padding: 40px 16px;">
    <div style="max-width: 480px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://youuhost.com" target="_blank" style="text-decoration: none; display: inline-block;">
          <img src="${logoUri}" alt="youuhost" style="max-width: 180px; height: auto; display: block; border: 0; outline: none; background: transparent;" />
        </a>
      </div>
      <div style="background-color: #FFFFFF; border-radius: 28px; padding: 38px 28px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); border: 1px solid #F1F5F9;">
        <div style="text-align: center;">
          <h1 style="font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0;">
            ${props.heading}
            <span style="display: inline-block; vertical-align: middle; width: 20px; height: 20px; background-color: #38BDF8; border-radius: 50%; color: #FFFFFF; font-size: 12px; font-weight: 900; line-height: 20px; text-align: center; margin-left: 6px;">&#10003;</span>
          </h1>
          <p style="font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 12px;">Hello ${name},</p>
          <div style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px; white-space: pre-line;">${props.message}</div>
          <a href="${ctaUrl}" style="display: inline-block; width: 100%; max-width: 320px; padding: 14px 24px; background-color: #00C269; color: #FFFFFF !important; font-weight: 700; font-size: 15px; text-align: center; text-decoration: none; border-radius: 9999px; box-shadow: 0 6px 18px rgba(0, 194, 105, 0.32); box-sizing: border-box;">${ctaText}</a>
          <div style="margin-top: 28px; font-size: 13px; color: #64748B;">
            Best Regards,<br>
            <strong style="color: #0F172A;">YouuHost Team</strong>
          </div>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 11.5px; color: #94A3B8;">
        <p><a href="https://www.youuhost.com" style="color: #3B82F6; text-decoration: underline;">www.youuhost.com</a></p>
        <p>You received this message from YouuHost. Please contact support if you have questions.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Order Confirmation & Product Credentials Delivery Email Template
 * - Refactored: Unified Luxury AWS/Cloud Style Access Card (Replaced 4 ugly separate black boxes)
 * - Single clean currency amount (no dual conversions or cut-offs)
 * - Green CTA button: Manage Orders
 */
export function buildOrderCredentialsEmailHtml(props: OrderCredentialsEmailProps): string {
  const name = props.recipientName || "Valued Customer";
  const orderId = props.orderId || `ORD-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const prodName = props.productName || "Cloud VPS / Service";
  const qty = props.quantity || 1;
  const amount = sanitizeCurrencyAmount(props.amount || "$5.50 USD", "$5.50 USD");
  const ctaText = props.ctaText || "Manage Orders";
  const ctaUrl = props.ctaUrl || "https://youuhost.com/shop";
  const logoUri = getLogoDataUri();
  const rawCredentials = props.credentials && props.credentials.length > 0 ? props.credentials : ["root_user: client_admin", "root_pass: P@ssword#2026", "host_ip: 18.141.224.63:22", "license_key: YOUU-ENTERPRISE-PRO-9812-2291"];

  // Parse credentials into clean rows
  const parsedRows: { label: string; value: string }[] = [];
  for (const c of rawCredentials) {
    if (typeof c === "string" && c.includes(":")) {
      const idx = c.indexOf(":");
      const rawKey = c.substring(0, idx).trim();
      const rawVal = c.substring(idx + 1).trim();
      // Format key nicely (e.g. root_user -> Root User, host_ip -> Host / IP)
      let formattedKey = rawKey.replace(/_/g, " ").toUpperCase();
      if (formattedKey === "ROOT USER") formattedKey = "USERNAME";
      else if (formattedKey === "ROOT PASS") formattedKey = "PASSWORD";
      else if (formattedKey === "HOST IP") formattedKey = "HOST / IP";
      else if (formattedKey === "LICENSE KEY") formattedKey = "LICENSE KEY";
      
      parsedRows.push({ label: formattedKey, value: rawVal });
    } else if (typeof c === "string" && c.trim()) {
      parsedRows.push({ label: "ACCESS KEY", value: c.trim() });
    }
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed #${orderId} - YouuHost</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B;">
  <div style="width: 100%; background-color: #F8FAFC; padding: 40px 16px 48px 16px; box-sizing: border-box;">
    <div style="max-width: 500px; margin: 0 auto;">

      <!-- TOP YOUUHOST GRADIENT LOGO -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://youuhost.com" target="_blank" style="text-decoration: none; display: inline-block;">
          <img src="${logoUri}" alt="youuhost" style="max-width: 180px; height: auto; display: block; border: 0; outline: none; background: transparent;" />
        </a>
      </div>

      <!-- MAIN WHITE CARD -->
      <div style="background-color: #FFFFFF; border-radius: 28px; padding: 36px 26px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04); border: 1px solid #F1F5F9;">
        
        <!-- Header -->
        <h1 style="text-align: center; font-size: 23px; font-weight: 800; color: #0F172A; margin: 0 0 12px 0; letter-spacing: -0.5px;">
          Order Confirmed & Credentials
          <span style="display: inline-block; vertical-align: middle; width: 22px; height: 22px; background-color: #38BDF8; border-radius: 50%; color: #FFFFFF; font-size: 13px; font-weight: 900; line-height: 22px; text-align: center; margin-left: 6px;">&#10003;</span>
        </h1>

        <div style="text-align: center; font-size: 14.5px; font-weight: 600; color: #475569; margin-bottom: 8px;">Hello ${name},</div>
        <p style="text-align: center; font-size: 13px; color: #64748B; line-height: 1.5; margin: 0 auto 24px auto;">
          Your purchase has been processed successfully. Below are your instant credentials and access details for Order <strong>#${orderId}</strong>.
        </p>

        <!-- ORDER SUMMARY STRIP -->
        <table style="width: 100%; border-collapse: collapse; background-color: #F8FAFC; border-radius: 16px; margin-bottom: 22px; border: 1px solid #ECEEF8;" cellpadding="12" cellspacing="0">
          <tr>
            <td style="font-size: 12.5px; color: #64748B;">Item: <strong style="color: #0F172A;">${prodName}</strong></td>
            <td align="right" style="font-size: 12.5px; color: #64748B;">Qty: <strong style="color: #0F172A;">${qty}</strong> &bull; Total: <strong style="color: #00C269;">${amount}</strong></td>
          </tr>
        </table>

        <!-- UNIFIED LUXURY AWS/CLOUD STYLE ACCESS CREDENTIALS CARD -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
            <span style="display: inline-block; width: 8px; height: 8px; background-color: #00C269; border-radius: 50%; margin-right: 6px; vertical-align: middle;"></span>
            Instant Server Credentials & Access Keys
          </div>

          <div style="background-color: #0F172A; border-radius: 16px; padding: 18px 20px; border: 1px solid #1E293B; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.15);">
            <table style="width: 100%; border-collapse: collapse;" cellpadding="0" cellspacing="0">
              ${parsedRows.map((r, idx) => `
                <tr>
                  <td style="padding: 10px 0; ${idx < parsedRows.length - 1 ? 'border-bottom: 1px solid #1E293B;' : ''} width: 36%; font-size: 11px; font-weight: 700; color: #38BDF8; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle;">
                    ${r.label}
                  </td>
                  <td style="padding: 10px 0; ${idx < parsedRows.length - 1 ? 'border-bottom: 1px solid #1E293B;' : ''} font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; font-weight: 600; color: #F8FAFC; text-align: right; word-break: break-all; vertical-align: middle;">
                    ${r.value}
                  </td>
                </tr>
              `).join('')}
            </table>
          </div>
        </div>

        <!-- MANAGE ORDERS BUTTON -->
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${ctaUrl}" style="display: inline-block; width: 100%; max-width: 320px; padding: 14px 24px; background-color: #00C269; color: #FFFFFF !important; font-weight: 700; font-size: 15px; text-align: center; text-decoration: none; border-radius: 9999px; box-shadow: 0 6px 18px rgba(0, 194, 105, 0.32); box-sizing: border-box;">
            ${ctaText}
          </a>
        </div>

        <!-- FOOTER SIGN-OFF -->
        <div style="text-align: center; font-size: 12.5px; color: #64748B; line-height: 1.5; margin-bottom: 16px;">
          Your official PDF receipt has also been attached to this email.<br>
          Best Regards, <strong style="color: #0F172A;">YouuHost Team</strong>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="text-align: center; margin-top: 24px; font-size: 11.5px; color: #94A3B8; line-height: 1.6;">
        <p style="margin: 0 0 6px 0;"><a href="https://www.youuhost.com" style="color: #3B82F6; text-decoration: underline;">www.youuhost.com</a></p>
        <p style="margin: 0;">Automated delivery dispatch. Keep your credentials secure.</p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}

/**
 * YouuHost OTP Security Verification Code Email Template
 * - Refactored: Emerald Green Title (#00C269), Professional Shield/Lock Badge & Sleek Timer Badge
 */
export function buildOtpVerificationEmailHtml(props: OtpEmailProps): string {
  const name = props.recipientName || "Valued Customer";
  const code = props.otpCode || "839201";
  const expiry = props.expiryMinutes || 10;
  const logoUri = getLogoDataUri();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code: ${code} - YouuHost</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <div style="width: 100%; background-color: #F8FAFC; padding: 40px 16px;">
    <div style="max-width: 480px; margin: 0 auto;">

      <!-- TOP LOGO -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://youuhost.com" target="_blank" style="text-decoration: none; display: inline-block;">
          <img src="${logoUri}" alt="youuhost" style="max-width: 180px; height: auto; display: block; border: 0; outline: none; background: transparent;" />
        </a>
      </div>

      <!-- MAIN CARD -->
      <div style="background-color: #FFFFFF; border-radius: 28px; padding: 38px 28px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); border: 1px solid #F1F5F9; text-align: center;">
        
        <!-- Professional Shield Lock Badge (Bulletproof HTML Table) -->
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="width: 56px; height: 56px; border-radius: 18px; background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); border: 1.5px solid #A7F3D0; text-align: center; margin: 0 auto 18px auto; box-shadow: 0 4px 12px rgba(0, 194, 105, 0.15);">
          <tr>
            <td align="center" valign="middle" style="color: #00C269; font-weight: 900; font-size: 22px;">
              &#128274;
            </td>
          </tr>
        </table>

        <!-- Emerald Green Title -->
        <h1 style="font-size: 22px; font-weight: 800; color: #00C269; margin: 0 0 10px 0; letter-spacing: -0.3px;">
          Account Verification Code
        </h1>

        <p style="font-size: 13.5px; color: #64748B; line-height: 1.5; margin: 0 0 24px 0;">
          Hello ${name}, please use the 6-digit one-time verification code below to complete your authentication with YouuHost.
        </p>

        <!-- BIG OTP CODE BOX -->
        <div style="background-color: #F8FAFC; border-radius: 18px; padding: 18px 20px; margin: 0 auto 18px auto; border: 2px dashed #00C269; max-width: 320px;">
          <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 900; color: #0F172A; letter-spacing: 6px;">
            ${code}
          </div>
        </div>

        <!-- Sleek Timer Badge -->
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td style="padding: 6px 14px; background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #92400E; text-align: center;">
              &#9200; Expires in ${expiry} minutes
            </td>
          </tr>
        </table>

        <p style="font-size: 12px; color: #94A3B8; line-height: 1.5; margin: 0 0 20px 0; border-top: 1px solid #F1F5F9; padding-top: 18px;">
          If you did not request this verification code, please ignore this email or contact security support immediately. Do not share this code with anyone.
        </p>

        <div style="font-size: 12.5px; color: #64748B;">
          Best Regards,<br>
          <strong style="color: #0F172A;">YouuHost Security Team</strong>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="text-align: center; margin-top: 24px; font-size: 11.5px; color: #94A3B8;">
        <p><a href="https://www.youuhost.com" style="color: #3B82F6; text-decoration: underline;">www.youuhost.com</a></p>
        <p>Security Notification &bull; YouuHost Identity Gateway</p>
      </div>

    </div>
  </div>
</body>
</html>
  `;
}


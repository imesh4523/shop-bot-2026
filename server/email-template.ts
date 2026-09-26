/**
 * YouuHost Luxury Email Templates & Dispatch Engine
 * Generates responsive, pixel-perfect HTML emails matching the official YouuHost invoice receipt design
 * and generates downloadable/attachable PDF invoices.
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
  secondaryAmount?: string; // e.g. "≈ $50.00 USD"
  referenceId: string; // e.g. "INV-2026-812010"
  paymentMethod: "card" | "payhere" | "mastercard" | "visa" | "binance" | "binance_pay" | "cryptomus" | "crypto" | "wallet_balance" | string;
  paymentMethodDetails?: string; // e.g. "Mastercard ending in •••• 9876"
  dateStr?: string;
  billingCycle?: string; // e.g. "Monthly"
  ctaText?: string;
  ctaUrl?: string;
  customNote?: string;
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
 * Helper to get YouuHost Gradient Logo data URI or URL
 */
function getLogoDataUri(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "youuhost_gradient_logo.png");
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch (e) {}
  return "https://youuhost.com/youuhost_gradient_logo.png";
}

/**
 * Generate PDF Invoice matching Image 3 layout
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
  const amount = props.amount || "LKR 14,990.00";

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
  doc.setTextColor(107, 114, 128); // gray

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
  doc.text(`${plan} Subscription`, left, y);
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
  doc.text("Thank you for choosing YouuHost! Your subscription is now fully active.", 105, y, { align: "center" });
  y += 5;
  doc.text("For any billing queries or support, contact support@youuhost.com", 105, y, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Payment Method Icon Renderer for HTML Emails
 */
function getPaymentMethodHtml(method: string, details?: string): { iconHtml: string; title: string; subtitle: string } {
  const m = (method || "").toLowerCase();

  if (m.includes("master") || m.includes("card") || m.includes("payhere") || m.includes("visa")) {
    const isMaster = m.includes("master") || (!m.includes("visa"));
    
    // Official Mastercard / Visa Dual Circles
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 38px; height: 26px; background: #0F172A; border-radius: 6px; text-align: center; vertical-align: middle; padding: 0 4px; border: 1px solid #1E293B;">
            <table cellpadding="0" cellspacing="0" border="0" align="center">
              <tr>
                <td style="width: 13px; height: 13px; background: #EB001B; border-radius: 50%; opacity: 0.95;"></td>
                <td style="width: 13px; height: 13px; background: #F79E1B; border-radius: 50%; margin-left: -6px; opacity: 0.95;"></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    return {
      iconHtml,
      title: "Payment Method",
      subtitle: details || (isMaster ? "Mastercard ending in &bull;&bull;&bull;&bull; 9876" : "Visa ending in &bull;&bull;&bull;&bull; 4122"),
    };
  }

  if (m.includes("binance")) {
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 38px; height: 26px; background: #F3BA2F; border-radius: 6px; text-align: center; vertical-align: middle;">
            <span style="color: #12161C; font-weight: 900; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">BIN</span>
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

  if (m.includes("cryptomus") || m.includes("crypto")) {
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 38px; height: 26px; background: #5B42F3; border-radius: 6px; text-align: center; vertical-align: middle;">
            <span style="color: #FFFFFF; font-weight: 900; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">CR</span>
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

  // Wallet Balance
  const iconHtml = `
    <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
      <tr>
        <td style="width: 38px; height: 26px; background: #10B981; border-radius: 6px; text-align: center; vertical-align: middle;">
          <span style="color: #FFFFFF; font-weight: 900; font-size: 13px;">&#128179;</span>
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
 * EXACT match to Image 3 reference:
 * - Real YouuHost Gradient Logo centered ABOVE the card
 * - Payment Successful heading with official blue checkmark badge
 * - Green CTA button
 * - Transaction Details, Payment Method with authentic logo, Invoice Attachment
 * - Official footer with link
 */
export function buildPaymentSuccessEmailHtml(props: TransactionEmailProps): string {
  const name = props.recipientName || "Test User";
  const plan = props.planTitle || "Enterprise AI Plan";
  const amount = props.amount || "LKR 14,990.00";
  const billingCycle = props.billingCycle || "Monthly";
  const ctaText = props.ctaText || "Manage Subscription";
  const ctaUrl = props.ctaUrl || "https://youuhost.com/userdashbord/dashboard";
  const paymentInfo = getPaymentMethodHtml(props.paymentMethod, props.paymentMethodDetails);
  const logoUri = getLogoDataUri();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Subscription Invoice - YouuHost</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #1E293B;
    }
    .wrapper {
      width: 100%;
      background-color: #F8FAFC;
      padding: 40px 16px 48px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
    }
    /* TOP GRADIENT LOGO (ABOVE THE WHITE CARD) */
    .top-logo-container {
      text-align: center;
      margin-bottom: 24px;
    }
    .top-logo-img {
      max-width: 175px;
      height: auto;
      display: inline-block;
      vertical-align: middle;
    }
    /* MAIN WHITE CARD */
    .main-card {
      background-color: #FFFFFF;
      border-radius: 28px;
      padding: 38px 28px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
      border: 1px solid #F1F5F9;
    }
    .title-heading {
      text-align: center;
      font-size: 24px;
      font-weight: 800;
      color: #0F172A;
      margin: 0 0 16px 0;
      letter-spacing: -0.5px;
    }
    .verified-blue-badge {
      display: inline-block;
      vertical-align: middle;
      width: 22px;
      height: 22px;
      margin-left: 6px;
    }
    .greeting {
      text-align: center;
      font-size: 15px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 12px;
    }
    .description {
      text-align: center;
      font-size: 13.5px;
      color: #64748B;
      line-height: 1.6;
      margin: 0 auto 26px auto;
      max-width: 380px;
    }
    /* Green Manage Subscription CTA Button */
    .cta-button-container {
      text-align: center;
      margin-bottom: 24px;
    }
    .cta-button {
      display: inline-block;
      width: 100%;
      max-width: 320px;
      padding: 14px 24px;
      background: #00C269;
      color: #FFFFFF !important;
      font-weight: 700;
      font-size: 15px;
      text-align: center;
      text-decoration: none;
      border-radius: 9999px;
      box-shadow: 0 6px 18px rgba(0, 194, 105, 0.32);
      box-sizing: border-box;
    }
    .sign-off {
      text-align: center;
      font-size: 13px;
      color: #64748B;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .divider {
      border: 0;
      height: 1px;
      background-color: #F1F5F9;
      margin: 28px 0;
    }
    /* Detail Rows with Icon */
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .detail-icon-td {
      width: 44px;
      vertical-align: top;
      padding-right: 12px;
    }
    .icon-box-green {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: #ECFDF5;
      color: #059669;
      text-align: center;
      vertical-align: middle;
      font-size: 18px;
    }
    .detail-content-td {
      vertical-align: middle;
    }
    .detail-title {
      font-size: 14px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 3px;
    }
    .detail-subtitle {
      font-size: 12.5px;
      color: #64748B;
      line-height: 1.5;
    }
    /* Footer outside card */
    .footer-container {
      text-align: center;
      margin-top: 26px;
      font-size: 11.5px;
      color: #94A3B8;
      line-height: 1.6;
    }
    .footer-link {
      color: #3B82F6;
      font-weight: 600;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">

      <!-- TOP YOUUHOST GRADIENT LOGO (ABOVE WHITE CARD) -->
      <div class="top-logo-container">
        <a href="https://youuhost.com" target="_blank" style="text-decoration: none;">
          <img src="${logoUri}" alt="youuhost" class="top-logo-img" />
        </a>
      </div>

      <!-- MAIN WHITE CARD -->
      <div class="main-card">
        
        <!-- Payment Successful + Verified Blue Badge -->
        <h1 class="title-heading">
          Payment Successful
          <svg class="verified-blue-badge" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12L11 14L15 10M12 2L14.7 3.9L18 3.6L19.2 6.7L22.2 8.1L21.7 11.4L23.4 14.2L21.3 16.8L21.5 20.1L18.2 20.7L16.4 23.4L13.3 22.4L10.7 24.4L8.1 22.4L5 23.4L3.2 20.7L0 20.1L0.2 16.8L-1.9 14.2L-0.2 11.4L-0.7 8.1L2.3 6.7L3.5 3.6L6.8 3.9L9.5 2H12Z" fill="#38BDF8"/>
            <path d="M8.5 12L10.8 14.3L15.5 9.5" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </h1>

        <!-- Personalized Greeting -->
        <div class="greeting">Hello ${name},</div>

        <!-- Description text -->
        <p class="description">
          Your subscription invoice for your plan has been processed successfully. Thank you for your business!
        </p>

        <!-- Manage Subscription Button -->
        <div class="cta-button-container">
          <a href="${ctaUrl}" class="cta-button">
            ${ctaText}
          </a>
        </div>

        <!-- Best Regards Sign-off -->
        <div class="sign-off">
          Best Regards,<br>
          <strong style="color: #0F172A;">YouuHost Team</strong>
        </div>

        <hr class="divider">

        <!-- SECTION 1: Transaction Details -->
        <table class="detail-table" cellpadding="0" cellspacing="0">
          <tr>
            <td class="detail-icon-td">
              <table cellpadding="0" cellspacing="0" border="0" class="icon-box-green" align="center">
                <tr>
                  <td align="center" valign="middle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C269" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </td>
                </tr>
              </table>
            </td>
            <td class="detail-content-td">
              <div class="detail-title">Transaction Details</div>
              <div class="detail-subtitle">
                Plan: ${plan} &bull; Amount: ${amount} &bull; Billing: ${billingCycle}
              </div>
            </td>
          </tr>
        </table>

        <!-- SECTION 2: Payment Method -->
        <table class="detail-table" cellpadding="0" cellspacing="0">
          <tr>
            <td class="detail-icon-td">
              ${paymentInfo.iconHtml}
            </td>
            <td class="detail-content-td">
              <div class="detail-title">Payment Method</div>
              <div class="detail-subtitle">
                ${paymentInfo.subtitle}
              </div>
            </td>
          </tr>
        </table>

        <!-- SECTION 3: Invoice Attachment -->
        <table class="detail-table" cellpadding="0" cellspacing="0" style="margin-bottom: 0;">
          <tr>
            <td class="detail-icon-td">
              <table cellpadding="0" cellspacing="0" border="0" class="icon-box-green" align="center">
                <tr>
                  <td align="center" valign="middle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C269" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </td>
                </tr>
              </table>
            </td>
            <td class="detail-content-td">
              <div class="detail-title">Invoice Attachment</div>
              <div class="detail-subtitle">
                A copy of your official PDF invoice has been attached to this email for your records.
              </div>
            </td>
          </tr>
        </table>

      </div>

      <!-- FOOTER (OUTSIDE CARD) -->
      <div class="footer-container">
        <p style="margin: 0 0 8px 0;">
          <a href="https://www.youuhost.com" class="footer-link">www.youuhost.com</a>
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
  const ctaText = props.ctaText || "View Account";
  const ctaUrl = props.ctaUrl || "https://youuhost.com";
  const badge = props.badgeText || "OFFICIAL NOTICE";
  const logoUri = getLogoDataUri();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${props.subject} - YouuHost</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
    }
    .wrapper {
      width: 100%;
      background-color: #F8FAFC;
      padding: 40px 16px;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
    }
    .top-logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .top-logo-img {
      max-width: 175px;
      height: auto;
      display: inline-block;
    }
    .main-card {
      background-color: #FFFFFF;
      border-radius: 28px;
      padding: 38px 28px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
      border: 1px solid #F1F5F9;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      background: #F1F5F9;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      color: #0F172A;
      margin: 0 0 16px 0;
    }
    .content {
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 24px;
      white-space: pre-line;
    }
    .cta-btn {
      display: inline-block;
      width: 100%;
      max-width: 320px;
      padding: 14px 24px;
      background: #00C269;
      color: #FFFFFF !important;
      font-weight: 700;
      font-size: 15px;
      text-align: center;
      text-decoration: none;
      border-radius: 9999px;
      box-shadow: 0 6px 18px rgba(0, 194, 105, 0.32);
      box-sizing: border-box;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 11.5px;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="top-logo">
        <a href="https://youuhost.com" target="_blank" style="text-decoration: none;">
          <img src="${logoUri}" alt="youuhost" class="top-logo-img" />
        </a>
      </div>
      <div class="main-card">
        <div style="text-align: center;">
          <span class="badge">${badge}</span>
          <h1 class="title">${props.heading}</h1>
          <p style="font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 12px;">Hello ${name},</p>
          <div class="content">${props.message}</div>
          <a href="${ctaUrl}" class="cta-btn">${ctaText}</a>
          <div style="margin-top: 28px; font-size: 13px; color: #64748B;">
            Best Regards,<br>
            <strong style="color: #0F172A;">YouuHost Team</strong>
          </div>
        </div>
      </div>
      <div class="footer">
        <p><a href="https://www.youuhost.com" style="color: #3B82F6; text-decoration: underline;">www.youuhost.com</a></p>
        <p>You received this message from YouuHost. Please contact support if you have questions.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

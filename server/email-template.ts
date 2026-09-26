/**
 * YouuHost Luxury Email Templates & Dispatch Engine
 * Generates responsive, pixel-perfect HTML emails with authentic payment brand icons
 */

export interface TransactionEmailProps {
  toEmail: string;
  recipientName?: string;
  subject?: string;
  planTitle?: string;
  amount: string; // e.g. "LKR 14,990.00" or "$50.00 USD"
  secondaryAmount?: string; // e.g. "≈ $50.00 USD"
  referenceId: string; // e.g. "#CARD-450"
  paymentMethod: "card" | "payhere" | "mastercard" | "visa" | "binance" | "binance_pay" | "cryptomus" | "crypto" | "wallet_balance" | string;
  paymentMethodDetails?: string; // e.g. "Mastercard ending in •••• 9876" or "Verified Binance Pay"
  dateStr?: string;
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
 * Payment Method Icon Renderer for HTML Emails
 */
function getPaymentMethodHtml(method: string, details?: string): { iconHtml: string; title: string; subtitle: string } {
  const m = (method || "").toLowerCase();

  if (m.includes("master") || m.includes("card") || m.includes("payhere") || m.includes("visa")) {
    const isMaster = m.includes("master");
    const isVisa = m.includes("visa");
    
    // Luxury Mastercard / Visa dual SVG badge
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 38px; height: 26px; background: #181432; border-radius: 5px; text-align: center; vertical-align: middle; border: 1px solid #332B5E;">
            <span style="display: inline-block; width: 10px; height: 10px; background: #EB001B; border-radius: 50%; vertical-align: middle; margin-right: -4px;"></span>
            <span style="display: inline-block; width: 10px; height: 10px; background: #F79E1B; border-radius: 50%; vertical-align: middle; opacity: 0.95;"></span>
          </td>
        </tr>
      </table>
    `;

    return {
      iconHtml,
      title: isMaster ? "Mastercard Payment" : isVisa ? "Visa Card Payment" : "Card Payment (Visa / Mastercard)",
      subtitle: details || "Verified Online Gateway Transaction",
    };
  }

  if (m.includes("binance")) {
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 38px; height: 26px; background: #F3BA2F; border-radius: 5px; text-align: center; vertical-align: middle;">
            <span style="color: #12161C; font-weight: 900; font-size: 11px; font-family: monospace;">BN</span>
          </td>
        </tr>
      </table>
    `;
    return {
      iconHtml,
      title: "Binance Pay",
      subtitle: details || "Verified Crypto Pay Transaction",
    };
  }

  if (m.includes("cryptomus") || m.includes("crypto")) {
    const iconHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
        <tr>
          <td style="width: 38px; height: 26px; background: #5B42F3; border-radius: 5px; text-align: center; vertical-align: middle;">
            <span style="color: #FFFFFF; font-weight: 900; font-size: 11px; font-family: monospace;">C</span>
          </td>
        </tr>
      </table>
    `;
    return {
      iconHtml,
      title: "Cryptomus Payment",
      subtitle: details || "Verified USDT Digital Invoice",
    };
  }

  // Wallet Balance
  const iconHtml = `
    <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block; vertical-align: middle;">
      <tr>
        <td style="width: 38px; height: 26px; background: #10B981; border-radius: 5px; text-align: center; vertical-align: middle;">
          <span style="color: #FFFFFF; font-weight: 900; font-size: 13px;">&#128176;</span>
        </td>
      </tr>
    </table>
  `;
  return {
    iconHtml,
    title: "Wallet Balance",
    subtitle: details || "Direct Account Balance Settlement",
  };
}

/**
 * Generate Luxury Transaction Verified / Payment Successful HTML Email
 */
export function buildPaymentSuccessEmailHtml(props: TransactionEmailProps): string {
  const name = props.recipientName || "Customer";
  const plan = props.planTitle || "Wallet Deposit / Cloud Service";
  const date = props.dateStr || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const ctaText = props.ctaText || "Manage Account & Orders";
  const ctaUrl = props.ctaUrl || "https://youuhost.com";
  const paymentInfo = getPaymentMethodHtml(props.paymentMethod, props.paymentMethodDetails);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - YouuHost</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F3F4F6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #1F2937;
    }
    .wrapper {
      width: 100%;
      background-color: #F3F4F6;
      padding: 36px 16px;
    }
    .main-card {
      max-width: 540px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 28px;
      padding: 36px 32px;
      border: 1px solid #E5E7EB;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
    }
    .logo-container {
      text-align: center;
      margin-bottom: 28px;
    }
    .logo-badge {
      display: inline-block;
      font-size: 22px;
      font-weight: 900;
      color: #5B42F3;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    .title-heading {
      text-align: center;
      font-size: 24px;
      font-weight: 800;
      color: #111827;
      margin: 0 0 16px 0;
      letter-spacing: -0.5px;
    }
    .check-badge {
      display: inline-block;
      vertical-align: middle;
      width: 22px;
      height: 22px;
      background: #00C853;
      border-radius: 50%;
      color: #FFFFFF;
      font-size: 13px;
      line-height: 22px;
      text-align: center;
      margin-left: 6px;
      font-weight: 900;
    }
    .greeting {
      text-align: center;
      font-size: 15px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
    }
    .description {
      text-align: center;
      font-size: 13.5px;
      color: #6B7280;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .cta-button {
      display: block;
      width: 100%;
      max-width: 320px;
      margin: 0 auto 24px auto;
      padding: 14px 24px;
      background: #00C853;
      color: #FFFFFF !important;
      font-weight: 700;
      font-size: 14px;
      text-align: center;
      text-decoration: none;
      border-radius: 9999px;
      box-shadow: 0 6px 18px rgba(0, 200, 83, 0.28);
    }
    .sign-off {
      text-align: center;
      font-size: 13px;
      color: #6B7280;
      margin-bottom: 28px;
    }
    .divider {
      border: 0;
      height: 1px;
      background-color: #F3F4F6;
      margin: 24px 0;
    }
    .detail-row {
      display: table;
      width: 100%;
      margin-bottom: 18px;
    }
    .detail-icon-cell {
      display: table-cell;
      width: 44px;
      vertical-align: top;
    }
    .icon-box {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: #ECFDF5;
      color: #059669;
      text-align: center;
      line-height: 36px;
      font-size: 16px;
    }
    .detail-content-cell {
      display: table-cell;
      vertical-align: top;
      padding-left: 8px;
    }
    .detail-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 2px;
    }
    .detail-subtitle {
      font-size: 12px;
      color: #6B7280;
      line-height: 1.4;
    }
    .amount-highlight {
      font-weight: 800;
      color: #059669;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 11.5px;
      color: #9CA3AF;
      line-height: 1.6;
    }
    .footer a {
      color: #5B42F3;
      font-weight: 600;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-card">
      
      <!-- Logo Header -->
      <div class="logo-container">
        <a href="https://youuhost.com" class="logo-badge">
          youuhost
        </a>
      </div>

      <!-- Payment Title with Verification Badge -->
      <h1 class="title-heading">
        Payment Successful <span class="check-badge">&#10003;</span>
      </h1>

      <!-- Personalized Greeting & Context -->
      <div class="greeting">Hello ${name},</div>
      <p class="description">
        Your payment invoice for your account has been processed successfully. Thank you for your business!
      </p>

      <!-- Primary Action Button -->
      <a href="${ctaUrl}" class="cta-button">
        ${ctaText}
      </a>

      <!-- Regards -->
      <div class="sign-off">
        Best Regards,<br>
        <strong style="color: #111827;">YouuHost Team</strong>
      </div>

      <hr class="divider">

      <!-- Section 1: Transaction Details -->
      <div class="detail-row">
        <div class="detail-icon-cell">
          <div class="icon-box">&#128196;</div>
        </div>
        <div class="detail-content-cell">
          <div class="detail-title">Transaction Details</div>
          <div class="detail-subtitle">
            Plan: <strong>${plan}</strong> &bull; Amount: <span class="amount-highlight">${props.amount}</span> ${props.secondaryAmount ? `(${props.secondaryAmount})` : ""} &bull; Ref: <code>${props.referenceId}</code> &bull; Date: ${date}
          </div>
        </div>
      </div>

      <!-- Section 2: Payment Method -->
      <div class="detail-row">
        <div class="detail-icon-cell">
          ${paymentInfo.iconHtml}
        </div>
        <div class="detail-content-cell">
          <div class="detail-title">${paymentInfo.title}</div>
          <div class="detail-subtitle">
            ${paymentInfo.subtitle}
          </div>
        </div>
      </div>

      <!-- Section 3: Verified Digital Receipt Note -->
      <div class="detail-row" style="margin-bottom: 0;">
        <div class="detail-icon-cell">
          <div class="icon-box" style="background: #EFF6FF; color: #3B82F6;">&#128279;</div>
        </div>
        <div class="detail-content-cell">
          <div class="detail-title">Invoice & Order Confirmation</div>
          <div class="detail-subtitle">
            An official verified digital receipt has been logged to your account timeline. You can inspect your records anytime on your dashboard.
          </div>
        </div>
      </div>

    </div>

    <!-- Clean Footer -->
    <div class="footer">
      <p style="margin: 0 0 6px 0;">
        <a href="https://youuhost.com">www.youuhost.com</a>
      </p>
      <p style="margin: 0;">
        You received this automated email notification because you have an active account on YouuHost. Please do not reply directly to this email.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate Custom / Marketing / Security Broadcast HTML Email
 */
export function buildCustomEmailHtml(props: CustomEmailProps): string {
  const name = props.recipientName || "Valued User";
  const badgeText = props.badgeText || "Official Notification";
  const badgeColor = props.badgeColor || "#5B42F3";
  const ctaText = props.ctaText || "Visit YouuHost";
  const ctaUrl = props.ctaUrl || "https://youuhost.com";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${props.subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F3F4F6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #1F2937;
    }
    .wrapper {
      width: 100%;
      background-color: #F3F4F6;
      padding: 36px 16px;
    }
    .main-card {
      max-width: 540px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 28px;
      padding: 36px 32px;
      border: 1px solid #E5E7EB;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
    }
    .logo-container {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo-badge {
      display: inline-block;
      font-size: 22px;
      font-weight: 900;
      color: #5B42F3;
      text-decoration: none;
    }
    .badge-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: ${badgeColor}15;
      color: ${badgeColor};
      margin-bottom: 14px;
    }
    .title-heading {
      font-size: 22px;
      font-weight: 800;
      color: #111827;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    .greeting {
      font-size: 14.5px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
    }
    .content-body {
      font-size: 13.5px;
      color: #4B5563;
      line-height: 1.7;
      margin-bottom: 28px;
      white-space: pre-wrap;
    }
    .cta-button {
      display: block;
      width: 100%;
      max-width: 280px;
      margin: 0 auto 28px auto;
      padding: 14px 24px;
      background: #5B42F3;
      color: #FFFFFF !important;
      font-weight: 700;
      font-size: 14px;
      text-align: center;
      text-decoration: none;
      border-radius: 9999px;
      box-shadow: 0 6px 18px rgba(91, 66, 243, 0.28);
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      font-size: 11.5px;
      color: #9CA3AF;
      line-height: 1.6;
    }
    .footer a {
      color: #5B42F3;
      font-weight: 600;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-card">
      <div class="logo-container">
        <a href="https://youuhost.com" class="logo-badge">youuhost</a>
      </div>

      <div style="text-align: center;">
        <span class="badge-pill">${badgeText}</span>
      </div>

      <h1 class="title-heading" style="text-align: center;">${props.heading}</h1>

      <div class="greeting">Hello ${name},</div>
      
      <div class="content-body">${props.message}</div>

      ${props.ctaText ? `
        <a href="${ctaUrl}" class="cta-button">
          ${ctaText}
        </a>
      ` : ""}

      <div style="text-align: center; font-size: 12.5px; color: #6B7280; padding-top: 16px; border-top: 1px solid #F3F4F6;">
        Best Regards,<br>
        <strong style="color: #111827;">YouuHost Support & Dispatch Team</strong>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">
        <a href="https://youuhost.com">www.youuhost.com</a>
      </p>
      <p style="margin: 0;">
        You received this message from YouuHost. Please contact support if you have questions.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

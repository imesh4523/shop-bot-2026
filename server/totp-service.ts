import crypto from "crypto";

/**
 * Base32 Alphabet RFC 4648 (A-Z, 2-7)
 */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decodes a Base32 string to Buffer
 */
export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[\s=-]/g, "");
  let bits = "";
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Encodes a Buffer to Base32 string
 */
export function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (let i = 0; i < buffer.length; i++) {
    bits += buffer[i].toString(2).padStart(8, "0");
  }
  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

/**
 * Generates a cryptographically random 20-byte Base32 TOTP secret (32 chars)
 */
export function generateTotpSecret(): string {
  const randomBytes = crypto.randomBytes(20);
  return base32Encode(randomBytes);
}

/**
 * Generates a 6-digit TOTP code for a secret and time offset
 */
export function generateTotp(secretBase32: string, timeOffsetSeconds = 0): string {
  const key = base32Decode(secretBase32);
  const epoch = Math.floor(Date.now() / 1000 + timeOffsetSeconds);
  const timeStep = 30; // standard 30-second window
  const currentCounter = Math.floor(epoch / timeStep);

  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(currentCounter));

  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1000000;

  return code.toString().padStart(6, "0");
}

/**
 * Verifies a 6-digit TOTP code against a Base32 secret with drift window
 */
export function verifyTotp(token: string | number, secretBase32: string, window = 1): boolean {
  if (!token || !secretBase32) return false;
  const cleanToken = token.toString().trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const expected = generateTotp(secretBase32, errorWindow * 30);
    if (timingSafeStringEqual(cleanToken, expected)) {
      return true;
    }
  }
  return false;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to prevent length timing leakage
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Builds an otpauth:// URI for Google Authenticator / 1Password / Authy
 */
export function getOtpAuthUrl(email: string, secretBase32: string, issuer = "YouuHost"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const cleanIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Returns a high-res QR code image URL for instant scanning
 */
export function getQrCodeUrl(otpAuthUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(otpAuthUrl)}&margin=10`;
}

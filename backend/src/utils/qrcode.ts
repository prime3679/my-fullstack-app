import QRCode from 'qrcode';
import { randomBytes } from 'crypto';

/**
 * Generate a unique check-in code for reservations
 * Format: 8 uppercase alphanumeric characters (e.g., "A3B7K9M2")
 */
export function generateCheckInCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0,O,1,I)
  const bytes = randomBytes(8);

  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }

  return code;
}

/**
 * Generate QR code as data URL for a check-in code
 * @param checkInCode The unique check-in code
 * @param baseUrl Base URL for the check-in page (e.g., "https://lacarta.app")
 * @returns Promise<string> Data URL of the QR code image
 */
export async function generateQRCodeDataURL(
  checkInCode: string,
  baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
): Promise<string> {
  try {
    // Generate URL that points to check-in page
    const checkInUrl = `${baseUrl}/checkin/${checkInCode}`;

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(checkInUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code as buffer for email attachments
 * @param checkInCode The unique check-in code
 * @param baseUrl Base URL for the check-in page
 * @returns Promise<Buffer> PNG image buffer
 */
export async function generateQRCodeBuffer(
  checkInCode: string,
  baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000'
): Promise<Buffer> {
  try {
    const checkInUrl = `${baseUrl}/checkin/${checkInCode}`;

    const qrCodeBuffer = await QRCode.toBuffer(checkInUrl, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return qrCodeBuffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Validate check-in code format
 * @param code Code to validate
 * @returns boolean True if valid format
 */
export function isValidCheckInCode(code: string): boolean {
  // Must be exactly 8 uppercase alphanumeric characters
  const regex = /^[A-Z2-9]{8}$/;
  return regex.test(code);
}

import bcrypt from 'bcrypt';
import { PhoneVerificationCode } from '@prisma/client';
import { db } from './db';
import Logger from './logger';

interface SmsProvider {
  send(to: string, body: string): Promise<{ sid?: string } | void>;
}

function formatErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }

  return {
    name: 'UnknownError',
    message: String(error)
  };
}

class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, body: string): Promise<void> {
    Logger.info('SMS sent via console provider', { to, preview: body });
  }
}

class HttpSmsProvider implements SmsProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string
  ) {}

  async send(to: string, body: string): Promise<{ sid?: string }> {
    const endpoint = new URL(
      `/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      'https://api.twilio.com'
    );

    const payload = new URLSearchParams();
    payload.append('To', to);
    payload.append('From', this.fromNumber);
    payload.append('Body', body);

    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: payload.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error (${response.status}): ${errorText}`);
    }

    const json = (await response.json()) as { sid?: string };
    return { sid: json.sid };
  }
}

export interface VerificationRequestOptions {
  userId?: string;
  context?: Record<string, unknown>;
}

export interface VerificationResult {
  success: boolean;
  record?: PhoneVerificationCode;
  failureReason?: 'CODE_EXPIRED' | 'MAX_ATTEMPTS' | 'NO_CODE' | 'INVALID_CODE';
}

const RESEND_INTERVAL_MS = parseInt(process.env.SMS_CODE_RESEND_INTERVAL_MS || '60000', 10);
const CODE_EXPIRY_MS = parseInt(process.env.SMS_CODE_TTL_MS || '600000', 10); // 10 minutes default
const MAX_ATTEMPTS = parseInt(process.env.SMS_CODE_MAX_ATTEMPTS || '5', 10);

function normalizePhone(phone: string): string {
  return phone.replace(/[^+\d]/g, '');
}

export class SmsVerificationService {
  private provider: SmsProvider;

  constructor(provider?: SmsProvider) {
    this.provider = provider ?? this.initializeProvider();
  }

  private initializeProvider(): SmsProvider {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (accountSid && authToken && fromNumber) {
      Logger.info('Using Twilio SMS provider');
      return new HttpSmsProvider(accountSid, authToken, fromNumber);
    }

    Logger.warn('Falling back to console SMS provider (Twilio credentials not configured)');
    return new ConsoleSmsProvider();
  }

  async createAndSendCode(phone: string, options: VerificationRequestOptions = {}): Promise<{ expiresAt: Date; sid?: string; code?: string }>
  {
    const normalizedPhone = normalizePhone(phone);

    const existing = await db.phoneVerificationCode.findFirst({
      where: { phone: normalizedPhone },
      orderBy: { createdAt: 'desc' }
    });

    if (existing?.lastSentAt) {
      const elapsed = Date.now() - existing.lastSentAt.getTime();
      if (elapsed < RESEND_INTERVAL_MS) {
        const waitMs = RESEND_INTERVAL_MS - elapsed;
        throw new Error(`Verification code recently sent. Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code.`);
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    await db.phoneVerificationCode.create({
      data: {
        phone: normalizedPhone,
        codeHash,
        userId: options.userId,
        expiresAt,
        lastSentAt: new Date(),
        metadata: options.context ?? undefined
      }
    });

    let sid: string | undefined;
    try {
      const messageBody = `Your La Carta verification code is ${code}. It expires in ${Math.round(CODE_EXPIRY_MS / 60000)} minutes.`;
      const result = await this.provider.send(normalizedPhone, messageBody);
      sid = result?.sid;
    } catch (error) {
      Logger.error('Failed to send verification SMS', {
        error: formatErrorPayload(error),
        phone: normalizedPhone,
        userId: options.userId
      });
      throw error;
    }

    Logger.info('Verification code generated', {
      phone: normalizedPhone,
      userId: options.userId,
      expiresAt: expiresAt.toISOString(),
      sid
    });

    return {
      expiresAt,
      sid,
      code: process.env.NODE_ENV === 'development' ? code : undefined
    };
  }

  async verifyCode(phone: string, code: string): Promise<VerificationResult> {
    const normalizedPhone = normalizePhone(phone);
    const record = await db.phoneVerificationCode.findFirst({
      where: {
        phone: normalizedPhone,
        verifiedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!record) {
      return { success: false, failureReason: 'NO_CODE' };
    }

    if (record.expiresAt.getTime() < Date.now()) {
      Logger.warn('Verification code expired', { phone: normalizedPhone, recordId: record.id });
      return { success: false, failureReason: 'CODE_EXPIRED', record };
    }

    if (record.attemptCount >= MAX_ATTEMPTS) {
      Logger.warn('Verification code locked due to max attempts', { phone: normalizedPhone, recordId: record.id });
      return { success: false, failureReason: 'MAX_ATTEMPTS', record };
    }

    const isValid = await bcrypt.compare(code, record.codeHash);

    const updated = await db.phoneVerificationCode.update({
      where: { id: record.id },
      data: {
        attemptCount: record.attemptCount + 1,
        lastAttemptAt: new Date(),
        verifiedAt: isValid ? new Date() : null
      }
    });

    if (!isValid) {
      if (updated.attemptCount >= MAX_ATTEMPTS) {
        Logger.warn('Verification code reached max attempts', { phone: normalizedPhone, recordId: record.id });
        return { success: false, failureReason: 'MAX_ATTEMPTS', record: updated };
      }

      return { success: false, failureReason: 'INVALID_CODE', record: updated };
    }

    Logger.info('Verification code validated', { phone: normalizedPhone, recordId: record.id });
    return { success: true, record: updated };
  }

  async invalidateCodes(phone: string): Promise<void> {
    const normalizedPhone = normalizePhone(phone);
    await db.phoneVerificationCode.updateMany({
      where: { phone: normalizedPhone, verifiedAt: null },
      data: {
        expiresAt: new Date(),
        lastAttemptAt: new Date()
      }
    });
  }
}

export const smsVerificationService = new SmsVerificationService();

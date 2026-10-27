import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length

function getKey(): Buffer {
  const key = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!key) {
    // Fallback for development - in production this should be set
    return crypto.scryptSync('default-dev-key-change-in-prod', 'salt', 32);
  }
  // If key is hex
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }
  return crypto.scryptSync(key, 'two-factor-salt', 32);
}

export function encryptSecret(secret: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decryptSecret(encryptedData: string): string {
  try {
    const key = getKey();
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      // If not encrypted with new format, assume it's plain text (for backward compat)
      return encryptedData;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // Fallback to plain text for backward compatibility
    return encryptedData;
  }
}

export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8 character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
}

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface ProtectedToken {
  version: 1;
  iv: string;
  ciphertext: string;
  tag: string;
}

export function encryptToken(token: string, keyHex: string): ProtectedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function decryptToken(token: ProtectedToken, keyHex: string): string {
  if (token.version !== 1) throw new Error('Unsupported credential format');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(token.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(token.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(token.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

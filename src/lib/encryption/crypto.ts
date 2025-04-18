// /src/lib/encryption/crypto.ts

import crypto from "crypto";
import { getHolographFileEncryptionKey } from "@/utils/encryption";
import { debugLog } from "@/utils/debug";

/**
 * Encrypt a file buffer using AES-256-CBC with a random IV.
 * The IV is prepended to the encrypted data.
 */
export async function encryptBuffer(buffer: Buffer, holographId: string): Promise<Buffer> {
  const key = await getHolographFileEncryptionKey(holographId); // returns 32-byte key
  const iv = crypto.randomBytes(16); // AES block size
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]); // Prepend IV
}

/**
 * Decrypt a buffer that was encrypted with encryptBuffer().
 * Extracts the IV and decrypts using the holograph key.
 */
export async function decryptBuffer(encryptedBuffer: Buffer, holographId: string): Promise<Buffer> {
  const key = await getHolographFileEncryptionKey(holographId);
  const iv = encryptedBuffer.subarray(0, 16);
  const encrypted = encryptedBuffer.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

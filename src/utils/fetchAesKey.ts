// /src/utils/fetchAesKey.ts
import { importAesKeyFromRaw } from "./encryptionClient";
import { debugLog } from "./debug";

export async function fetchAesKey(holographId: string): Promise<CryptoKey> {
  const response = await fetch(`/api/holograph/${holographId}/aes-key`);
  if (!response.ok) {
    throw new Error("Failed to fetch AES key");
  }

  const keyBuffer = await response.arrayBuffer();
  return await importAesKeyFromRaw(keyBuffer);
}

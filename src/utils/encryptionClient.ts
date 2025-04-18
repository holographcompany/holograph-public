// /src/utils/encryptionClient.ts — safe for use in React

export async function encryptFileInBrowser(file: File, key: CryptoKey): Promise<Blob> {
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const arrayBuffer = await file.arrayBuffer();
  
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      key,
      arrayBuffer
    );
  
    const ivAndData = new Uint8Array(iv.byteLength + encryptedBuffer.byteLength);
    ivAndData.set(iv, 0);
    ivAndData.set(new Uint8Array(encryptedBuffer), iv.byteLength);
  
    return new Blob([ivAndData], { type: "application/octet-stream" });
  }
  
  export async function importAesKeyFromRaw(buffer: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      "raw",
      buffer,
      { name: "AES-CBC" },
      false,
      ["encrypt", "decrypt"]
    );
  }
  
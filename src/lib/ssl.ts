// /src/lib/ssl.ts
import forge from "node-forge";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { bucket } from "@/lib/gcs"; // 👈 Use this — not BUCKET_NAME
import { debugLog } from "@/utils/debug";
import crypto from "crypto";

export async function generateSSLCertificate(holographId: string): Promise<{ sslCertPath: string; sslKeyPath: string; aesKeyPath: string }> {
  try {
    debugLog(`🚀 Starting SSL certificate generation for holographId: ${holographId}`);
    
    const sslBasePath = `ssl-keys/${holographId}/current`;
    const certPath = path.join("/tmp", `${holographId}.crt`);
    const keyPath = path.join("/tmp", `${holographId}.key`);
    const aesKeyPath = path.join("/tmp", `${holographId}.aes`);

    // 1. Generate keypair
    debugLog("🔐 Generating RSA key pair...");
    let keys;
    try {
      keys = forge.pki.rsa.generateKeyPair(2048);
      debugLog("✅ RSA key pair generated successfully");
    } catch (error) {
      debugLog("❌ Failed to generate RSA key pair:", error);
      throw error;
    }

    // 2. Create self-signed cert
    debugLog("📜 Creating self-signed certificate...");
    let pemCert, pemKey;
    try {
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = crypto.randomBytes(16).toString("hex");
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

      const attrs = [{ name: "commonName", value: holographId }];
      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keys.privateKey);

      pemCert = forge.pki.certificateToPem(cert);
      pemKey = forge.pki.privateKeyToPem(keys.privateKey);
      
      debugLog("✅ Certificate created and signed successfully");
    } catch (error) {
      debugLog("❌ Failed to create/sign certificate:", error);
      throw error;
    }

    // 3. Write cert and key to /tmp
    debugLog("💾 Writing certificate and keys to temporary files...");
    try {
      fs.writeFileSync(certPath, pemCert);
      fs.writeFileSync(keyPath, pemKey);
      debugLog("✅ Certificate and private key written to temp files");
    } catch (error) {
      debugLog(`❌ Failed to write to temp files: ${error.message}`);
      throw error;
    }

    // 4. Generate and save AES key
    debugLog("🔑 Generating AES key...");
    try {
      const aesKey = crypto.randomBytes(32);
      fs.writeFileSync(aesKeyPath, aesKey);
      debugLog("✅ AES key generated and written to temp file");
    } catch (error) {
      debugLog(`❌ Failed to generate/write AES key: ${error.message}`);
      throw error;
    }

    // 5. Upload to GCS with detailed error handling
    debugLog(`📤 Starting GCS uploads to path: ${sslBasePath}`);
    debugLog(`🪣 Using bucket: ${process.env.GCS_BUCKET_NAME}`);
    
    // Test bucket first
    try {
      debugLog("🧪 Testing bucket accessibility...");
      const [bucketExists] = await bucket.exists();
      debugLog(`✅ Bucket exists check: ${bucketExists}`);
    } catch (error) {
      debugLog("❌ Bucket access check failed:", error);
      debugLog("⚠️ Error details:", JSON.stringify(error.response?.data || error.message || error));
      throw error;
    }
    
    // Upload placeholder with detailed error reporting
    try {
      debugLog("📁 Uploading placeholder file...");
      await bucket.file(`${sslBasePath}/.placeholder`).save("");
      debugLog("✅ Placeholder file uploaded successfully");
    } catch (error) {
      debugLog("❌ Placeholder file upload failed:", error);
      if (error.response) {
        debugLog("🔍 Error response:", JSON.stringify({
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        }));
      }
      throw error;
    }
    
    // Upload certificate
    try {
      debugLog("📁 Uploading certificate...");
      await bucket.upload(certPath, { destination: `${sslBasePath}/public.crt` });
      debugLog("✅ Certificate uploaded successfully");
    } catch (error) {
      debugLog("❌ Certificate upload failed:", error);
      if (error.response) {
        debugLog("🔍 Error response:", JSON.stringify(error.response.data));
      }
      throw error;
    }
    
    // Upload private key
    try {
      debugLog("📁 Uploading private key...");
      await bucket.upload(keyPath, { destination: `${sslBasePath}/private.key` });
      debugLog("✅ Private key uploaded successfully");
    } catch (error) {
      debugLog("❌ Private key upload failed:", error);
      if (error.response) {
        debugLog("🔍 Error response:", JSON.stringify(error.response.data));
      }
      throw error;
    }
    
    // Upload AES key
    try {
      debugLog("📁 Uploading AES key...");
      await bucket.upload(aesKeyPath, { destination: `${sslBasePath}/aes.key` });
      debugLog("✅ AES key uploaded successfully");
    } catch (error) {
      debugLog("❌ AES key upload failed:", error);
      if (error.response) {
        debugLog("🔍 Error response:", JSON.stringify(error.response.data));
      }
      throw error;
    }

    // 6. Clean up
    debugLog("🧹 Cleaning up temporary files...");
    try {
      fs.unlinkSync(certPath);
      fs.unlinkSync(keyPath);
      fs.unlinkSync(aesKeyPath);
      debugLog("✅ Temporary files cleaned up successfully");
    } catch (error) {
      debugLog(`⚠️ Warning: Failed to clean up some temp files: ${error.message}`);
      // Don't throw here, continue with the function
    }

    debugLog("✅ SSL + AES keys uploaded to GCS:", sslBasePath);

    return {
      sslCertPath: `${sslBasePath}/public.crt`,
      sslKeyPath: `${sslBasePath}/private.key`,
      aesKeyPath: `${sslBasePath}/aes.key`,
    };
  } catch (error) {
    debugLog("💥 SSL Certificate generation failed with error:", error);
    debugLog("💥 Stack trace:", error.stack);
    throw error;
  }
}
// /src/utils/debug.ts

const REDACT_KEYS = ["token", "secret", "password", "apiKey", "jwt", "access"];

function redactSensitiveData(obj: any): any {
  if (typeof obj === "string") {
    return redactString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  if (typeof obj === "object" && obj !== null) {
    const redacted: Record<string, any> = {};
    for (const key in obj) {
      if (REDACT_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactSensitiveData(obj[key]);
      }
    }
    return redacted;
  }

  return obj;
}

function redactString(str: string): string {
  return REDACT_KEYS.some((key) => str.toLowerCase().includes(key))
    ? "[REDACTED]"
    : str;
}

export const DEBUG_MODE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGGING === "true" // frontend
    : process.env.ENABLE_DEBUG_LOGGING === "true";            // backend


export const debugLog = (...args: any[]) => {
  if (!DEBUG_MODE) return;

  const safeArgs = args.map(redactSensitiveData);
  console.log("[DEBUG]", ...safeArgs);
};

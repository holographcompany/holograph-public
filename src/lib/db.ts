// /src/lib/db.ts
import { PrismaClient } from '@prisma/client';
import { debugLog } from '@/utils/debug';

console.log("🌐 NODE_ENV:", process.env.NODE_ENV);
console.log("🌐 DATABASE_URL at runtime:", process.env.DATABASE_URL);

debugLog("🌐 NODE_ENV:", process.env.NODE_ENV);
debugLog("🌐 DATABASE_URL at runtime:", process.env.DATABASE_URL);

// Get the connection URL from environment variables
const databaseUrl = process.env.DATABASE_URL;
// Create Prisma client with explicit connection configuration
const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();


if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  if (process.env.NODE_ENV === 'development') {
    debugLog("🔌 Prisma Client initialized in development mode");
    console.log("🔌 Prisma Client initialized in development mode");
  } else {
    debugLog("🔌 Prisma Client initialized in production mode");
    console.log("🔌 Prisma Client initialized in production mode");
  }
}
console.log("🔌 Prisma Client initialized with explicit DATABASE_URL:", !!databaseUrl);
debugLog("🔌 Prisma Client initialized with explicit DATABASE_URL:", !!databaseUrl);


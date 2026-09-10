import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { config } from './env.js';

let prisma;

if (config.tursoDatabaseUrl) {
  const libsql = createClient({
    url: config.tursoDatabaseUrl,
    authToken: config.tursoAuthToken,
  });
  const adapter = new PrismaLibSql(libsql);
  prisma = new PrismaClient({ adapter, log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
  console.log('🔗 Configured Prisma with Turso libSQL Adapter');
} else {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  console.log('🔗 Configured Prisma with standard SQLite driver');
}

export { prisma };

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('📦 Database connected successfully (Prisma)');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.log('⚠️ No .env file found. Generating a default .env for Render deployment...');
  const defaultEnv = `DATABASE_URL="file:./dev.db"\nPORT=5000\nJWT_SECRET="fallback-secret-key-do-not-use-in-real-production"\n`;
  fs.writeFileSync(envPath, defaultEnv);
  console.log('✅ Default .env file created successfully with SQLite configuration.');
} else {
  console.log('✅ .env file already exists. Proceeding with build...');
}

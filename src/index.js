import { execSync } from 'child_process';

console.log('🔄 Preparing Prisma Client for Render environment...');
try {
  // Generate Prisma client with driverAdapters enabled FIRST
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️ Failed to generate prisma client:', e.message);
}

// Now dynamically import the actual application so that the generated client is available
import('./app.js');

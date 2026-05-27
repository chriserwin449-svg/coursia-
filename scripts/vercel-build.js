// Vercel build script: switches to PostgreSQL schema before building
const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '..', 'prisma');
const pgSchema = path.join(schemaDir, 'schema.postgres.prisma');
const mainSchema = path.join(schemaDir, 'schema.prisma');

if (fs.existsSync(pgSchema)) {
  fs.copyFileSync(pgSchema, mainSchema);
  console.log('✅ Switched to PostgreSQL schema for Vercel build');
} else {
  console.log('⚠️ No PostgreSQL schema found, using current schema');
}

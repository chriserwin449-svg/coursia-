// Switch to PostgreSQL schema (for Vercel deployment)
const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '..', 'prisma');
const pgSchema = path.join(schemaDir, 'schema.postgres.prisma');
const mainSchema = path.join(schemaDir, 'schema.prisma');

if (fs.existsSync(pgSchema)) {
  // Save current (SQLite) schema first
  fs.copyFileSync(mainSchema, path.join(schemaDir, 'schema.sqlite.prisma'));
  fs.copyFileSync(pgSchema, mainSchema);
  console.log('✅ Switched to PostgreSQL schema');
  console.log('⚠️ Remember to set DATABASE_URL to your Supabase PostgreSQL connection string');
} else {
  console.log('❌ No schema.postgres.prisma found');
}

// Switch back to SQLite schema (for local development)
const fs = require('fs');
const path = require('path');

const schemaDir = path.join(__dirname, '..', 'prisma');
const sqliteSchema = path.join(schemaDir, 'schema.sqlite.prisma');
const mainSchema = path.join(schemaDir, 'schema.prisma');

if (fs.existsSync(sqliteSchema)) {
  fs.copyFileSync(sqliteSchema, mainSchema);
  console.log('✅ Switched to SQLite schema');
} else {
  console.log('⚠️ No schema.sqlite.prisma found, current schema unchanged');
}

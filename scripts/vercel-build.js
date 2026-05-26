// Vercel build script: verify PostgreSQL schema and generate Prisma client
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');

if (schema.includes('provider = "postgresql"')) {
  console.log('✅ PostgreSQL schema confirmed for Vercel build');
} else {
  console.error('❌ Schema is not configured for PostgreSQL!');
  process.exit(1);
}

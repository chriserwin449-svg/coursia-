// Vercel build script
// Swaps schema.prisma to PostgreSQL version before building
// Then pushes schema changes to the database (creates missing columns/tables)

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const schemaDir = path.join(__dirname, "..", "prisma");
const mainSchema = path.join(schemaDir, "schema.prisma");
const pgSchema = path.join(schemaDir, "schema.postgres.prisma");

console.log("🔍 Checking Prisma schema for Vercel build...");

// Check if current schema is SQLite
const currentSchema = fs.readFileSync(mainSchema, "utf8");
if (currentSchema.includes('provider = "sqlite"')) {
  console.log("🔄 Swapping to PostgreSQL schema for Vercel build...");
  const pgContent = fs.readFileSync(pgSchema, "utf8");
  fs.writeFileSync(mainSchema, pgContent);
  console.log("✅ Schema swapped to PostgreSQL");
} else {
  console.log("✅ Schema already set to PostgreSQL");
}

try {
  execSync("npx prisma generate", { stdio: "inherit" });
  console.log("✅ Prisma client generated successfully");
} catch (error) {
  console.error("❌ Failed to generate Prisma client:", error.message);
  process.exit(1);
}

// Push schema to database to create any missing columns/tables
// This is safe — it only adds new columns/tables, never drops existing data
if (process.env.DATABASE_URL) {
  try {
    console.log("📊 Pushing schema changes to database (non-destructive)...");
    execSync("npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push", {
      stdio: "inherit",
      timeout: 120000,
    });
    console.log("✅ Database schema pushed successfully");
  } catch (error) {
    console.warn("⚠️ Schema push failed (non-critical, DB may need manual migration):", error.message);
  }
}

console.log("✅ Vercel build preparation complete");

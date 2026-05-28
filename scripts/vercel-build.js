// Vercel build script
// The schema.prisma is already configured for PostgreSQL.
// We just need to generate the Prisma client before building.

const { execSync } = require("child_process");

console.log("🔍 Checking Prisma schema...");

try {
  execSync("npx prisma generate", { stdio: "inherit" });
  console.log("✅ Prisma client generated successfully");
} catch (error) {
  console.error("❌ Failed to generate Prisma client:", error.message);
  process.exit(1);
}

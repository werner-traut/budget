// scripts/test-connection.js
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { expand } from "dotenv-expand";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local
const localEnv = dotenv.config({
  path: resolve(__dirname, "../.env.local"),
});
expand(localEnv);

async function testConnection() {
  // First verify we have the environment variables
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  console.log("Environment variables loaded");
  console.log(
    "Database URL found:",
    process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")
  ); // Hide password in logs

  console.log("Creating Prisma Client...");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ["query", "info", "warn", "error"],
  });

  try {
    console.log("Attempting to connect to database...");
    // Try to execute a simple query
    const result = await prisma.$queryRaw`SELECT CURRENT_TIMESTAMP`;
    console.log("Successfully connected to database!");
    console.log("Test query result:", result);
  } catch (error) {
    console.error("Failed to connect to database:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    if (error.code) console.error("Error code:", error.code);
    if (error.meta) console.error("Error metadata:", error.meta);
  } finally {
    await prisma.$disconnect();
    console.log("Disconnected from database");
  }
}

testConnection();

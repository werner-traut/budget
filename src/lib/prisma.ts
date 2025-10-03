import { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaClientEdge } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

const prismaClientSingleton = () => {
  // Use edge client with Accelerate when DATABASE_URL uses prisma:// protocol
  // This happens in production (Vercel) with Prisma Accelerate
  const databaseUrl = process.env.DATABASE_URL || "";
  const useAccelerate = databaseUrl.startsWith("prisma://");

  if (useAccelerate) {
    return new PrismaClientEdge().$extends(withAccelerate());
  }

  // Use standard client for local development with direct PostgreSQL connection
  return new PrismaClient();
};

type PrismaClientType = ReturnType<typeof prismaClientSingleton>;

declare const globalThis: {
  prismaGlobal: PrismaClientType;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

// Export with a consistent type to avoid union type issues
export default prisma as PrismaClient;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

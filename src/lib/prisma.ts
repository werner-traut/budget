import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;

const prismaClientSingleton = () => {
  const pool = new Pool({
    connectionString,
    // optimize for serverless
    max: 1, // utilize lambda concurrency for scaling, not pool size
    allowExitOnIdle: true, // allow process to exit even if pool has connections
    connectionTimeoutMillis: 20000, // wait longer for connection in cold start
    idleTimeoutMillis: 20000, // close idle connections faster
  });
  const adapter = new PrismaPg(pool);

  // Always use standard PrismaClient - it works for both local and production
  // The DATABASE_URL determines the behavior
  return new PrismaClient({ adapter });
};

type PrismaClientType = ReturnType<typeof prismaClientSingleton>;

declare const globalThis: {
  prismaGlobal: PrismaClientType;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

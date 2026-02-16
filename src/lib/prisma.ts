import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;

const prismaClientSingleton = () => {
  const pool = new Pool({ connectionString });
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

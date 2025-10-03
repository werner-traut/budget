import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  // Always use standard PrismaClient - it works for both local and production
  // The DATABASE_URL determines the behavior
  return new PrismaClient();
};

type PrismaClientType = ReturnType<typeof prismaClientSingleton>;

declare const globalThis: {
  prismaGlobal: PrismaClientType;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

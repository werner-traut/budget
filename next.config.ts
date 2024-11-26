/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Make environment variables available to Prisma
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  },
};

module.exports = nextConfig;

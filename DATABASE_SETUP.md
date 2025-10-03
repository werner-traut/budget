# Database Configuration

This application supports two database configurations:

## Local Development (Direct PostgreSQL)

For local development, use a direct PostgreSQL connection:

```bash
DATABASE_URL="postgresql://admin:admin@localhost:5432/budget"
```

The application will automatically use the standard Prisma client without Prisma Accelerate.

## Production (Prisma Accelerate)

For production deployment on Vercel, use Prisma Accelerate:

```bash
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
DIRECT_URL="postgresql://user:password@host:port/database"
```

The application detects the `prisma://` protocol and automatically:
- Uses the edge-compatible Prisma client
- Enables Prisma Accelerate extension
- Enables cacheStrategy options for optimized queries

## How It Works

### src/lib/prisma.ts

The Prisma client initialization automatically detects the database URL protocol:
- If `DATABASE_URL` starts with `prisma://`, it uses the edge client with Accelerate
- Otherwise, it uses the standard Prisma client

### API Routes

API routes check the DATABASE_URL to conditionally add `cacheStrategy`:
- In production with Accelerate: cache strategies are applied
- In local development: cache strategies are omitted

## Environment Variables

Create a `.env.local` file for local development:

```bash
# Local Development
DATABASE_URL="postgresql://admin:admin@localhost:5432/budget"
```

Configure Vercel environment variables for production:

```bash
# Production (Vercel)
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
DIRECT_URL="postgresql://connection-pooler:port/database"
```

## Migration Commands

```bash
# Generate Prisma client
npm run generate

# Run database migrations (requires DIRECT_URL in production)
npx prisma migrate deploy

# Development: create and apply migrations
npx prisma migrate dev
```

## Notes

- The `DIRECT_URL` is only required in production when using Prisma Accelerate for running migrations
- Caching strategies (ttl, swr) are only available when using Prisma Accelerate
- The application seamlessly switches between configurations based on the DATABASE_URL protocol

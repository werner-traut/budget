# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Budget Tracker - A Next.js application for tracking personal budget, pay periods, and daily balances with Google OAuth authentication.

## Tech Stack

- **Framework**: Next.js 15.1.0 (App Router)
- **Runtime**: React 19, using Turbopack for dev server
- **Database**: PostgreSQL with Prisma ORM (row-level security enabled)
- **Authentication**: NextAuth v5 with Google provider (Edge runtime)
- **State Management**: Zustand with Immer middleware
- **UI**: Tailwind CSS, Radix UI components, Recharts for graphs
- **Date Handling**: date-fns and date-fns-tz (critical for UTC date handling)

## Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack

# Database
npm run generate         # Generate Prisma client
npm run dev:generate     # Generate Prisma client for development
# Note: postinstall hook runs 'prisma generate --no-engine' automatically

# Build & Deploy
npm run build            # Generates Prisma client, then builds Next.js app
npm start               # Start production server
npm run lint            # Run ESLint
```

## Architecture

### State Management (Zustand Store)

Central store at `src/store/useBudgetStore.ts` manages all application state:
- Budget entries (auto-sorted by due_date)
- Pay periods (sorted by start_date)
- Daily balance
- Adhoc settings (daily_amount)
- Initialization and loading states

Store uses Immer middleware for immutable state updates. All fetch functions are async and handle error states.

### Authentication Flow

1. NextAuth v5 configured in `src/auth.ts` with Edge runtime
2. Google OAuth provider
3. JWT callback creates/fetches user from database and attaches userId to token
4. Session callback adds userId to session object
5. Middleware in `src/middleware.ts` protects routes
6. Root page (`src/app/page.tsx`) redirects unauthenticated users to `/auth/signin`

### Database Models (Prisma)

All models have row-level security enabled:
- **users**: User profiles (email, name, avatar_url)
- **budget_items**: Expense entries with due_date (date only, no time)
- **pay_periods**: Salary periods with period_type enum (CURRENT_PERIOD, NEXT_PERIOD, PERIOD_AFTER, FUTURE_PERIOD, CLOSED_PERIOD)
- **daily_balances**: User's bank balance for a specific date (unique constraint on user_id + date)
- **balance_history**: Historical balance snapshots with projections for current/next/period_after
- **adhoc_settings**: User settings like daily_amount

### Date Handling (Critical)

This app uses **UTC dates without time components** for all date operations:

- `getTodayInUTC()`: Returns start of current day in UTC (strips timezone)
- `formatDateForDisplay()`: Formats dates in UTC to prevent timezone conversion
- All database date fields use `@db.Date` (no time)
- API routes expect dates in 'yyyy-MM-dd' format

**Always use the date utilities in `src/lib/utils/date.ts` to prevent timezone bugs.**

### Pay Period Cascade Logic

Located in `src/lib/utils/periods.ts`:
- `shouldCascadePeriods()`: Checks if NEXT_PERIOD start_date has passed
- `cascadePeriodTypes()`: Shifts period types forward (CURRENT→CLOSED, NEXT→CURRENT, etc.)

### API Routes

All routes follow RESTful patterns and require authentication:
- `/api/budget-entries` - GET (list), POST (create)
- `/api/budget-entries/[id]` - PUT (update), DELETE
- `/api/pay-periods` - GET (list), POST (create)
- `/api/pay-periods/[id]` - PUT (update), DELETE
- `/api/daily-balance?date=YYYY-MM-DD` - GET (fetch), POST (upsert)
- `/api/balance-history` - GET (with optional date filtering)
- `/api/adhoc-settings` - GET, POST (upsert)

### Component Structure

- **Dashboard** (`src/components/Dashboard.tsx`): Main layout with tabs (Budget, Pay Periods, Summary, Graph)
- **BudgetView**: Shows budget entries with daily balance check
- **PayPeriodManager**: Manages pay periods with cascade logic
- **BudgetSummary**: Displays period summaries and projections
- **BalanceGraph**: Recharts visualization of balance history

### Environment Variables

Required in `.env.local`:
- `DATABASE_URL`: Prisma connection string (connection pooling)
- `DIRECT_URL`: Direct database connection for migrations
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth secret
- `AUTH_SECRET`: NextAuth secret for signing tokens

### Key Files

- `src/lib/prisma.ts`: Prisma client singleton (Edge-compatible with @prisma/extension-accelerate)
- `src/auth.ts`: NextAuth configuration with Edge runtime
- `src/middleware.ts`: Route protection middleware
- `prisma/schema.prisma`: Database schema with RLS

## Important Notes

- All numeric amounts from Prisma come as Decimal - convert to Number before using in calculations
- Entries are auto-sorted by due_date in the Zustand store
- Period types cascade automatically when NEXT_PERIOD start date is reached
- Daily balance is date-specific and unique per user+date
- Use UTC date utilities to prevent timezone conversion issues

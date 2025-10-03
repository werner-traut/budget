import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config without database dependencies
export const authConfig = {
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAuthPage = nextUrl.pathname.startsWith("/auth");

      if (isOnAuthPage) {
        if (isLoggedIn) return false; // Redirect authenticated users away from auth pages
        return true; // Allow unauthenticated users to access auth pages
      }

      return isLoggedIn; // Require authentication for all other pages
    },
  },
  providers: [], // Providers are added in auth.ts
} satisfies NextAuthConfig;

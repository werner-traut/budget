import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { authConfig } from "./auth.config";

// Local-only authentication shortcut. Guarded by NODE_ENV so it can never be
// enabled in a production build, regardless of how the env var is set.
export const DEV_BYPASS_EMAIL = "dev@budget.local";
const devBypassEnabled =
  process.env.DEV_AUTH_BYPASS === "true" &&
  process.env.NODE_ENV !== "production";

const devBypassProvider = Credentials({
  id: "dev-bypass",
  name: "Developer Bypass",
  credentials: {},
  async authorize() {
    // No real credentials are checked — this is a dev-only convenience.
    return { id: "dev-bypass", email: DEV_BYPASS_EMAIL, name: "Dev User" };
  },
});

async function getOrCreateUser(email: string) {
  try {
    // First try to find the user
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (user) return user.id;

    // If no user exists, create one
    const newUser = await prisma.users.create({
      data: { email },
    });
    return newUser.id;
  } catch (error) {
    console.error("Error in getOrCreateUser:", error);
    throw error;
  }
}

// Create the auth handlers with full config including providers and callbacks
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    ...(devBypassEnabled ? [devBypassProvider] : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Users are looked up/created by email, so only accept emails the
      // provider has actually verified — otherwise a second provider added
      // later could be used to claim someone else's account.
      if (account?.provider === "google") {
        return profile?.email_verified === true;
      }
      return true;
    },
    async jwt({ token, profile, user }) {
      // Credentials sign-in delivers the email on `user`; copy it onto the
      // token so the lookup below works the same as for OAuth.
      if (user?.email && !token.email) {
        token.email = user.email;
      }

      // Only proceed if we have an email
      if (!token.email) return token;

      try {
        // Get or create user and attach ID to token
        const userId = await getOrCreateUser(token.email);
        token.userId = userId;

        // Update user profile if we have new information
        if (profile) {
          await prisma.users.update({
            where: { id: userId },
            data: {
              name: profile.name,
              avatar_url: profile.picture,
              updated_at: new Date(),
            },
          });
        }
      } catch (error) {
        console.error("Error in jwt callback:", error);
      }

      return token;
    },
    async session({ session, token }) {
      // Attach user ID to session if available
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

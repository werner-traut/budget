import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import prisma from "@/lib/prisma";

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

// Main configuration object
export const config = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
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
  pages: {
    signIn: "/auth/signin",
  },
  // // Add these new configurations for Edge compatibility
  // trustHost: true,
  // cookies: {
  //   sessionToken: {
  //     name: `__Secure-next-auth.session-token`,
  //     options: {
  //       httpOnly: true,
  //       sameSite: "lax",
  //       path: "/",
  //       secure: true,
  //     },
  //   },
  // },
} satisfies NextAuthConfig;

// Create the auth handlers
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(config);

// Specify Edge runtime
export const runtime = "edge";

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

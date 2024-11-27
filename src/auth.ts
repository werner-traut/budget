import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import prisma from "@/lib/prisma";

async function getOrCreateUser(email: string) {
  try {
    // Try to find existing user
    const user = await prisma.users.findUnique({
      where: {
        email: email,
      },
    });

    if (!user) {
      // Create new user if doesn't exist
      const newUser = await prisma.users.create({
        data: {
          email: email,
        },
      });
      return newUser.id;
    }

    return user.id;
  } catch (error) {
    console.error("Error in getOrCreateUser:", error);
    throw error;
  }
}

export const config = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async jwt({ token, account, profile }) {
      if (!token.email) return token;

      try {
        // Always fetch/create user ID based on email
        const userId = await getOrCreateUser(token.email);
        token.userId = userId;

        // Update user info if available
        if (profile) {
          await prisma.users.update({
            where: {
              id: userId,
            },
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
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
} satisfies NextAuthConfig;

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(config);

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

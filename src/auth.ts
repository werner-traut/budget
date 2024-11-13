import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getSupabaseUser(email: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (error || !data) {
    // Create new user if doesn't exist
    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({ email })
      .select("id")
      .single();

    if (createError) throw createError;
    return newUser.id;
  }

  return data.id;
}

export const config = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (!token.email) return token;
      console.log("jwt callback:", token, account, profile);

      try {
        // Always fetch/create Supabase user ID based on email
        const supabaseUserId = await getSupabaseUser(token.email);
        token.supabaseUserId = supabaseUserId;

        // Update user info if available
        if (profile) {
          await supabase
            .from("users")
            .update({
              name: profile.name,
              avatar_url: profile.picture,
              updated_at: new Date().toISOString(),
            })
            .eq("id", supabaseUserId);
        }
      } catch (error) {
        console.error("Error in jwt callback:", error);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.supabaseUserId) {
        session.user.id = token.supabaseUserId as string;
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

// Types
// declare module "next-auth/jwt" {
//   interface JWT {
//     supabaseUserId?: string;
//   }
// }

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

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // JWT strategy: session is encoded in a cookie — no DB lookup required.
  // This works reliably in Next.js 15 Route Handlers and Server Components
  // without hitting the async-cookies incompatibility in NextAuth v5 beta.
  session: { strategy: "jwt" },
  providers: [
    Resend({
      from: process.env.AUTH_RESEND_FROM ?? "noreply@example.com",
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Add user.id to the JWT on first sign-in
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    // Populate session.user.id from the JWT token
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});

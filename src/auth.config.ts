import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/api/auth", "/interview"];

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/verify",
  },
  providers: [], // Providers are added in auth.ts — not needed for edge middleware
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));
      return isPublic || isLoggedIn;
    },
  },
};
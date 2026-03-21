import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Use the edge-compatible config (no Prisma) for middleware.
// The authorized() callback in authConfig handles route protection.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
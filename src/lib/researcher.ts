import { auth } from "@/auth";
import { Session } from "next-auth";

/**
 * Returns the NextAuth session user for the current request.
 * Throws if called outside an authenticated context.
 */
export async function getAuthenticatedUser(): Promise<NonNullable<Session["user"]>> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return session.user;
}
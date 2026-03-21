import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  // Already signed in — send straight to dashboard
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">QUALIBOT</h1>
        <p className="mt-2 text-sm text-gray-500">
          AI-Assisted Qualitative Research Pipeline
        </p>

        <div className="mt-8">
          <Link
            href="/sign-in"
            className="block rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Sign in / Create account
          </Link>
          <p className="mt-3 text-xs text-gray-400">
            Enter your email and we&apos;ll send you a sign-in link. New accounts are created automatically.
          </p>
        </div>
      </div>
    </main>
  );
}
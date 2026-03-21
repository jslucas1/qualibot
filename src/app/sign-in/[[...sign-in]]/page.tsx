import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
        <p className="mt-2 text-sm text-gray-500">
          Enter your email and we&apos;ll send you a sign-in link.
        </p>

        <form
          className="mt-6 space-y-4"
          action={async (formData: FormData) => {
            "use server";
            try {
              await signIn("resend", {
                email: formData.get("email"),
                redirectTo: "/dashboard",
              });
            } catch (err) {
              if (err instanceof AuthError) {
                redirect(`/sign-in?error=${err.type}`);
              }
              throw err;
            }
          }}
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="you@institution.edu"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Send sign-in link
          </button>
        </form>
      </div>
    </div>
  );
}
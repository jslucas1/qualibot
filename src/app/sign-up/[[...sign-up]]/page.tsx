import { redirect } from "next/navigation";

// With magic-link auth there is no separate sign-up flow.
// First-time users enter their email on the sign-in page and
// NextAuth creates their account automatically.
export default function SignUpPage() {
  redirect("/sign-in");
}
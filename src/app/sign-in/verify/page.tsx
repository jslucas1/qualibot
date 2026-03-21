export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
          <svg
            className="h-6 w-6 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Check your email</h1>
        <p className="mt-2 text-sm text-gray-500">
          A sign-in link has been sent to your email address. Click the link to
          access your dashboard.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          The link expires in 24 hours. You can close this tab.
        </p>
      </div>
    </div>
  );
}
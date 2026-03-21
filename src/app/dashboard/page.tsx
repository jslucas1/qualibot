import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/researcher";
import { prisma } from "@/lib/prisma";
import { NewSessionButton } from "@/components/dashboard/NewSessionButton";

// ── Status badge ─────────────────────────────────────────────────────────────

type SessionStatus = "PHASE1_IN_PROGRESS" | "PHASE1_COMPLETE" | "PHASE2_ACTIVE" | "COMPLETE";

const STATUS_LABELS: Record<SessionStatus, string> = {
  PHASE1_IN_PROGRESS: "Phase 1 — In Progress",
  PHASE1_COMPLETE: "Phase 1 — Complete",
  PHASE2_ACTIVE: "Interviews Active",
  COMPLETE: "Complete",
};

const STATUS_COLORS: Record<SessionStatus, string> = {
  PHASE1_IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  PHASE1_COMPLETE: "bg-blue-100 text-blue-800",
  PHASE2_ACTIVE: "bg-green-100 text-green-800",
  COMPLETE: "bg-gray-100 text-gray-700",
};

function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  const sessions = await prisma.studySession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { participants: true },
      },
    },
  });

  const total = sessions.length;
  const active = sessions.filter(
    (s) => s.status === "PHASE1_IN_PROGRESS" || s.status === "PHASE2_ACTIVE"
  ).length;
  const totalInterviews = sessions.reduce(
    (sum, s) => sum + s._count.participants,
    0
  );

  const firstName = user.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your qualitative research studies
          </p>
        </div>
        <NewSessionButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Studies" value={total} />
        <StatCard label="Active Studies" value={active} />
        <StatCard label="Total Interviews" value={totalInterviews} />
      </div>

      {/* Session list */}
      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Study
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Interviews
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Last Updated
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {session.title}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      Created {formatDate(session.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={session.status as SessionStatus} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {session._count.participants}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(session.updatedAt)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <Link
                      href={`/dashboard/sessions/${session.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-6 py-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-gray-900">No studies yet</p>
      <p className="mt-1 text-sm text-gray-500">
        Create your first study to start building your interview instrument.
      </p>
    </div>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
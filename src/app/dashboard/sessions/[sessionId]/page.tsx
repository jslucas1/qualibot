import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/researcher";
import { prisma } from "@/lib/prisma";
import { Phase1Chat } from "@/components/phase1/Phase1Chat";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getAuthenticatedUser();

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: {
      id: true,
      title: true,
      currentStep: true,
      conversationHistory: true,
    },
  });

  if (!session) notFound();

  const history = (session.conversationHistory as ConversationMessage[] | null) ?? [];

  return (
    // Full-height layout: subtract the outer padding/header height
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-gray-900">{session.title}</span>
      </div>

      {/* Chat — fills remaining height */}
      <div className="min-h-0 flex-1">
        <Phase1Chat
          sessionId={session.id}
          initialStep={session.currentStep}
          initialHistory={history}
        />
      </div>
    </div>
  );
}

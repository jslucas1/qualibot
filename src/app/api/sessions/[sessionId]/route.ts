import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studySession = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: session.user.id },
    select: {
      id: true,
      title: true,
      status: true,
      currentStep: true,
      researchQuestion: true,
      theoreticalFramework: true,
      targetPopulation: true,
      conversationHistory: true,
    },
  });

  if (!studySession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(studySession);
}

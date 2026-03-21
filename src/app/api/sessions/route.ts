import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSessionSchema = z.object({
  title: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const studySession = await prisma.studySession.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
    },
  });

  return NextResponse.json({ sessionId: studySession.id }, { status: 201 });
}

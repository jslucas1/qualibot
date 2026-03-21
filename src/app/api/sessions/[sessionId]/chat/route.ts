import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildPhase1SystemPrompt, getNextStep } from "@/lib/phase1Prompt";
import { NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  message: z.string().min(1).max(10000),
});

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }

  const studySession = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: session.user.id },
  });

  if (!studySession) {
    return new Response("Not found", { status: 404 });
  }

  const history =
    (studySession.conversationHistory as ConversationMessage[] | null) ?? [];

  const userMessage: ConversationMessage = {
    role: "user",
    content: parsed.data.message,
    timestamp: new Date().toISOString(),
  };

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: parsed.data.message },
  ];

  const systemPrompt = buildPhase1SystemPrompt(studySession.currentStep, {
    researchQuestion: studySession.researchQuestion,
    theoreticalFramework: studySession.theoreticalFramework,
    targetPopulation: studySession.targetPopulation,
  });

  const anthropic = new Anthropic();

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const responseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullText = "";

      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullText += text;
            // Stream to client, suppressing the step-complete token
            const visible = text.replace("[[STEP_COMPLETE]]", "");
            if (visible) controller.enqueue(encoder.encode(visible));
          }
        }

        const stepComplete = fullText.includes("[[STEP_COMPLETE]]");
        const cleanContent = fullText.replace("[[STEP_COMPLETE]]", "").trim();

        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: cleanContent,
          timestamp: new Date().toISOString(),
        };

        const updatedHistory = [...history, userMessage, assistantMessage];
        const newStep = stepComplete
          ? getNextStep(studySession.currentStep)
          : studySession.currentStep;

        await prisma.studySession.update({
          where: { id: sessionId },
          data: {
            conversationHistory: updatedHistory,
            ...(stepComplete && { currentStep: newStep }),
          },
        });

        // Send metadata so the client can update step state without a refetch
        if (stepComplete) {
          const meta = JSON.stringify({ event: "step_advanced", newStep });
          controller.enqueue(
            encoder.encode(`\n\n[[QUALIBOT_META:${meta}]]`)
          );
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

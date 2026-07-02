import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_TYPES = ["bug_report", "feature_request", "question", "general"] as const;
type FeedbackType = (typeof VALID_TYPES)[number];

function isValidType(t: string): t is FeedbackType {
  return (VALID_TYPES as readonly string[]).includes(t);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, subject, message, email, page, userId } = body as Record<string, unknown>;

    // Validate required fields
    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (subject.length > 200) {
      return NextResponse.json({ error: "Subject too long (max 200 chars)" }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: "Message too long (max 5000 chars)" }, { status: 400 });
    }

    // Optional validation
    const feedbackType = typeof type === "string" && isValidType(type) ? type : "general";
    const feedbackEmail = typeof email === "string" && email.includes("@") ? email.slice(0, 200) : null;
    const feedbackPage = typeof page === "string" ? page.slice(0, 500) : null;
    const feedbackUserId = typeof userId === "string" && userId.length > 5 ? userId.slice(0, 100) : null;

    // Collect metadata
    const metadata: Record<string, unknown> = {};
    if (request.headers.get("user-agent")) metadata.userAgent = request.headers.get("user-agent")?.slice(0, 300);
    metadata.timestamp = new Date().toISOString();

    const feedback = await db.feedback.create({
      data: {
        userId: feedbackUserId,
        type: feedbackType,
        subject: subject.trim(),
        message: message.trim(),
        email: feedbackEmail,
        page: feedbackPage,
        metadata: JSON.stringify(metadata),
        status: "new",
      },
    });

    console.log("[feedback] New feedback:", {
      id: feedback.id,
      type: feedbackType,
      subject: subject.trim().slice(0, 60),
      userId: feedbackUserId?.slice(0, 8) + "...",
    });

    return NextResponse.json({ success: true, id: feedback.id });
  } catch (error) {
    console.error("[feedback] Error:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
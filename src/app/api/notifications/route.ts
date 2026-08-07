import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/get-user-id";

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Count unread
    const unreadCount = await db.notification.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("[notifications GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, title, message, data, targetUserId } = body;

    // Allow creating notifications for another user (e.g., when sharing a course)
    const recipientId = targetUserId || userId;

    const notification = await db.notification.create({
      data: {
        userId: recipientId,
        type: type || "general",
        title: title || "",
        message: message || null,
        data: data ? JSON.stringify(data) : "{}",
        isRead: false,
      },
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("[notifications POST] Error:", error);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      // Mark all as read for this user
      await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      // Mark specific notification as read
      await db.notification.update({
        where: { id: notificationId, userId },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "notificationId or markAllRead required" }, { status: 400 });
  } catch (error) {
    console.error("[notifications PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/get-user-id";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;
    const userId = getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the share record
    const share = await db.courseShare.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Only the recipient can delete a received shared course
    if (share.sharedWith !== userId) {
      return NextResponse.json({ error: "You can only remove courses shared with you" }, { status: 403 });
    }

    // Delete the share record
    await db.courseShare.delete({
      where: { id: shareId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[shared/delete] Error:", error);
    return NextResponse.json({ error: "Failed to remove shared course" }, { status: 500 });
  }
}

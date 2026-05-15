import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { key, name } = await request.json();
    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('api_keys')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      await supabase
        .from('api_keys')
        .update({ key, name: name || "default" })
        .eq('id', existing.id);
      return NextResponse.json({ success: true });
    }

    await supabase.from('api_keys').insert({
      id: crypto.randomUUID(),
      key,
      name: name || "default",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api-keys] Error:", error);
    return NextResponse.json({ error: "Failed to save key" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data: apiKey } = await supabase
      .from('api_keys')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(1)
      .single();

    if (!apiKey) {
      return NextResponse.json({ hasKey: false });
    }
    const maskedKey = apiKey.key.slice(0, 6) + "..." + apiKey.key.slice(-4);
    return NextResponse.json({ hasKey: true, name: apiKey.name, keyPreview: maskedKey });
  } catch {
    return NextResponse.json({ hasKey: false });
  }
}

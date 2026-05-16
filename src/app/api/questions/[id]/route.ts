import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth";

/** Admin update. Body: { adminToken, prompt?, category?, archived? } */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    adminToken?: string;
    prompt?: string;
    category?: string | null;
    archived?: boolean;
  };
  if (!isAdmin(body.adminToken)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.prompt === "string") {
    const p = body.prompt.trim();
    if (!p) {
      return NextResponse.json(
        { error: "Prompt no puede ser vacío" },
        { status: 400 }
      );
    }
    update.prompt = p;
  }
  if (body.category !== undefined) {
    const c =
      typeof body.category === "string"
        ? body.category.trim().slice(0, 40) || null
        : null;
    update.category = c;
  }
  if (typeof body.archived === "boolean") {
    update.archived = body.archived;
  }
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("questions")
    .update(update)
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Admin delete (hard). Body: { adminToken } */
export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    adminToken?: string;
  };
  if (!isAdmin(body.adminToken)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

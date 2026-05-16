import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireHost } from "@/lib/auth";

/** Award a prize to a player. Body: { hostToken, recipientId, label }. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    hostToken?: string;
    recipientId?: string;
    label?: string;
  };
  const label = (body.label ?? "").trim().slice(0, 80);
  if (!body.recipientId || !label) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const game = await requireHost(supabase, id, body.hostToken);
  if (!game) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await supabase.from("prizes").insert({
    game_id: id,
    recipient_id: body.recipientId,
    label,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Remove a prize. Body: { hostToken, prizeId }. */
export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    hostToken?: string;
    prizeId?: string;
  };
  if (!body.prizeId) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const game = await requireHost(supabase, id, body.hostToken);
  if (!game) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await supabase
    .from("prizes")
    .delete()
    .eq("id", body.prizeId)
    .eq("game_id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

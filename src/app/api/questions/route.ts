import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth";

/** Public read of the question bank. */
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ questions: data });
}

/** Admin create. Body: { adminToken, prompt, category? } */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    adminToken?: string;
    prompt?: string;
    category?: string;
  };
  if (!isAdmin(body.adminToken)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt requerido" }, { status: 400 });
  }
  const category = (body.category ?? "").trim().slice(0, 40) || null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("questions")
    .insert({ prompt, category })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ question: data });
}

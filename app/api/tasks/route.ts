import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    notes?: string;
    due_at?: string;
    priority?: number;
    area?: string;
  };

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "La tarea necesita un titulo." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title,
      notes: body.notes ?? null,
      due_at: body.due_at ?? null,
      priority: body.priority ?? 2,
      area: body.area ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const supabase = await createClient();

  // Quita la cuenta y los eventos que venian de ella; las tareas locales se quedan.
  await supabase.from("events").delete().eq("user_id", user.id).eq("source", "google");
  const { error } = await supabase.from("google_accounts").delete().eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createAdminClient, requireStyrelse } from "@/lib/supabase/admin";
import type { ProfilRoll } from "@/lib/supabase/profile";

function felsvar(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : "Okänt fel.";
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireStyrelse();
  if (!caller) return NextResponse.json({ error: "Kräver rollen styrelse." }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const roll = body.roll as ProfilRoll;

    if (!["styrelse", "brandskyddsansvarig", "medlem", "entreprenör"].includes(roll)) {
      return NextResponse.json({ error: "Ogiltig roll." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("profiler").update({ roll }).eq("id", id);

    if (error) return felsvar(error);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return felsvar(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireStyrelse();
  if (!caller) return NextResponse.json({ error: "Kräver rollen styrelse." }, { status: 403 });

  try {
    const { id } = await params;

    if (id === caller.id) {
      return NextResponse.json({ error: "Du kan inte ta bort dig själv." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);

    if (error) return felsvar(error);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return felsvar(err);
  }
}

import { NextResponse } from "next/server";
import { createAdminClient, requireStyrelse } from "@/lib/supabase/admin";
import type { ProfilRoll } from "@/lib/supabase/profile";

function felsvar(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : "Okänt fel.";
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const caller = await requireStyrelse();
  if (!caller) return NextResponse.json({ error: "Kräver rollen styrelse." }, { status: 403 });

  try {
    const admin = createAdminClient();

    const [{ data: profiler, error: profilerError }, { data: authUsers, error: authError }] = await Promise.all([
      admin.from("profiler").select("id, namn, roll"),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    if (profilerError) return felsvar(profilerError);
    if (authError) return felsvar(authError);

    const users = (profiler ?? []).map((p) => {
      const authUser = authUsers.users.find((u) => u.id === p.id);
      return {
        id: p.id,
        namn: p.namn,
        roll: p.roll,
        epost: authUser?.email ?? "okänd",
        senastInloggad: authUser?.last_sign_in_at ?? null,
      };
    });

    return NextResponse.json({ users });
  } catch (err) {
    return felsvar(err);
  }
}

export async function POST(request: Request) {
  const caller = await requireStyrelse();
  if (!caller) return NextResponse.json({ error: "Kräver rollen styrelse." }, { status: 403 });

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const namn = typeof body.namn === "string" ? body.namn.trim() : "";
    const roll = body.roll as ProfilRoll;

    if (!email || !namn) {
      return NextResponse.json({ error: "E-post och namn krävs." }, { status: 400 });
    }
    if (!["styrelse", "brandskyddsansvarig", "medlem", "entreprenör"].includes(roll)) {
      return NextResponse.json({ error: "Ogiltig roll." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited.user) {
      return felsvar(inviteError ?? new Error("Kunde inte skicka inbjudan."));
    }

    const { error: profilError } = await admin.from("profiler").insert({
      id: invited.user.id,
      namn,
      roll,
    });

    if (profilError) {
      return NextResponse.json(
        { error: `Inbjudan skickad, men profilen kunde inte skapas: ${profilError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: { id: invited.user.id, namn, roll, epost: email, senastInloggad: null },
    });
  } catch (err) {
    return felsvar(err);
  }
}

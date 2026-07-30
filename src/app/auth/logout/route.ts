import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 (inte NextResponse.redirect:s default 307) krävs här: 307 bevarar
  // requestens metod, så webbläsaren skulle skicka om denna POST mot
  // /login — som bara är en statisk sida utan POST-stöd. 303 See Other
  // tvingar uppföljningen till GET, oavsett ursprungsmetod.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}

import { NextRequest, NextResponse } from "next/server";

const PASSWORD = "AVQG9hPQ";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== PASSWORD) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("tf_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // 30 jours
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("tf_auth", "", { maxAge: 0, path: "/" });
  return res;
}

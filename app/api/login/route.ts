import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerLogin } from "@/lib/cassaincloud";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req: NextRequest) {
  let body: { cardNumber?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const cardNumber = (body.cardNumber || "").trim();
  const phone = (body.phone || "").trim();

  if (!cardNumber || !phone) {
    return NextResponse.json(
      { error: "Numero tessera e telefono sono obbligatori." },
      { status: 400 }
    );
  }

  try {
    const result = await verifyCustomerLogin(cardNumber, phone);
    if (!result) {
      return NextResponse.json(
        { error: "Numero tessera o telefono non corretti." },
        { status: 401 }
      );
    }

    const token = createSessionToken(result);
    const res = NextResponse.json({ ok: true, name: result.name });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (err) {
    console.error("Errore login fidelity:", err);
    return NextResponse.json(
      { error: "Servizio momentaneamente non disponibile. Riprova più tardi." },
      { status: 502 }
    );
  }
}

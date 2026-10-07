import { NextRequest, NextResponse } from "next/server";
import { debugPrepaidTransactions } from "@/lib/cassaincloud";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

// Route diagnostica temporanea, protetta dalla sessione (serve essere
// loggati). Da rimuovere una volta risolto il problema sui movimenti.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  }

  try {
    const results = await debugPrepaidTransactions(session.idCustomer);
    return NextResponse.json({ idCustomer: session.idCustomer, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

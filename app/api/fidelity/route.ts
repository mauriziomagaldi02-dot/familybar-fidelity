import { NextRequest, NextResponse } from "next/server";
import { getPrepaidAccounts, getPrepaidTransactions, describeTransactionType } from "@/lib/cassaincloud";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  }

  try {
    const [accounts, rawTransactions] = await Promise.all([
      getPrepaidAccounts(session.idCustomer),
      getPrepaidTransactions(session.idCustomer, 20),
    ]);

    const totalBalance = accounts.reduce((sum, a) => sum + (a.amount || 0), 0);

    const transactions = rawTransactions.map((tx) => ({
      id: String(tx.id),
      date: tx.date,
      description: describeTransactionType(tx.fidelityPrepaidTransactionType),
      amount: tx.amount,
    }));

    return NextResponse.json({
      name: session.name,
      balance: totalBalance,
      transactions,
    });
  } catch (err) {
    console.error("Errore lettura fidelity:", err);
    return NextResponse.json(
      { error: "Impossibile recuperare i dati in questo momento." },
      { status: 502 }
    );
  }
}

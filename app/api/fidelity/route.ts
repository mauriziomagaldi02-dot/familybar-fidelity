import { NextRequest, NextResponse } from "next/server";
import { getPrepaidAccounts, getPrepaidTransactions, describeTransactionType } from "@/lib/cassaincloud";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ error: "Sessione scaduta." }, { status: 401 });
  }

  const [accountsResult, transactionsResult] = await Promise.allSettled([
    getPrepaidAccounts(session.idCustomer),
    getPrepaidTransactions(session.idFidelityCard, 20),
  ]);

  if (accountsResult.status === "rejected") {
    console.error("Errore lettura saldo (fidelityprepaidaccounts):", accountsResult.reason);
  }
  if (transactionsResult.status === "rejected") {
    console.error("Errore lettura movimenti (fidelityprepaidtransactions):", transactionsResult.reason);
  }

  if (accountsResult.status === "rejected") {
    return NextResponse.json(
      { error: "Impossibile recuperare il saldo in questo momento." },
      { status: 502 }
    );
  }

  const totalBalance = accountsResult.value.reduce((sum, a) => sum + (a.amount || 0), 0);

  // Se i movimenti falliscono, mostriamo comunque il saldo (che è la cosa
  // più importante) con una lista movimenti vuota, invece di bloccare tutto.
  const rawTransactions = transactionsResult.status === "fulfilled" ? transactionsResult.value : [];

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
    transactionsUnavailable: transactionsResult.status === "rejected",
  });
}

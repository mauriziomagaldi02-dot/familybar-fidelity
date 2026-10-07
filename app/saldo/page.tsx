"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  description?: string;
}

interface FidelityData {
  name: string;
  balance: number;
  transactions: Transaction[];
  transactionsUnavailable?: boolean;
}

const REFRESH_MS = 30_000; // aggiornamento ogni 30s: reale abbastanza per un saldo fidelity senza sforare i limiti di chiamata dell'API

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

export default function SaldoPage() {
  const router = useRouter();
  const [data, setData] = useState<FidelityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fidelity", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Errore nel caricamento dei dati.");
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError("Connessione assente. I dati mostrati potrebbero non essere aggiornati.");
    } finally {
      setInitialLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
  }

  if (initialLoading) {
    return <div className="spinner-page">Caricamento...</div>;
  }

  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          <div className="brand-mark">FB</div>
          <div className="brand-name">Family Bar</div>
        </div>

        {error && <div className="error">{error}</div>}

        {data && (
          <>
            <div className="greeting">Ciao {data.name}</div>

            <div className="balance-wrap">
              <div className="balance-label">Saldo disponibile</div>
              <div className="balance-amount">{formatCurrency(data.balance)}</div>
            </div>

            <div className="live-label">
              <span className="live-dot" />
              Aggiornato automaticamente
            </div>

            <div className="section-title">Ultimi movimenti</div>
            {data.transactionsUnavailable ? (
              <div className="empty-state">Movimenti non disponibili al momento.</div>
            ) : data.transactions.length === 0 ? (
              <div className="empty-state">Nessun movimento recente.</div>
            ) : (
              <ul className="tx-list">
                {data.transactions.map((tx) => (
                  <li key={tx.id} className="tx-row">
                    <div>
                      <div className="tx-desc">{tx.description || "Movimento"}</div>
                      <div className="tx-date">{formatDate(tx.date)}</div>
                    </div>
                    <div className={`tx-amount ${tx.amount >= 0 ? "positive" : "negative"}`}>
                      {tx.amount >= 0 ? "+" : ""}
                      {formatCurrency(tx.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <button className="logout-link" onClick={handleLogout}>
              Esci
            </button>
          </>
        )}
      </div>
    </div>
  );
}

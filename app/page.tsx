"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [cardNumber, setCardNumber] = useState("");
  const [surname, setSurname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardNumber, surname }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Accesso non riuscito.");
        return;
      }

      router.push("/saldo");
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/familybar-logo.png" alt="Family Bar" className="brand-logo" />
        </div>

        <h1>La tua Fidelity Card</h1>
        <p className="subtitle">
          Inserisci il numero della tua tessera e il tuo cognome per vedere il
          saldo e i movimenti.
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="cardNumber">Numero tessera</label>
          <input
            id="cardNumber"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="Es. 000123456 o ABC123"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            required
          />

          <label htmlFor="surname">Cognome</label>
          <input
            id="surname"
            type="text"
            autoComplete="family-name"
            placeholder="Es. Rossi"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Verifica in corso..." : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}

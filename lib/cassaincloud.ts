/**
 * Client per le API di Cassa in Cloud (TeamSystem).
 *
 * Documentazione ufficiale: https://api-doc.cassanova.com/
 * Richiede un piano Enterprise (Retail o Risto) e una API key generata da
 * Impostazioni Account > API sul portale Cassa in Cloud.
 *
 * Endpoint e nomi dei campi confermati direttamente dalla documentazione
 * (sezioni FidelityCard, FidelityPrepaidAccount, FidelityPrepaidTransaction,
 * Customer) il 2026-10-07.
 *
 * Unico punto ancora da confermare: i valori possibili dell'enum
 * `FidelityPrepaidTransactionType`, usati in `describeTransactionType()`
 * qui sotto per etichettare i movimenti (es. ricarica vs pagamento) e per
 * decidere il segno (+/-) da mostrare. Se in produzione vedi tipi non
 * gestiti, aggiorna quella funzione: nel frattempo il tipo grezzo viene
 * mostrato così com'è e il segno è sempre positivo (prudente, non mostra
 * mai un movimento come "uscita" per errore).
 */

const HOSTNAME = process.env.CASSAINCLOUD_HOSTNAME || "https://api.cassanova.com";
const API_KEY = process.env.CASSAINCLOUD_API_KEY;

const ENDPOINTS = {
  token: "/apikey/token",
  customers: "/customers",
  fidelityCards: "/fidelitycards",
  fidelityPrepaidAccounts: "/fidelityprepaidaccounts",
  fidelityPrepaidTransactions: "/fidelityprepaidtransactions",
};

interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      "CASSAINCLOUD_API_KEY non impostata. Configurala nelle variabili d'ambiente."
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 30_000 > now) {
    return cachedToken.accessToken;
  }

  const res = await fetch(`${HOSTNAME}${ENDPOINTS.token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "*",
    },
    body: JSON.stringify({ apiKey: API_KEY }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Impossibile ottenere il token Cassa in Cloud (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

type QueryValue = string | number | undefined | Array<string | number>;

async function apiGet<T>(path: string, params: Record<string, QueryValue>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${HOSTNAME}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      // I parametri di tipo List (es. "code", "ids") si passano ripetendo
      // la stessa chiave per ogni valore: code=A&code=B
      for (const v of value) url.searchParams.append(key, String(v));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Version": "1.0.0",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      // ignora, lasciamo bodyText vuoto
    }
    throw new Error(
      `Chiamata Cassa in Cloud fallita: ${path} (HTTP ${res.status}) - URL: ${url.toString()} - Risposta: ${bodyText.slice(0, 500)}`
    );
  }

  return (await res.json()) as T;
}

export interface Customer {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
}

export interface FidelityCard {
  id: number; // Long lato Cassa in Cloud
  lastUpdate?: string;
  idSalesPoint?: number;
  code: string; // numero tessera fisico - CONFERMATO
  activationDate?: string;
  idFidelityCircuit?: number;
  idCustomer?: string; // CONFERMATO: String, stesso id del Customer
}

export interface FidelityPrepaidAccount {
  id: number;
  idCustomer: string;
  idSalesPoint?: number;
  amount: number; // CONFERMATO: "the remaining amount" = saldo residuo
  lastUpdate?: string;
}

export interface FidelityPrepaidTransaction {
  id: number;
  idFidelityCard?: number;
  idSalesPoint?: number;
  idCustomer: string;
  date: string; // CONFERMATO: Timestamp
  fidelityPrepaidTransactionType: string; // enum - valori esatti da confermare
  amount: number; // CONFERMATO: BigDecimal, "the amount to add"
  idAppCustomerDevice?: number;
}

/**
 * Etichetta leggibile per un tipo di movimento prepagato.
 * Valori confermati dall'enum FidelityPrepaidTransactionType (doc
 * ufficiale, 2026-10-07): RELOAD, SALE, CORRECTION, INITIAL_AMOUNT.
 *
 * Nota sul segno: l'API non specifica esplicitamente se "amount" arriva
 * già firmato (negativo per un pagamento) o come valore assoluto. Per
 * prudenza non forziamo un segno qui: viene mostrato il valore esatto
 * restituito da Cassa in Cloud, con +/- in base al suo segno reale. Se in
 * produzione un SALE arriva con amount positivo (quindi il saldo scende ma
 * il movimento appare "+"), fammi sapere e aggiungo la correzione qui.
 */
export function describeTransactionType(type: string): string {
  const labels: Record<string, string> = {
    RELOAD: "Ricarica",
    SALE: "Pagamento",
    CORRECTION: "Rettifica",
    INITIAL_AMOUNT: "Saldo iniziale",
  };
  return labels[type] ?? type;
}

/**
 * Cerca la fidelity card per numero tessera (campo "code").
 */
export async function findFidelityCardByNumber(cardNumber: string): Promise<FidelityCard | null> {
  const data = await apiGet<{ fidelityCards: FidelityCard[]; totalCount: number }>(
    ENDPOINTS.fidelityCards,
    { start: 0, limit: 1, code: [cardNumber] }
  );
  return data.fidelityCards?.[0] ?? null;
}

export async function getCustomer(idCustomer: string): Promise<Customer> {
  const data = await apiGet<{ customer: Customer }>(`${ENDPOINTS.customers}/${idCustomer}`, {});
  return data.customer;
}

export async function getPrepaidAccounts(idCustomer: string): Promise<FidelityPrepaidAccount[]> {
  const data = await apiGet<{ fidelityPrepaidAccount: FidelityPrepaidAccount[]; totalCount: number }>(
    ENDPOINTS.fidelityPrepaidAccounts,
    { start: 0, limit: 50, idCustomer }
  );
  return data.fidelityPrepaidAccount ?? [];
}

/**
 * NOTA: il filtro "idCustomer" su questo endpoint causa un errore 500
 * lato Cassa in Cloud (bug confermato diagnosticamente il 2026-10-07:
 * la stessa richiesta senza idCustomer funziona, con idCustomer fallisce
 * sempre, indipendentemente da sort/limit). Si usa quindi "idFidelityCard"
 * come filtro al suo posto, che è documentato per lo stesso endpoint e
 * funziona correttamente.
 */
export async function getPrepaidTransactions(
  idFidelityCard: number,
  limit = 20
): Promise<FidelityPrepaidTransaction[]> {
  const data = await apiGet<{
    fidelityPointsTransaction: FidelityPrepaidTransaction[];
    totalCount: number;
  }>(ENDPOINTS.fidelityPrepaidTransactions, {
    start: 0,
    limit,
    // va passato come array JSON (es. "[123]"), non come chiave ripetuta:
    // l'API risponde altrimenti con HTTP 400 "error.expected.jsarray".
    idFidelityCard: JSON.stringify([idFidelityCard]),
  });
  return [...(data.fidelityPointsTransaction ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // rimuove accenti (es. "è" -> "e")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

/**
 * Flusso completo di login cliente: trova la card, verifica il cognome,
 * ritorna i dati identificativi del cliente se tutto corrisponde.
 *
 * Su Cassa in Cloud il Customer ha un unico campo "name" (nome e cognome
 * insieme, es. "Mario Rossi" o "Rossi Mario"), senza un campo separato per
 * il cognome. Per questo il controllo verifica che il cognome inserito
 * dal cliente compaia come parola intera all'interno del campo "name"
 * (confronto case-insensitive, accenti ignorati).
 */
export async function verifyCustomerLogin(
  cardNumber: string,
  surname: string
): Promise<{ idCustomer: string; idFidelityCard: number; name: string } | null> {
  const card = await findFidelityCardByNumber(cardNumber.trim());
  if (!card || !card.idCustomer) return null;

  const customer = await getCustomer(card.idCustomer);
  const normalizedSurname = normalizeName(surname);
  const customerNameWords = normalizeName(customer.name || "").split(/\s+/).filter(Boolean);

  if (!normalizedSurname || !customerNameWords.includes(normalizedSurname)) {
    return null;
  }

  return { idCustomer: customer.id, idFidelityCard: card.id, name: customer.name };
}

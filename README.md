# Fidelity Card – Family Bar

Webapp per i clienti Family Bar: inserendo numero tessera (numerico o
alfanumerico) e cognome, il cliente vede il saldo della propria fidelity
card (Cassa in Cloud), aggiornato automaticamente ogni 30 secondi, i
movimenti recenti del conto prepagato (ricariche/utilizzi, paginati 10 alla
volta) e un codice a barre (CODE128) da mostrare in cassa.

## Come funziona

1. Il cliente apre il sito, inserisce **numero tessera** + **cognome**.
2. Il server cerca la card su Cassa in Cloud (`GET /fidelitycards?code=...`),
   recupera il cliente collegato e verifica che il cognome inserito compaia
   come parola nel campo `name` del cliente (Cassa in Cloud non ha un campo
   cognome separato, solo `name` con nome e cognome insieme).
3. Se corrisponde, crea una sessione (cookie firmato, HttpOnly).
4. La pagina `/saldo` interroga ogni 30s l'endpoint `/api/fidelity`, che
   chiama Cassa in Cloud per saldo (`fidelityprepaidaccounts`) e movimenti
   (`fidelityprepaidtransactions`).

Nessun dato del cliente viene salvato in un database: ogni richiesta legge
in tempo reale da Cassa in Cloud.

## Stato: endpoint ed entità confermati

Tutti gli endpoint e i nomi dei campi usati in `lib/cassaincloud.ts` sono
stati confermati direttamente sulla documentazione ufficiale
(https://api-doc.cassanova.com/) il 2026-10-07:

- `GET /fidelitycards?code=<numero tessera>` → trova la card, dà `idCustomer`.
- `GET /customers/:id` → dati cliente (nome, telefono) per il login.
- `GET /fidelityprepaidaccounts?idCustomer=<id>` → saldo (campo `amount`).
- `GET /fidelityprepaidtransactions?idCustomer=<id>` → movimenti (`date`,
  `amount`, `fidelityPrepaidTransactionType`).

## Tipi di movimento

L'enum `FidelityPrepaidTransactionType` (confermato dalla documentazione,
2026-10-07) ha 4 valori, tradotti in `describeTransactionType()` in
`lib/cassaincloud.ts`:

| Valore API       | Etichetta mostrata |
| ---------------- | ------------------ |
| `RELOAD`         | Ricarica           |
| `SALE`           | Pagamento           |
| `CORRECTION`     | Rettifica           |
| `INITIAL_AMOUNT` | Saldo iniziale      |

**Nota sul segno**: la documentazione non specifica se il campo `amount`
arriva già "firmato" (negativo per un pagamento) o come valore assoluto.
Per prudenza, l'app mostra il segno esattamente come lo restituisce Cassa
in Cloud, senza forzarlo. **Da verificare al primo test reale**: apri la
pagina `/saldo` con un cliente che ha sia ricariche che pagamenti/utilizzi
nello storico e controlla che i pagamenti appaiano con il segno "−" (rosso)
e le ricariche con "+" (verde). Se un `SALE` arrivasse con importo positivo
mostrando erroneamente un "+", dimmelo e aggiungo la correzione del segno
in base al tipo.

## Verifica facoltativa: saldi per punto vendita

Se un cliente può avere più saldi prepagati su punti vendita diversi
(campo `idSalesPoint` su `FidelityPrepaidAccount`), al momento il saldo
mostrato è la **somma** di tutti. Se preferisci mostrarli distinti per
punto vendita, fammi sapere.

## Setup

```bash
npm install
cp .env.example .env.local
```

Compila `.env.local`:

```
CASSAINCLOUD_HOSTNAME=https://api.cassanova.com
CASSAINCLOUD_API_KEY=<la tua api key>
SESSION_SECRET=<stringa lunga e casuale, es. genera con: openssl rand -hex 32>
```

```bash
npm run dev
```

## Deploy su Vercel

1. Crea un nuovo repository (es. `familybar-fidelity`) e carica questo
   progetto.
2. Collega il repo su vercel.com → New Project.
3. In Vercel → Settings → Environment Variables, imposta le stesse
   variabili di `.env.local`.
4. Deploy.

## Struttura

```
app/
  page.tsx              -> form di login (tessera + cognome)
  saldo/page.tsx         -> saldo + movimenti, si aggiorna da solo
  api/login/route.ts     -> verifica cliente, crea sessione
  api/fidelity/route.ts  -> ritorna saldo/movimenti della sessione
  api/logout/route.ts    -> cancella la sessione
lib/
  cassaincloud.ts        -> client per le API Cassa in Cloud
  session.ts             -> cookie di sessione firmato (HMAC), senza librerie esterne
```

## Note su privacy e sicurezza

- La sessione dura 12 ore ed è in un cookie HttpOnly (non leggibile da
  JavaScript lato client).
- Il cognome viene confrontato in modo case-insensitive e ignorando gli
  accenti, cercandolo come parola intera nel campo `name` del cliente su
  Cassa in Cloud (che contiene nome e cognome insieme, es. "Mario Rossi").
  Se un cliente non riesce ad accedere, il problema è quasi sempre che il
  campo `name` sulla sua scheda cliente è scritto in modo diverso da come
  si aspetta (es. un solo nome senza cognome, un soprannome, un refuso).
- Le API di Cassa in Cloud hanno un limite di 360 chiamate ogni 10 minuti
  **per singola API**: con l'aggiornamento a 30s e 2 chiamate per refresh
  (saldo, movimenti) un singolo cliente che tiene la pagina aperta usa
  ~4 chiamate/minuto. Con più clienti connessi contemporaneamente, valuta
  di allungare l'intervallo di refresh in `app/saldo/page.tsx`
  (`REFRESH_MS`).

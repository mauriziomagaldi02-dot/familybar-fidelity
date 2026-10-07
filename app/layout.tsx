import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La mia Fidelity Card",
  description: "Consulta il saldo e i movimenti della tua fidelity card",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}

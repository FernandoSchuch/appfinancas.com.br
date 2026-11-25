import Link from "next/link";

const TELAS = [
  {
    href: "/importar",
    titulo: "Importar CSV",
    descricao:
      "Importa o extrato ou a fatura de uma conta e classifica os movimentos",
  },
  {
    href: "/cadastros",
    titulo: "Cadastros",
    descricao: "Contas bancárias, origens e responsáveis",
  },
  {
    href: "/lancamentos",
    titulo: "Lançamentos manuais",
    descricao: "Previsões e movimentos manuais, como ajustes de saldo",
  },
  {
    href: "/relatorios",
    titulo: "Relatórios",
    descricao: "Gráficos de créditos e débitos por mês",
  },
];

export default function Menu() {
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>App financeiro</h1>
      <nav>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            display: "grid",
            gap: 12,
            maxWidth: 480,
          }}
        >
          {TELAS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                style={{
                  display: "block",
                  padding: 16,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <strong>{t.titulo}</strong>
                <br />
                <span style={{ fontSize: 14, color: "#555" }}>
                  {t.descricao}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}

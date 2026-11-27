import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const moeda = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatarMes = (mes) => `${mes.slice(5)}/${mes.slice(0, 4)}`;

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const OPCOES_MESES = [3, 6, 12, 24];

export default function Relatorios() {
  const [montado, setMontado] = useState(false);
  const [contas, setContas] = useState([]);
  const [contasSel, setContasSel] = useState([]);
  const [meses, setMeses] = useState(6);
  const [considerarPrevisoes, setConsiderarPrevisoes] = useState(true);
  const [somenteQueConstam, setSomenteQueConstam] = useState(true);
  const [dados, setDados] = useState([]);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    setMontado(true);
    fetch("/api/v1/listas", { cache: "no-store" })
      .then((r) => r.json())
      .then((listas) => {
        setContas(listas.contas);
        setContasSel(listas.contas.map((c) => String(c.id)));
      })
      .catch(() => setErro("Erro ao carregar as contas"));
  }, []);

  const chaveContas = contasSel.join(",");

  useEffect(() => {
    if (chaveContas === "") {
      setDados([]);
      return;
    }
    let cancelado = false;
    setErro(null);

    const params = new URLSearchParams({
      meses: String(meses),
      ate: mesAtual(),
      contas: chaveContas,
      filtrar: somenteQueConstam ? "1" : "0",
    });

    fetch(`/api/v1/relatorios/resumo-mensal?${params}`, { cache: "no-store" })
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok)
          throw new Error(corpo.error || "Erro ao carregar o relatório");
        return corpo;
      })
      .then((linhas) => {
        if (!cancelado) setDados(linhas);
      })
      .catch((e) => {
        if (!cancelado) setErro(e.message);
      });

    return () => {
      cancelado = true;
    };
  }, [meses, chaveContas, somenteQueConstam]);

  function alternarConta(id) {
    setContasSel((atuais) =>
      atuais.includes(id) ? atuais.filter((c) => c !== id) : [...atuais, id],
    );
  }

  // soma as previsões apenas quando "Considerar previsões" está marcado
  const serie = dados.map((d) => {
    const creditos =
      d.creditos + (considerarPrevisoes ? d.creditosPrevistos : 0);
    const debitos = d.debitos + (considerarPrevisoes ? d.debitosPrevistos : 0);
    const resultado = Math.round((creditos - debitos) * 100) / 100;
    return {
      mes: d.mes,
      rotulo: formatarMes(d.mes),
      creditos,
      debitos,
      resultado,
    };
  });

  const situacao = (resultado) => {
    if (resultado > 0) {
      return { texto: "Créditos maiores", fundo: "var(--fundo-ok)", cor: "var(--ok)" };
    }
    if (resultado < 0) {
      return { texto: "Débitos maiores", fundo: "var(--fundo-erro)", cor: "var(--erro)" };
    }
    return { texto: "Empate", fundo: "var(--fundo-neutro)", cor: "var(--texto-suave)" };
  };

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">← Voltar ao menu</Link>
      </p>
      <h1>Relatórios</h1>

      <div
        style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}
      >
        <label>
          Meses:{" "}
          <select
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
          >
            {OPCOES_MESES.map((m) => (
              <option key={m} value={m}>
                Últimos {m}
              </option>
            ))}
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={considerarPrevisoes}
            onChange={(e) => setConsiderarPrevisoes(e.target.checked)}
          />{" "}
          Considerar previsões
        </label>

        <label>
          <input
            type="checkbox"
            checked={somenteQueConstam}
            onChange={(e) => setSomenteQueConstam(e.target.checked)}
          />{" "}
          Somente origens que constam nos relatórios
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <strong>Contas:</strong>{" "}
        {contas.map((c) => (
          <label key={c.id} style={{ marginRight: 16 }}>
            <input
              type="checkbox"
              checked={contasSel.includes(String(c.id))}
              onChange={() => alternarConta(String(c.id))}
            />{" "}
            {c.descricao}
          </label>
        ))}
      </div>

      {erro && <p style={{ color: "var(--erro)" }}>{erro}</p>}

      <h2>Créditos x débitos por mês</h2>

      {montado && serie.length > 0 && (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rotulo" />
              <YAxis tickFormatter={(v) => v.toLocaleString("pt-BR")} />
              <Tooltip formatter={(v) => moeda(v)} />
              <Legend />
              <Bar dataKey="creditos" name="Créditos" fill="#2e7d32" />
              <Bar dataKey="debitos" name="Débitos" fill="#c62828" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {contasSel.length === 0 && <p>Selecione pelo menos uma conta.</p>}

      {serie.length > 0 && (
        <table
          cellPadding={8}
          style={{ borderCollapse: "collapse", marginTop: 16 }}
        >
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Mês</th>
              <th>Créditos</th>
              <th>Débitos</th>
              <th>Resultado</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {[...serie].reverse().map((s) => {
              const sit = situacao(s.resultado);
              return (
                <tr key={s.mes} style={{ borderTop: "1px solid var(--borda)" }}>
                  <td>{s.rotulo}</td>
                  <td style={{ textAlign: "right" }}>{moeda(s.creditos)}</td>
                  <td style={{ textAlign: "right" }}>{moeda(s.debitos)}</td>
                  <td
                    style={{
                      textAlign: "right",
                      background: sit.fundo,
                      color: sit.cor,
                      fontWeight: "bold",
                    }}
                  >
                    {moeda(s.resultado)}
                  </td>
                  <td style={{ background: sit.fundo, color: sit.cor }}>
                    {sit.texto}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}

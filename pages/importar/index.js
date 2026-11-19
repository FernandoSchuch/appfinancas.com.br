import { useEffect, useState } from "react";

const TITULOS_IGNORADOS = ["pagamento recebido"];

function dividirLinhaCsv(linha) {
  const campos = [];
  let atual = "";
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (entreAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        entreAspas = !entreAspas;
      }
    } else if (c === "," && !entreAspas) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((s) => s.trim());
}

function converterValor(texto) {
  const t = texto.replace(/\s/g, "");
  if (t === "") return NaN;
  const normalizado = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t;
  return Number(normalizado);
}

function lerCsv(texto) {
  const linhasTexto = texto.replace(/^\uFEFF/, "").split(/\r?\n/);
  const cabecalho = dividirLinhaCsv(linhasTexto[0] || "").map((c) =>
    c.toLowerCase(),
  );
  const iData = cabecalho.indexOf("date");
  const iTitulo = cabecalho.indexOf("title");
  const iValor = cabecalho.indexOf("amount");

  if (iData < 0 || iTitulo < 0 || iValor < 0) {
    return {
      linhas: [],
      erros: ["Cabeçalho esperado: date,title,amount"],
      ignoradas: [],
    };
  }

  const linhas = [];
  const erros = [];
  const ignoradas = [];
  for (let i = 1; i < linhasTexto.length; i++) {
    if (linhasTexto[i].trim() === "") continue;
    const campos = dividirLinhaCsv(linhasTexto[i]);
    const data = campos[iData] || "";
    const descricao = campos[iTitulo] || "";
    const valor = converterValor(campos[iValor] || "");
    const n = i + 1;

    if (TITULOS_IGNORADOS.includes(descricao.toLowerCase())) {
      ignoradas.push(`Linha ${n}: ${descricao} (${campos[iValor]})`);
      continue;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
      erros.push(`Linha ${n}: data inválida`);
    else if (!descricao) erros.push(`Linha ${n}: título vazio`);
    else if (!Number.isFinite(valor)) erros.push(`Linha ${n}: valor inválido`);
    else linhas.push({ data, descricao, valor, origem: "", responsavel: "" });
  }

  if (erros.length === 0 && linhas.length === 0) {
    erros.push("Arquivo sem transações");
  }
  return { linhas, erros, ignoradas };
}

const moeda = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const tipoDe = (valor, negativoCredito) =>
  valor < 0 === negativoCredito ? "C" : "D";

export default function Importar() {
  const [listas, setListas] = useState({
    contas: [],
    origens: [],
    responsaveis: [],
  });
  const [conta, setConta] = useState("");
  const [linhas, setLinhas] = useState([]);
  const [erros, setErros] = useState([]);
  const [ignoradas, setIgnoradas] = useState([]);
  const [mensagem, setMensagem] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch("/api/v1/listas")
      .then((r) => r.json())
      .then(setListas)
      .catch(() =>
        setMensagem({ tipo: "erro", texto: "Erro ao carregar as listas" }),
      );
  }, []);

  async function aoEscolherArquivo(event) {
    const arquivo = event.target.files[0];
    event.target.value = "";
    if (!arquivo) return;

    setMensagem(null);
    const resultado = lerCsv(await arquivo.text());
    setErros(resultado.erros);
    setIgnoradas(resultado.ignoradas);
    setLinhas(resultado.erros.length === 0 ? resultado.linhas : []);
  }

  function alterarLinha(indice, campo, valor) {
    const atualizada = { ...linhas[indice], [campo]: valor };
    const novas = linhas.map((l, i) => (i === indice ? atualizada : l));
    setLinhas(novas);

    // só pergunta quando a linha já tem origem e responsável
    if (atualizada.origem === "" || atualizada.responsavel === "") return;

    const chave = atualizada.descricao.toLowerCase();
    const mesmoNome = (l, i) =>
      i !== indice && l.descricao.toLowerCase() === chave;
    const quantidade = novas.filter(
      (l, i) => mesmoNome(l, i) && (l.origem === "" || l.responsavel === ""),
    ).length;
    if (quantidade === 0) return;

    // o setTimeout deixa a tela mostrar sua escolha antes de a pergunta aparecer
    setTimeout(() => {
      const nomeOrigem = listas.origens.find(
        (o) => String(o.id) === atualizada.origem,
      )?.descricao;
      const nomeResponsavel = listas.responsaveis.find(
        (r) => String(r.id) === atualizada.responsavel,
      )?.descricao;

      const frase =
        quantidade === 1
          ? "Existe 1 movimento com o mesmo nome ainda não classificado."
          : `Existem ${quantidade} movimentos com o mesmo nome ainda não classificados.`;

      const confirmou = window.confirm(
        `${frase}\nDeseja preenchê-los com a origem ${nomeOrigem} e o responsável ${nomeResponsavel}?\n(O que já estiver preenchido não será alterado.)`,
      );
      if (!confirmou) return;

      setLinhas((atuais) =>
        atuais.map((l, i) =>
          mesmoNome(l, i)
            ? {
                ...l,
                origem: l.origem === "" ? atualizada.origem : l.origem,
                responsavel:
                  l.responsavel === "" ? atualizada.responsavel : l.responsavel,
              }
            : l,
        ),
      );
    }, 0);
  }

  const tudoClassificado =
    linhas.length > 0 &&
    linhas.every((l) => l.origem !== "" && l.responsavel !== "");

  const contaSelecionada = listas.contas.find((c) => String(c.id) === conta);
  const negativoCredito = contaSelecionada
    ? contaSelecionada.negativoCredito
    : false;
  const somar = (tipo) =>
    linhas
      .filter((l) => tipoDe(l.valor, negativoCredito) === tipo)
      .reduce((soma, l) => soma + Math.abs(l.valor), 0);
  const totalDebitos = somar("D");
  const totalCreditos = somar("C");

  async function aplicar() {
    setEnviando(true);
    setMensagem(null);
    try {
      const resposta = await fetch("/api/v1/movimentos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conta: Number(conta),
          movimentos: linhas.map((l) => ({
            data: l.data,
            descricao: l.descricao,
            valor: l.valor,
            origem: Number(l.origem),
            responsavel: Number(l.responsavel),
          })),
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok)
        throw new Error(dados.error || "Erro ao gravar movimentos");
      setLinhas([]);
      setIgnoradas([]);
      setMensagem({
        tipo: "ok",
        texto: `${dados.inseridos} movimentos importados`,
      });
    } catch (erro) {
      setMensagem({ tipo: "erro", texto: erro.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Importar CSV</h1>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <label>
          Conta bancária:{" "}
          <select value={conta} onChange={(e) => setConta(e.target.value)}>
            <option value="">Selecione...</option>
            {listas.contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.descricao}
              </option>
            ))}
          </select>
        </label>

        <label>
          Arquivo:{" "}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={conta === ""}
            onChange={aoEscolherArquivo}
          />
        </label>
      </div>

      {mensagem && (
        <p style={{ color: mensagem.tipo === "ok" ? "green" : "crimson" }}>
          {mensagem.texto}
        </p>
      )}

      {erros.length > 0 && (
        <ul style={{ color: "crimson" }}>
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {ignoradas.length > 0 && (
        <div style={{ color: "#996600" }}>
          <p>Linhas ignoradas (não serão importadas):</p>
          <ul>
            {ignoradas.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      {linhas.length > 0 && (
        <>
          <p>
            {linhas.length} transações · Débitos {moeda(totalDebitos)} ·
            Créditos {moeda(totalCreditos)}
          </p>
          <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>#</th>
                <th>Data</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Origem</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} style={{ borderTop: "1px solid #ccc" }}>
                  <td>{i + 1}</td>
                  <td>{l.data}</td>
                  <td>{l.descricao}</td>
                  <td>{tipoDe(l.valor, negativoCredito)}</td>
                  <td style={{ textAlign: "right" }}>
                    {moeda(Math.abs(l.valor))}
                  </td>
                  <td>
                    <select
                      value={l.origem}
                      onChange={(e) =>
                        alterarLinha(i, "origem", e.target.value)
                      }
                    >
                      <option value="">Selecione...</option>
                      {listas.origens.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.descricao}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={l.responsavel}
                      onChange={(e) =>
                        alterarLinha(i, "responsavel", e.target.value)
                      }
                    >
                      <option value="">Selecione...</option>
                      {listas.responsaveis.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.descricao}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            style={{ marginTop: 16 }}
            disabled={!tudoClassificado || enviando}
            onClick={aplicar}
          >
            {enviando ? "Aplicando..." : "Aplicar movimentos"}
          </button>
        </>
      )}
    </main>
  );
}

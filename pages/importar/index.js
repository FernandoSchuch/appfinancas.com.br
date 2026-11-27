import { useEffect, useState } from "react";
import Link from "next/link";
import { decodificar, lerComFormato } from "infra/importacao.js";

// Pareia cada linha do arquivo com um movimento já gravado (mesma data,
// descrição e valor), na ordem, e copia origem e responsável do banco.
function aplicarExistentes(linhas, existentes) {
  const chaveDe = (data, descricao, valor) =>
    `${data}|${descricao}|${Math.abs(valor).toFixed(2)}`;

  const mapa = new Map();
  for (const e of existentes) {
    const chave = chaveDe(e.data, e.descricao, e.valor);
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave).push(e);
  }

  return linhas.map((l) => {
    const lista = mapa.get(chaveDe(l.data, l.descricao, l.valor));
    if (!lista || lista.length === 0) return l;
    const e = lista.shift();
    return {
      ...l,
      origem: String(e.origem),
      responsavel: String(e.responsavel),
    };
  });
}

// Um nome combina com o outro quando um contém o outro, sem diferenciar
// maiúsculas. O nome mais curto precisa ter pelo menos 3 caracteres.
function nomesCombinam(a, b) {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (Math.min(x.length, y.length) < 3) return false;
  return x.includes(y) || y.includes(x);
}

async function consultar(url) {
  const resposta = await fetch(url, { cache: "no-store" });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.error || "Erro ao consultar dados");
  return dados;
}

const moeda = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const tipoDe = (valor, negativoCredito) =>
  valor < 0 === negativoCredito ? "C" : "D";

const rotuloTipo = (tipo) => (tipo === "C" ? "Crédito" : "Débito");

const formatarMes = (mes) => `${mes.slice(5)}/${mes.slice(0, 4)}`;

export default function Importar() {
  const [listas, setListas] = useState({
    contas: [],
    origens: [],
    responsaveis: [],
  });
  const [formatos, setFormatos] = useState([]);
  const [conta, setConta] = useState("");
  const [formatoId, setFormatoId] = useState("");
  const [linhas, setLinhas] = useState([]);
  const [previsoes, setPrevisoes] = useState([]);
  const [dialogo, setDialogo] = useState(null);
  const [mes, setMes] = useState("");
  const [existentesTotal, setExistentesTotal] = useState(0);
  const [erros, setErros] = useState([]);
  const [ignoradas, setIgnoradas] = useState([]);
  const [mensagem, setMensagem] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([consultar("/api/v1/listas"), consultar("/api/v1/formatos")])
      .then(([dadosListas, dadosFormatos]) => {
        setListas(dadosListas);
        setFormatos(dadosFormatos);
      })
      .catch(() =>
        setMensagem({ tipo: "erro", texto: "Erro ao carregar as listas" }),
      );
  }, []);

  async function atualizarListas() {
    try {
      const [dadosListas, dadosFormatos] = await Promise.all([
        consultar("/api/v1/listas"),
        consultar("/api/v1/formatos"),
      ]);
      setListas(dadosListas);
      setFormatos(dadosFormatos);
      setMensagem({ tipo: "ok", texto: "Listas atualizadas" });
    } catch (erro) {
      setMensagem({ tipo: "erro", texto: erro.message });
    }
  }

  function limparImportacao() {
    setLinhas([]);
    setPrevisoes([]);
    setDialogo(null);
    setMes("");
    setExistentesTotal(0);
    setErros([]);
    setIgnoradas([]);
  }

  // Trocar a conta limpa a tabela: as sugestões, as previsões e o mês a ser
  // regravado pertencem à conta escolhida antes de carregar o arquivo.
  // O formato volta a ser o padrão da conta.
  function trocarConta(valor) {
    setConta(valor);
    setMensagem(null);
    limparImportacao();
    const escolhida = listas.contas.find((c) => String(c.id) === valor);
    setFormatoId(escolhida?.formato ? String(escolhida.formato) : "");
  }

  function trocarFormato(valor) {
    setFormatoId(valor);
    setMensagem(null);
    limparImportacao();
  }

  const contaSelecionada = listas.contas.find((c) => String(c.id) === conta);
  const negativoCredito = contaSelecionada
    ? contaSelecionada.negativoCredito
    : false;
  const formatoSelecionado = formatos.find((f) => String(f.id) === formatoId);

  async function aoEscolherArquivo(event) {
    const arquivo = event.target.files[0];
    event.target.value = "";
    if (!arquivo || !formatoSelecionado) return;

    setMensagem(null);
    limparImportacao();

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const { texto } = decodificar(bytes, formatoSelecionado.codificacao);
    const resultado = lerComFormato(texto, formatoSelecionado, {
      negativoCredito,
    });
    setErros(resultado.erros);
    setIgnoradas(resultado.ignoradas);
    if (resultado.erros.length > 0) return;

    try {
      const [dadosExistentes, listaPrevisoes] = await Promise.all([
        consultar(
          `/api/v1/movimentos/existentes?conta=${conta}&mes=${resultado.mes}`,
        ),
        consultar(
          `/api/v1/lancamentos?conta=${conta}&mes=${resultado.mes}&natureza=P`,
        ),
      ]);
      setLinhas(
        aplicarExistentes(resultado.linhas, dadosExistentes.movimentos),
      );
      setExistentesTotal(dadosExistentes.movimentos.length);
      setPrevisoes(listaPrevisoes);
      setMes(resultado.mes);
    } catch (erro) {
      setMensagem({ tipo: "erro", texto: erro.message });
    }
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

  // previsões já escolhidas por alguma linha não são oferecidas às outras
  const usadas = new Set(
    linhas.map((l) => l.previsao).filter((id) => id !== null),
  );
  const candidatasDe = (linha) =>
    previsoes.filter(
      (p) => !usadas.has(p.id) && nomesCombinam(linha.descricao, p.descricao),
    );

  function substituir(indice, previsao) {
    setLinhas((atuais) =>
      atuais.map((l, i) =>
        i === indice
          ? {
              ...l,
              previsao: previsao.id,
              origem: l.origem === "" ? String(previsao.origem) : l.origem,
              responsavel:
                l.responsavel === ""
                  ? String(previsao.responsavel)
                  : l.responsavel,
            }
          : l,
      ),
    );
    setDialogo(null);
  }

  function desfazerSubstituicao(indice) {
    const ok = window.confirm(
      "Desfazer a substituição? A previsão voltará a ficar disponível e não será apagada.\n(A origem e o responsável já preenchidos continuam como estão.)",
    );
    if (!ok) return;
    setLinhas((atuais) =>
      atuais.map((l, i) => (i === indice ? { ...l, previsao: null } : l)),
    );
  }

  const classificada = (l) => l.origem !== "" && l.responsavel !== "";
  const tudoClassificado = linhas.length > 0 && linhas.every(classificada);

  const somar = (tipo) =>
    linhas
      .filter((l) => tipoDe(l.valor, negativoCredito) === tipo)
      .reduce((soma, l) => soma + Math.abs(l.valor), 0);
  const totalDebitos = somar("D");
  const totalCreditos = somar("C");
  const totalArquivo = linhas.reduce((soma, l) => soma + l.valor, 0);

  const comAlerta = linhas.filter(
    (l) => l.previsao === null && candidatasDe(l).length > 0,
  ).length;
  const substituidas = linhas.filter((l) => l.previsao !== null).length;

  const nomeDe = (lista, id) => lista.find((i) => i.id === id)?.descricao ?? id;
  const linhaDialogo = dialogo !== null ? linhas[dialogo] : null;

  async function aplicar() {
    if (existentesTotal > 0) {
      const ok = window.confirm(
        `Este mês (${formatarMes(mes)}) já tem ${existentesTotal} movimentos nessa conta.\nEles serão apagados e substituídos por ${linhas.length}.\nContinuar?`,
      );
      if (!ok) return;
    }

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
            previsao: l.previsao,
          })),
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok)
        throw new Error(dados.error || "Erro ao gravar movimentos");
      limparImportacao();

      const extras = [];
      if (dados.apagados > 0) {
        extras.push(`${dados.apagados} anteriores do mês foram substituídos`);
      }
      if (dados.previsoes > 0) {
        extras.push(`${dados.previsoes} previsões concretizadas`);
      }
      const extra = extras.length > 0 ? ` (${extras.join("; ")})` : "";
      setMensagem({
        tipo: "ok",
        texto: `${dados.inseridos} movimentos importados${extra}`,
      });
    } catch (erro) {
      setMensagem({ tipo: "erro", texto: erro.message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">← Voltar ao menu</Link>
      </p>
      <h1>Importar CSV</h1>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <label>
          Conta bancária:{" "}
          <select value={conta} onChange={(e) => trocarConta(e.target.value)}>
            <option value="">Selecione...</option>
            {listas.contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.descricao}
              </option>
            ))}
          </select>
        </label>

        <label>
          Formato do arquivo:{" "}
          <select
            value={formatoId}
            disabled={conta === ""}
            onChange={(e) => trocarFormato(e.target.value)}
          >
            <option value="">Selecione...</option>
            {formatos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          Arquivo:{" "}
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            disabled={conta === "" || formatoId === ""}
            onChange={aoEscolherArquivo}
          />
        </label>

        <button onClick={atualizarListas}>Atualizar listas</button>
      </div>

      {conta !== "" && formatoId === "" && (
        <p style={{ color: "var(--alerta)" }}>
          Esta conta não tem formato padrão. Escolha o formato do arquivo ou
          associe um à conta em <Link href="/cadastros">Cadastros</Link>.
        </p>
      )}

      {mensagem && (
        <p
          style={{
            color: mensagem.tipo === "ok" ? "var(--ok)" : "var(--erro)",
          }}
        >
          {mensagem.texto}
        </p>
      )}

      {erros.length > 0 && (
        <>
          <ul style={{ color: "var(--erro)" }}>
            {erros.slice(0, 10).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {erros.length > 10 && (
              <li>... e mais {erros.length - 10} problemas</li>
            )}
          </ul>
          <p style={{ color: "var(--texto-suave)" }}>
            O arquivo não bate com o formato "{formatoSelecionado?.nome}".
            Escolha outro formato ou ajuste este em{" "}
            <Link href="/formatos">Formatos de importação</Link>.
          </p>
        </>
      )}

      {ignoradas.length > 0 && (
        <div style={{ color: "var(--alerta)" }}>
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
            Mês: {formatarMes(mes)} · {linhas.length} transações · Débitos{" "}
            {moeda(totalDebitos)} · Créditos {moeda(totalCreditos)}
          </p>

          <p>
            <strong>Total do arquivo: {moeda(totalArquivo)}</strong> (soma de
            todos os valores, como estão no CSV, sem as linhas ignoradas)
          </p>

          {existentesTotal > 0 && (
            <p style={{ color: "var(--alerta)" }}>
              Já existem {existentesTotal} movimentos dessa conta neste mês. Ao
              aplicar, eles serão apagados e substituídos pelos desta tabela.
            </p>
          )}

          {(comAlerta > 0 || substituidas > 0) && (
            <p style={{ color: "var(--alerta)" }}>
              {comAlerta > 0 &&
                `⚠️ ${comAlerta} linhas têm possível previsão correspondente (clique no ícone para decidir). `}
              {substituidas > 0 &&
                `✔ ${substituidas} previsões serão substituídas ao aplicar.`}
            </p>
          )}

          <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>#</th>
                <th>Data</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Previsão</th>
                <th>Origem</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr
                  key={i}
                  style={{
                    borderTop: "1px solid var(--borda)",
                    background: classificada(l)
                      ? "var(--fundo-ok)"
                      : "transparent",
                  }}
                >
                  <td>{i + 1}</td>
                  <td>{l.data}</td>
                  <td>{l.descricao}</td>
                  <td>{tipoDe(l.valor, negativoCredito)}</td>
                  <td style={{ textAlign: "right" }}>
                    {moeda(Math.abs(l.valor))}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {l.previsao !== null ? (
                      <button
                        title="Previsão substituída. Clique para desfazer"
                        onClick={() => desfazerSubstituicao(i)}
                      >
                        ✔
                      </button>
                    ) : candidatasDe(l).length > 0 ? (
                      <button
                        title="Previsão identificada. Clique para ver"
                        onClick={() => setDialogo(i)}
                      >
                        ⚠️
                      </button>
                    ) : null}
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

      {linhaDialogo && (
        <div
          onClick={() => setDialogo(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)",
              color: "var(--texto)",
              border: "1px solid var(--borda)",
              padding: 24,
              borderRadius: 8,
              maxWidth: 900,
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <h3>Previsão identificada</h3>
            <p>
              Foi identificada uma previsão que pode ser substituída por este
              movimento. Confira se ele é o movimento concretizado ou se é outro
              movimento.
            </p>
            <p>
              <strong>Movimento importado:</strong> {linhaDialogo.data} ·{" "}
              {linhaDialogo.descricao} ·{" "}
              {rotuloTipo(tipoDe(linhaDialogo.valor, negativoCredito))} ·{" "}
              {moeda(Math.abs(linhaDialogo.valor))}
            </p>

            <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Origem</th>
                  <th>Responsável</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {candidatasDe(linhaDialogo).map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderTop: "1px solid var(--borda)" }}
                  >
                    <td>{p.data}</td>
                    <td>{p.descricao}</td>
                    <td>{rotuloTipo(p.tipo)}</td>
                    <td style={{ textAlign: "right" }}>{moeda(p.valor)}</td>
                    <td>{nomeDe(listas.origens, p.origem)}</td>
                    <td>{nomeDe(listas.responsaveis, p.responsavel)}</td>
                    <td>
                      <button onClick={() => substituir(dialogo, p)}>
                        É este (substituir a previsão)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p>
              <button onClick={() => setDialogo(null)}>
                É outro movimento (fechar)
              </button>
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

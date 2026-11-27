import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FORMATOS_DATA,
  SEPARADORES,
  decodificar,
  detectarFormato,
  detectarSeparador,
  lerComFormato,
  lerLinhasCsv,
} from "infra/importacao.js";

const OPCOES_CODIFICACAO = [
  ["auto", "Automática (UTF-8 ou Windows-1252)"],
  ["utf-8", "UTF-8"],
  ["windows-1252", "Windows-1252 (ISO-8859-1)"],
];

const OPCOES_SEPARADOR = [
  ["auto", "Automático"],
  ["virgula", "Vírgula ( , )"],
  ["ponto_virgula", "Ponto e vírgula ( ; )"],
  ["tab", "Tabulação"],
  ["barra", "Barra vertical ( | )"],
];

const OPCOES_VALOR = [
  ["virgula", "1.234,56 (vírgula decimal)"],
  ["ponto", "1234.56 (ponto decimal)"],
];

const FORMULARIO_VAZIO = {
  id: null,
  nome: "",
  codificacao: "auto",
  separador: "auto",
  cabecalho: true,
  linhasPular: "0",
  colData: "",
  colDescricao: "",
  valorModo: "unico",
  colValor: "",
  colDebito: "",
  colCredito: "",
  formatoData: "dd/mm/aaaa",
  formatoValor: "virgula",
  ignorarTexto: "",
};

const ordenar = (lista) =>
  [...lista].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );

async function chamar(url, metodo, corpo) {
  const resposta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = resposta.status === 204 ? null : await resposta.json();
  if (!resposta.ok) throw new Error(dados?.error || "Erro na operação");
  return dados;
}

// do formato (API ou detecção) para os campos do formulário
function paraFormulario(formato, id) {
  return {
    id,
    nome: formato.nome ?? "",
    codificacao: formato.codificacao ?? "auto",
    separador: formato.separador ?? "auto",
    cabecalho: formato.cabecalho ?? true,
    linhasPular: String(formato.linhasPular ?? 0),
    colData: formato.colData ?? "",
    colDescricao: formato.colDescricao ?? "",
    valorModo: formato.valorModo ?? "unico",
    colValor: formato.colValor ?? "",
    colDebito: formato.colDebito ?? "",
    colCredito: formato.colCredito ?? "",
    formatoData: formato.formatoData ?? "dd/mm/aaaa",
    formatoValor: formato.formatoValor ?? "virgula",
    ignorarTexto: (formato.ignorar ?? []).join("\n"),
  };
}

function paraFormatoLeitura(form) {
  return {
    separador: form.separador,
    cabecalho: form.cabecalho,
    linhasPular: Number(form.linhasPular) || 0,
    colData: form.colData,
    colDescricao: form.colDescricao,
    valorModo: form.valorModo,
    colValor: form.colValor,
    colDebito: form.colDebito,
    colCredito: form.colCredito,
    formatoData: form.formatoData,
    formatoValor: form.formatoValor,
    ignorar: form.ignorarTexto
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

function paraCorpo(form) {
  return {
    ...paraFormatoLeitura(form),
    nome: form.nome,
    codificacao: form.codificacao,
  };
}

// colunas do arquivo de exemplo, para escolher em listas em vez de digitar
function calcularColunas(texto, form) {
  const nomeSeparador =
    form.separador === "auto" ? detectarSeparador(texto) : form.separador;
  const separador = SEPARADORES[nomeSeparador];
  if (!separador) return null;

  const linhas = lerLinhasCsv(texto, separador);
  let posicao = Number(form.linhasPular) || 0;
  while (posicao < linhas.length && linhas[posicao].every((c) => c === ""))
    posicao++;
  const primeira = linhas[posicao];
  if (!primeira) return null;

  if (form.cabecalho) {
    return primeira
      .filter((nome) => nome !== "")
      .map((nome) => ({ valor: nome, rotulo: nome }));
  }
  const largura = Math.max(
    ...linhas.slice(posicao, posicao + 30).map((l) => l.length),
  );
  return Array.from({ length: largura }, (_, i) => ({
    valor: String(i + 1),
    rotulo: `Coluna ${i + 1} (ex.: ${(primeira[i] ?? "").slice(0, 25)})`,
  }));
}

function SelecaoColuna({ valor, aoMudar, colunas }) {
  if (!colunas) {
    return (
      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        style={{ width: 160 }}
      />
    );
  }
  const existe = colunas.some((c) => c.valor === valor);
  return (
    <select value={valor} onChange={(e) => aoMudar(e.target.value)}>
      <option value="">Selecione...</option>
      {valor !== "" && !existe && (
        <option value={valor}>{valor} (não está no exemplo)</option>
      )}
      {colunas.map((c) => (
        <option key={c.valor} value={c.valor}>
          {c.rotulo}
        </option>
      ))}
    </select>
  );
}

function Campo({ rotulo, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 13, color: "#555" }}>{rotulo}</span>
      {children}
    </div>
  );
}

export default function Formatos() {
  const [formatos, setFormatos] = useState([]);
  const [editor, setEditor] = useState(null);
  const [amostra, setAmostra] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    chamar("/api/v1/formatos", "GET")
      .then(setFormatos)
      .catch((erro) => setMensagem({ tipo: "erro", texto: erro.message }));
  }, []);

  const decodificada = useMemo(
    () =>
      amostra && editor ? decodificar(amostra.bytes, editor.codificacao) : null,
    [amostra, editor],
  );

  const colunas = useMemo(
    () =>
      decodificada && editor
        ? calcularColunas(decodificada.texto, editor)
        : null,
    [decodificada, editor],
  );

  const previa = useMemo(
    () =>
      decodificada && editor
        ? lerComFormato(decodificada.texto, paraFormatoLeitura(editor))
        : null,
    [decodificada, editor],
  );

  async function executar(acao, textoOk) {
    setOcupado(true);
    setMensagem(null);
    try {
      await acao();
      setMensagem({ tipo: "ok", texto: textoOk });
    } catch (erro) {
      setMensagem({ tipo: "erro", texto: erro.message });
    } finally {
      setOcupado(false);
    }
  }

  function novo() {
    setMensagem(null);
    setAmostra(null);
    setEditor({ ...FORMULARIO_VAZIO });
  }

  function editar(formato) {
    setMensagem(null);
    setAmostra(null);
    setEditor(paraFormulario(formato, formato.id));
  }

  function cancelar() {
    setEditor(null);
    setAmostra(null);
  }

  function alterar(campo, valor) {
    setEditor((atual) => ({ ...atual, [campo]: valor }));
  }

  // com ou sem cabeçalho muda o jeito de indicar as colunas: nome ou número
  function alterarCabecalho(valor) {
    setEditor((atual) => ({
      ...atual,
      cabecalho: valor,
      colData: "",
      colDescricao: "",
      colValor: "",
      colDebito: "",
      colCredito: "",
    }));
  }

  async function aoEscolherAmostra(event) {
    const arquivo = event.target.files[0];
    event.target.value = "";
    if (!arquivo) return;

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const { texto } = decodificar(bytes, "auto");
    const deteccao = detectarFormato(texto);
    if (!deteccao) {
      setMensagem({ tipo: "erro", texto: "O arquivo está vazio" });
      return;
    }

    setAmostra({ nomeArquivo: arquivo.name, bytes });
    setEditor((atual) =>
      paraFormulario(
        { ...deteccao.formato, nome: atual?.nome ?? "" },
        atual?.id ?? null,
      ),
    );
    setMensagem(
      deteccao.avisos.length > 0
        ? {
            tipo: "erro",
            texto: `${deteccao.avisos.join(". ")}. Escolha manualmente.`,
          }
        : {
            tipo: "ok",
            texto:
              "Formato detectado. Confira a pré-visualização e ajuste o que precisar.",
          },
    );
  }

  function salvar() {
    executar(async () => {
      const corpo = paraCorpo(editor);
      const salvo = editor.id
        ? await chamar(`/api/v1/formatos/${editor.id}`, "PUT", corpo)
        : await chamar("/api/v1/formatos", "POST", corpo);
      setFormatos((atuais) =>
        ordenar([...atuais.filter((f) => f.id !== salvo.id), salvo]),
      );
      setEditor(null);
      setAmostra(null);
    }, "Formato salvo");
  }

  function excluir(formato) {
    if (!window.confirm(`Excluir o formato "${formato.nome}"?`)) return;
    executar(async () => {
      await chamar(`/api/v1/formatos/${formato.id}`, "DELETE");
      setFormatos((atuais) => atuais.filter((f) => f.id !== formato.id));
      if (editor?.id === formato.id) cancelar();
    }, "Formato excluído");
  }

  const descricaoValor = (f) =>
    f.valorModo === "separado"
      ? `${f.colDebito} / ${f.colCredito}`
      : f.colValor;

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">← Voltar ao menu</Link>
      </p>
      <h1>Formatos de importação</h1>
      <p style={{ maxWidth: 720 }}>
        Cada formato descreve como ler o CSV de um banco ou cartão. Escolha um
        arquivo de exemplo e o sistema detecta as colunas, a data e o valor.
        Depois, associe o formato à conta em{" "}
        <Link href="/cadastros">Cadastros</Link>.
      </p>

      {mensagem && (
        <p style={{ color: mensagem.tipo === "ok" ? "green" : "crimson" }}>
          {mensagem.texto}
        </p>
      )}

      {!editor && (
        <>
          <button onClick={novo}>Novo formato</button>

          <table
            cellPadding={6}
            style={{ borderCollapse: "collapse", marginTop: 16 }}
          >
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Nome</th>
                <th>Cabeçalho</th>
                <th>Data</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Formato da data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {formatos.map((f) => (
                <tr key={f.id} style={{ borderTop: "1px solid #ccc" }}>
                  <td>{f.nome}</td>
                  <td>{f.cabecalho ? "Sim" : "Não"}</td>
                  <td>{f.colData}</td>
                  <td>{f.colDescricao}</td>
                  <td>{descricaoValor(f)}</td>
                  <td>{f.formatoData}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => editar(f)} disabled={ocupado}>
                      Editar
                    </button>
                    <button onClick={() => excluir(f)} disabled={ocupado}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {editor && (
        <section style={{ marginTop: 8 }}>
          <h2>{editor.id ? "Editar formato" : "Novo formato"}</h2>

          <div style={{ marginBottom: 16 }}>
            <label>
              Arquivo de exemplo:{" "}
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                onChange={aoEscolherAmostra}
              />
            </label>
            {amostra && (
              <span style={{ marginLeft: 12, color: "#555" }}>
                {amostra.nomeArquivo}
                {decodificada &&
                  ` · codificação lida: ${decodificada.codificacaoUsada}`}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <Campo rotulo="Nome do formato">
              <input
                value={editor.nome}
                maxLength={100}
                onChange={(e) => alterar("nome", e.target.value)}
                style={{ width: 220 }}
              />
            </Campo>
            <Campo rotulo="Codificação">
              <select
                value={editor.codificacao}
                onChange={(e) => alterar("codificacao", e.target.value)}
              >
                {OPCOES_CODIFICACAO.map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Separador">
              <select
                value={editor.separador}
                onChange={(e) => alterar("separador", e.target.value)}
              >
                {OPCOES_SEPARADOR.map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Linhas a pular no início">
              <input
                type="number"
                min={0}
                max={100}
                value={editor.linhasPular}
                onChange={(e) => alterar("linhasPular", e.target.value)}
                style={{ width: 80 }}
              />
            </Campo>
            <Campo rotulo="Primeira linha">
              <label>
                <input
                  type="checkbox"
                  checked={editor.cabecalho}
                  onChange={(e) => alterarCabecalho(e.target.checked)}
                />{" "}
                É um cabeçalho (nomes das colunas)
              </label>
            </Campo>
          </div>

          {!editor.cabecalho && (
            <p style={{ color: "#996600" }}>
              Sem cabeçalho, as colunas são indicadas pelo número (1, 2, 3...).
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <Campo rotulo="Coluna da data">
              <SelecaoColuna
                valor={editor.colData}
                aoMudar={(v) => alterar("colData", v)}
                colunas={colunas}
              />
            </Campo>
            <Campo rotulo="Formato da data">
              <select
                value={editor.formatoData}
                onChange={(e) => alterar("formatoData", e.target.value)}
              >
                {Object.keys(FORMATOS_DATA).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Coluna da descrição">
              <SelecaoColuna
                valor={editor.colDescricao}
                aoMudar={(v) => alterar("colDescricao", v)}
                colunas={colunas}
              />
            </Campo>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <Campo rotulo="Valores">
              <select
                value={editor.valorModo}
                onChange={(e) => alterar("valorModo", e.target.value)}
              >
                <option value="unico">
                  Uma coluna, com sinal (negativo/positivo)
                </option>
                <option value="separado">
                  Débito e crédito em colunas separadas
                </option>
              </select>
            </Campo>
            {editor.valorModo === "unico" ? (
              <Campo rotulo="Coluna do valor">
                <SelecaoColuna
                  valor={editor.colValor}
                  aoMudar={(v) => alterar("colValor", v)}
                  colunas={colunas}
                />
              </Campo>
            ) : (
              <>
                <Campo rotulo="Coluna do débito">
                  <SelecaoColuna
                    valor={editor.colDebito}
                    aoMudar={(v) => alterar("colDebito", v)}
                    colunas={colunas}
                  />
                </Campo>
                <Campo rotulo="Coluna do crédito">
                  <SelecaoColuna
                    valor={editor.colCredito}
                    aoMudar={(v) => alterar("colCredito", v)}
                    colunas={colunas}
                  />
                </Campo>
              </>
            )}
            <Campo rotulo="Formato do número">
              <select
                value={editor.formatoValor}
                onChange={(e) => alterar("formatoValor", e.target.value)}
              >
                {OPCOES_VALOR.map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo rotulo="Descrições a ignorar na importação (uma por linha, texto exato)">
            <textarea
              rows={3}
              value={editor.ignorarTexto}
              onChange={(e) => alterar("ignorarTexto", e.target.value)}
              style={{ width: 360 }}
            />
          </Campo>

          <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
            <button
              onClick={salvar}
              disabled={ocupado || editor.nome.trim() === ""}
            >
              Salvar formato
            </button>
            <button onClick={cancelar} disabled={ocupado}>
              Cancelar
            </button>
          </div>

          <h3>Pré-visualização</h3>
          {!previa && (
            <p>Escolha um arquivo de exemplo para ver como ele seria lido.</p>
          )}
          {previa && (
            <>
              <p>
                {previa.linhas.length} linhas lidas · {previa.ignoradas.length}{" "}
                ignoradas
                {previa.mes &&
                  ` · mês ${previa.mes.slice(5)}/${previa.mes.slice(0, 4)}`}
              </p>
              {previa.erros.length > 0 && (
                <ul style={{ color: "crimson" }}>
                  {previa.erros.slice(0, 5).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                  {previa.erros.length > 5 && (
                    <li>... e mais {previa.erros.length - 5} problemas</li>
                  )}
                </ul>
              )}
              {previa.ignoradas.length > 0 && (
                <p style={{ color: "#996600" }}>
                  Ignoradas: {previa.ignoradas.slice(0, 3).join(" | ")}
                </p>
              )}
              {previa.linhas.length > 0 && (
                <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Valor (como no arquivo)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.linhas.slice(0, 10).map((l, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #ccc" }}>
                        <td>{l.data}</td>
                        <td>
                          {l.descricao.length > 90
                            ? `${l.descricao.slice(0, 90)}...`
                            : l.descricao}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {l.valor.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}

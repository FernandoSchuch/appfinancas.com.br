import { useEffect, useState } from "react";
import Link from "next/link";

function converterValor(texto) {
  const t = String(texto).replace(/\s/g, "");
  if (t === "") return NaN;
  const normalizado = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : t;
  return Number(normalizado);
}

const moeda = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatarMes = (mes) => `${mes.slice(5)}/${mes.slice(0, 4)}`;
const mesAtual = () => new Date().toISOString().slice(0, 7);
const rotuloTipo = (tipo) => (tipo === "C" ? "Crédito" : "Débito");
const rotuloNatureza = (n) => (n === "M" ? "Movimento manual" : "Previsão");

const ordenar = (lista) =>
  [...lista].sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      a.descricao.localeCompare(b.descricao, "pt-BR", { sensitivity: "base" }),
  );

const formularioVazio = (mes) => ({
  data: `${mes}-01`,
  descricao: "",
  tipo: "D",
  valor: "",
  origem: "",
  responsavel: "",
  natureza: "P",
});

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

function Selecao({ valor, aoMudar, lista }) {
  return (
    <select value={valor} onChange={(e) => aoMudar(e.target.value)}>
      <option value="">Selecione...</option>
      {lista.map((i) => (
        <option key={i.id} value={i.id}>
          {i.descricao}
        </option>
      ))}
    </select>
  );
}

function SelecaoNatureza({ valor, aoMudar }) {
  return (
    <select value={valor} onChange={(e) => aoMudar(e.target.value)}>
      <option value="P">Previsão</option>
      <option value="M">Movimento manual (ajuste)</option>
    </select>
  );
}

function validarLocal(f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return "Informe a data";
  if (f.descricao.trim() === "") return "Informe a descrição";
  const valor = converterValor(f.valor);
  if (!Number.isFinite(valor) || valor <= 0)
    return "Informe um valor maior que zero";
  if (f.origem === "") return "Informe a origem";
  if (f.responsavel === "") return "Informe o responsável";
  return null;
}

export default function Lancamentos() {
  const [listas, setListas] = useState({
    contas: [],
    origens: [],
    responsaveis: [],
  });
  const [conta, setConta] = useState("");
  const [mes, setMes] = useState(mesAtual());
  const [itens, setItens] = useState([]);
  const [novo, setNovo] = useState(formularioVazio(mesAtual()));
  const [editando, setEditando] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    chamar("/api/v1/listas", "GET")
      .then(setListas)
      .catch((erro) => setMensagem({ tipo: "erro", texto: erro.message }));
  }, []);

  useEffect(() => {
    let cancelado = false;
    setItens([]);
    setEditando(null);
    if (conta === "" || mes === "") return;

    chamar(`/api/v1/lancamentos?conta=${conta}&mes=${mes}`, "GET")
      .then((dados) => {
        if (!cancelado) setItens(dados);
      })
      .catch((erro) => {
        if (!cancelado) setMensagem({ tipo: "erro", texto: erro.message });
      });

    return () => {
      cancelado = true;
    };
  }, [conta, mes]);

  async function executar(acao, textoOk) {
    setOcupado(true);
    setMensagem(null);
    try {
      await acao();
      if (textoOk) setMensagem({ tipo: "ok", texto: textoOk });
    } catch (erro) {
      setMensagem({ tipo: "erro", texto: erro.message });
    } finally {
      setOcupado(false);
    }
  }

  const montarCorpo = (f) => ({
    conta: Number(conta),
    data: f.data,
    descricao: f.descricao,
    tipo: f.tipo,
    valor: converterValor(f.valor),
    origem: Number(f.origem),
    responsavel: Number(f.responsavel),
    natureza: f.natureza,
  });

  function trocarMes(valor) {
    setMes(valor);
    if (valor) setNovo((n) => ({ ...n, data: `${valor}-01` }));
  }

  function incluir() {
    const erro = validarLocal(novo);
    if (erro) {
      setMensagem({ tipo: "erro", texto: erro });
      return;
    }
    executar(async () => {
      const criado = await chamar(
        "/api/v1/lancamentos",
        "POST",
        montarCorpo(novo),
      );
      const mesCriado = criado.data.slice(0, 7);
      if (mesCriado === mes) {
        setItens((atuais) => ordenar([...atuais, criado]));
      } else {
        setMes(mesCriado);
      }
      setNovo({ ...formularioVazio(mesCriado), natureza: novo.natureza });
    }, "Lançamento incluído");
  }

  function iniciarEdicao(item) {
    setEditando({
      id: item.id,
      data: item.data,
      descricao: item.descricao,
      tipo: item.tipo,
      valor: String(item.valor).replace(".", ","),
      origem: String(item.origem),
      responsavel: String(item.responsavel),
      natureza: item.natureza,
    });
  }

  function salvar(original) {
    const erro = validarLocal(editando);
    if (erro) {
      setMensagem({ tipo: "erro", texto: erro });
      return;
    }
    if (editando.natureza !== original.natureza) {
      const ok = window.confirm(
        "Mudar a natureza altera o saldo da conta: o movimento manual entra no saldo, a previsão não. Continuar?",
      );
      if (!ok) return;
    }
    executar(async () => {
      const atualizado = await chamar(
        `/api/v1/lancamentos/${editando.id}`,
        "PUT",
        montarCorpo(editando),
      );
      setItens((atuais) => {
        const semAntigo = atuais.filter((i) => i.id !== editando.id);
        return atualizado.data.slice(0, 7) === mes
          ? ordenar([...semAntigo, atualizado])
          : semAntigo;
      });
      setEditando(null);
    }, "Lançamento alterado");
  }

  function excluir(item) {
    const aviso =
      item.natureza === "M" ? " O saldo da conta será ajustado." : "";
    if (!window.confirm(`Excluir "${item.descricao}"?${aviso}`)) return;
    executar(async () => {
      await chamar(`/api/v1/lancamentos/${item.id}`, "DELETE");
      setItens((atuais) => atuais.filter((i) => i.id !== item.id));
      if (editando?.id === item.id) setEditando(null);
    }, "Lançamento excluído");
  }

  const nomeDe = (lista, id) => lista.find((i) => i.id === id)?.descricao ?? id;
  const somar = (natureza, tipo) =>
    itens
      .filter((i) => i.natureza === natureza && i.tipo === tipo)
      .reduce((soma, i) => soma + i.valor, 0);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">← Voltar ao menu</Link>
      </p>
      <h1>Lançamentos manuais</h1>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <label>
          Conta:{" "}
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
          Mês:{" "}
          <input
            type="month"
            value={mes}
            onChange={(e) => trocarMes(e.target.value)}
          />
        </label>
      </div>

      {mensagem && (
        <p style={{ color: mensagem.tipo === "ok" ? "green" : "crimson" }}>
          {mensagem.texto}
        </p>
      )}

      {conta !== "" && mes !== "" && (
        <>
          <h3>Novo lançamento</h3>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <SelecaoNatureza
              valor={novo.natureza}
              aoMudar={(v) => setNovo({ ...novo, natureza: v })}
            />
            <input
              type="date"
              value={novo.data}
              onChange={(e) => setNovo({ ...novo, data: e.target.value })}
            />
            <input
              placeholder="Descrição"
              value={novo.descricao}
              onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
            />
            <select
              value={novo.tipo}
              onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}
            >
              <option value="D">Débito</option>
              <option value="C">Crédito</option>
            </select>
            <input
              placeholder="Valor (ex.: 68,84)"
              inputMode="decimal"
              value={novo.valor}
              onChange={(e) => setNovo({ ...novo, valor: e.target.value })}
            />
            <Selecao
              valor={novo.origem}
              aoMudar={(v) => setNovo({ ...novo, origem: v })}
              lista={listas.origens}
            />
            <Selecao
              valor={novo.responsavel}
              aoMudar={(v) => setNovo({ ...novo, responsavel: v })}
              lista={listas.responsaveis}
            />
            <button onClick={incluir} disabled={ocupado}>
              Incluir
            </button>
          </div>
          {novo.natureza === "M" && (
            <p style={{ color: "#996600", marginTop: 0 }}>
              Movimento manual altera o saldo da conta imediatamente.
            </p>
          )}

          <p>
            {itens.length} lançamentos em {formatarMes(mes)}
          </p>
          <p>
            Previsões: créditos {moeda(somar("P", "C"))} · débitos{" "}
            {moeda(somar("P", "D"))}
          </p>
          <p>
            Movimentos manuais: créditos {moeda(somar("M", "C"))} · débitos{" "}
            {moeda(somar("M", "D"))}
          </p>

          <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Natureza</th>
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
              {itens.map((item) => {
                const emEdicao = editando?.id === item.id;
                return (
                  <tr key={item.id} style={{ borderTop: "1px solid #ccc" }}>
                    {emEdicao ? (
                      <>
                        <td>
                          <SelecaoNatureza
                            valor={editando.natureza}
                            aoMudar={(v) =>
                              setEditando({ ...editando, natureza: v })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={editando.data}
                            onChange={(e) =>
                              setEditando({ ...editando, data: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={editando.descricao}
                            onChange={(e) =>
                              setEditando({
                                ...editando,
                                descricao: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            value={editando.tipo}
                            onChange={(e) =>
                              setEditando({ ...editando, tipo: e.target.value })
                            }
                          >
                            <option value="D">Débito</option>
                            <option value="C">Crédito</option>
                          </select>
                        </td>
                        <td>
                          <input
                            inputMode="decimal"
                            value={editando.valor}
                            onChange={(e) =>
                              setEditando({
                                ...editando,
                                valor: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <Selecao
                            valor={editando.origem}
                            aoMudar={(v) =>
                              setEditando({ ...editando, origem: v })
                            }
                            lista={listas.origens}
                          />
                        </td>
                        <td>
                          <Selecao
                            valor={editando.responsavel}
                            aoMudar={(v) =>
                              setEditando({ ...editando, responsavel: v })
                            }
                            lista={listas.responsaveis}
                          />
                        </td>
                        <td style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => salvar(item)}
                            disabled={ocupado}
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditando(null)}
                            disabled={ocupado}
                          >
                            Cancelar
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{rotuloNatureza(item.natureza)}</td>
                        <td>{item.data}</td>
                        <td>{item.descricao}</td>
                        <td>{rotuloTipo(item.tipo)}</td>
                        <td style={{ textAlign: "right" }}>
                          {moeda(item.valor)}
                        </td>
                        <td>{nomeDe(listas.origens, item.origem)}</td>
                        <td>{nomeDe(listas.responsaveis, item.responsavel)}</td>
                        <td style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => iniciarEdicao(item)}
                            disabled={ocupado}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluir(item)}
                            disabled={ocupado}
                          >
                            Excluir
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

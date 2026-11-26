import { useEffect, useState } from "react";
import Link from "next/link";

const ABAS = [
  {
    tipo: "contas",
    titulo: "Contas",
    extras: [
      {
        campo: "negativoCredito",
        rotulo: "Negativo no extrato é crédito (marque para cartão de crédito)",
        coluna: "Negativo é crédito",
        padrao: false,
      },
    ],
  },
  {
    tipo: "origens",
    titulo: "Origens",
    extras: [
      {
        campo: "constaRelatorios",
        rotulo:
          "Consta nos relatórios (desmarque para pagamento de fatura, transferências entre contas)",
        coluna: "Consta nos relatórios",
        padrao: true,
      },
    ],
  },
  { tipo: "responsaveis", titulo: "Responsáveis", extras: [] },
];

const ordenar = (lista) =>
  [...lista].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
  );

const extrasPadrao = (aba) =>
  Object.fromEntries(aba.extras.map((e) => [e.campo, e.padrao]));

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

export default function Cadastros() {
  const [tipo, setTipo] = useState("contas");
  const [itens, setItens] = useState([]);
  const [mensagem, setMensagem] = useState(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoExtras, setNovoExtras] = useState(extrasPadrao(ABAS[0]));
  const [editando, setEditando] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const aba = ABAS.find((a) => a.tipo === tipo);
  const url = `/api/v1/cadastros/${tipo}`;

  useEffect(() => {
    let cancelado = false;
    const atual = ABAS.find((a) => a.tipo === tipo);
    setItens([]);
    setMensagem(null);
    setNovoNome("");
    setNovoExtras(extrasPadrao(atual));
    setEditando(null);

    chamar(`/api/v1/cadastros/${tipo}`, "GET")
      .then((dados) => {
        if (!cancelado) setItens(dados);
      })
      .catch((erro) => {
        if (!cancelado) setMensagem({ tipo: "erro", texto: erro.message });
      });

    return () => {
      cancelado = true;
    };
  }, [tipo]);

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

  function incluir() {
    executar(async () => {
      const criado = await chamar(url, "POST", {
        nome: novoNome,
        ...novoExtras,
      });
      setItens((atuais) => ordenar([...atuais, criado]));
      setNovoNome("");
      setNovoExtras(extrasPadrao(aba));
    }, "Incluído com sucesso");
  }

  function iniciarEdicao(item) {
    setEditando({
      id: item.id,
      nome: item.nome,
      ...Object.fromEntries(aba.extras.map((e) => [e.campo, item[e.campo]])),
    });
  }

  function salvar(original) {
    if (
      tipo === "contas" &&
      editando.negativoCredito !== original.negativoCredito
    ) {
      const ok = window.confirm(
        "Alterar essa configuração vale só para importações futuras. Os movimentos já gravados não mudam. Continuar?",
      );
      if (!ok) return;
    }
    executar(async () => {
      const corpo = { nome: editando.nome };
      aba.extras.forEach((e) => {
        corpo[e.campo] = editando[e.campo];
      });
      const atualizado = await chamar(`${url}/${original.id}`, "PUT", corpo);
      setItens((atuais) =>
        ordenar(atuais.map((i) => (i.id === original.id ? atualizado : i))),
      );
      setEditando(null);
    }, "Alterado com sucesso");
  }

  function excluir(item) {
    if (!window.confirm(`Excluir "${item.nome}"?`)) return;
    executar(async () => {
      await chamar(`${url}/${item.id}`, "DELETE");
      setItens((atuais) => atuais.filter((i) => i.id !== item.id));
      if (editando?.id === item.id) setEditando(null);
    }, "Excluído com sucesso");
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/">← Voltar ao menu</Link>
      </p>
      <h1>Cadastros</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {ABAS.map((a) => (
          <button
            key={a.tipo}
            onClick={() => setTipo(a.tipo)}
            style={{ fontWeight: a.tipo === tipo ? "bold" : "normal" }}
          >
            {a.titulo}
          </button>
        ))}
      </div>

      {mensagem && (
        <p style={{ color: mensagem.tipo === "ok" ? "green" : "crimson" }}>
          {mensagem.texto}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <input
          placeholder="Nome"
          maxLength={100}
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !ocupado && incluir()}
        />
        {aba.extras.map((e) => (
          <label key={e.campo}>
            <input
              type="checkbox"
              checked={novoExtras[e.campo] ?? false}
              onChange={(ev) =>
                setNovoExtras({ ...novoExtras, [e.campo]: ev.target.checked })
              }
            />{" "}
            {e.rotulo}
          </label>
        ))}
        <button onClick={incluir} disabled={ocupado || novoNome.trim() === ""}>
          Incluir
        </button>
      </div>

      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th>Nome</th>
            {aba.extras.map((e) => (
              <th key={e.campo}>{e.coluna}</th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => {
            const emEdicao = editando?.id === item.id;
            return (
              <tr key={item.id} style={{ borderTop: "1px solid #ccc" }}>
                <td>
                  {emEdicao ? (
                    <input
                      maxLength={100}
                      value={editando.nome}
                      onChange={(e) =>
                        setEditando({ ...editando, nome: e.target.value })
                      }
                    />
                  ) : (
                    item.nome
                  )}
                </td>
                {aba.extras.map((e) => (
                  <td key={e.campo}>
                    {emEdicao ? (
                      <input
                        type="checkbox"
                        checked={editando[e.campo] ?? false}
                        onChange={(ev) =>
                          setEditando({
                            ...editando,
                            [e.campo]: ev.target.checked,
                          })
                        }
                      />
                    ) : item[e.campo] ? (
                      "Sim"
                    ) : (
                      "Não"
                    )}
                  </td>
                ))}
                <td style={{ display: "flex", gap: 8 }}>
                  {emEdicao ? (
                    <>
                      <button
                        onClick={() => salvar(item)}
                        disabled={ocupado || editando.nome.trim() === ""}
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        disabled={ocupado}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => iniciarEdicao(item)}
                        disabled={ocupado}
                      >
                        Editar
                      </button>
                      <button onClick={() => excluir(item)} disabled={ocupado}>
                        Excluir
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

export const CADASTROS = {
  contas: {
    tabela: "contas_bancarias",
    id: "con_conta",
    nome: "con_descricao",
    extras: [
      {
        coluna: "con_negativo_credito",
        campo: "negativoCredito",
        tipo: "boolean",
        erro: "Informe se, no extrato, o valor negativo é crédito",
      },
    ],
  },
  origens: {
    tabela: "origens",
    id: "ori_origem",
    nome: "ori_descricao",
    extras: [
      {
        coluna: "ori_ignorar_relatorios",
        campo: "ignorarRelatorios",
        tipo: "boolean",
        erro: "Informe se a origem deve ser ignorada nos relatórios",
      },
    ],
  },
  responsaveis: {
    tabela: "responsaveis",
    id: "res_responsavel",
    nome: "res_nome",
    extras: [],
  },
};

const CAST = { boolean: "boolean", valor: "numeric" };

export function buscarCadastro(tipo) {
  return Object.hasOwn(CADASTROS, tipo) ? CADASTROS[tipo] : null;
}

export function colunasRetorno(cadastro) {
  const extras = cadastro.extras
    .map((e) =>
      e.tipo === "valor"
        ? `, ${e.coluna}::float8 AS "${e.campo}"`
        : `, ${e.coluna} AS "${e.campo}"`,
    )
    .join("");
  return `${cadastro.id}::int AS id, ${cadastro.nome} AS nome${extras}`;
}

export function lerCorpo(cadastro, body) {
  const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
  if (!nome) return { erro: "Nome obrigatório" };
  if (nome.length > 100) return { erro: "Nome com no máximo 100 caracteres" };

  const extras = [];
  for (const e of cadastro.extras) {
    const valor = body?.[e.campo];
    if (e.tipo === "boolean") {
      if (typeof valor !== "boolean") return { erro: e.erro };
      extras.push(valor);
    } else if (valor === null || valor === undefined) {
      extras.push(null);
    } else if (
      typeof valor === "number" &&
      Number.isFinite(valor) &&
      valor > 0 &&
      valor < 1e13 &&
      Math.round(valor * 100) / 100 === valor
    ) {
      extras.push(valor);
    } else {
      return { erro: e.erro };
    }
  }
  return { dados: { nome, extras } };
}

// colunas, valores e tipos (para os casts) na mesma ordem; o nome é sempre o $1
export function colunasEscrita(cadastro, dados) {
  return {
    colunas: [cadastro.nome, ...cadastro.extras.map((e) => e.coluna)],
    valores: [dados.nome, ...dados.extras],
    tipos: ["varchar", ...cadastro.extras.map((e) => CAST[e.tipo])],
  };
}

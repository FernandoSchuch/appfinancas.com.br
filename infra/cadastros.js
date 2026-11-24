export const CADASTROS = {
  contas: {
    tabela: "contas_bancarias",
    id: "con_conta",
    nome: "con_descricao",
    flag: "con_negativo_credito",
  },
  origens: {
    tabela: "origens",
    id: "ori_origem",
    nome: "ori_descricao",
  },
  responsaveis: {
    tabela: "responsaveis",
    id: "res_responsavel",
    nome: "res_nome",
  },
};

export function buscarCadastro(tipo) {
  return Object.hasOwn(CADASTROS, tipo) ? CADASTROS[tipo] : null;
}

export function colunasRetorno(cadastro) {
  const flag = cadastro.flag ? `, ${cadastro.flag} AS "negativoCredito"` : "";
  return `${cadastro.id}::int AS id, ${cadastro.nome} AS nome${flag}`;
}

export function lerCorpo(cadastro, body) {
  const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
  if (!nome) return { erro: "Nome obrigatório" };
  if (nome.length > 100) return { erro: "Nome com no máximo 100 caracteres" };

  const dados = { nome };
  if (cadastro.flag) {
    if (typeof body.negativoCredito !== "boolean") {
      return { erro: "Informe se, no extrato, o valor negativo é crédito" };
    }
    dados.negativoCredito = body.negativoCredito;
  }
  return { dados };
}

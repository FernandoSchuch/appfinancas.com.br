export const RETORNO = `
  mov_movimento::int AS id,
  to_char(mov_data, 'YYYY-MM-DD') AS data,
  mov_descricao AS descricao,
  mov_valor::float8 AS valor,
  mov_tipo AS tipo,
  ori_origem::int AS origem,
  res_responsavel::int AS responsavel,
  con_conta::int AS conta,
  mov_natureza AS natureza
`;

export function lerLancamento(body) {
  if (!body) return { erro: "Dados não informados" };
  const { conta, data, descricao, tipo, valor, origem, responsavel, natureza } =
    body;

  if (!Number.isInteger(conta)) return { erro: "Conta inválida" };
  if (
    typeof data !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
    isNaN(Date.parse(data))
  ) {
    return { erro: "Data inválida" };
  }
  const texto = typeof descricao === "string" ? descricao.trim() : "";
  if (!texto || texto.length > 1000) return { erro: "Descrição inválida" };
  if (tipo !== "C" && tipo !== "D") {
    return { erro: "Tipo deve ser C (crédito) ou D (débito)" };
  }
  if (
    typeof valor !== "number" ||
    !Number.isFinite(valor) ||
    valor <= 0 ||
    valor >= 1e13 ||
    Math.round(valor * 100) / 100 !== valor
  ) {
    return { erro: "Valor inválido (positivo, com até 2 casas decimais)" };
  }
  if (!Number.isInteger(origem)) return { erro: "Origem não informada" };
  if (!Number.isInteger(responsavel))
    return { erro: "Responsável não informado" };
  if (natureza !== "P" && natureza !== "M") {
    return { erro: "Natureza deve ser P (previsão) ou M (movimento manual)" };
  }

  return {
    dados: {
      conta,
      data,
      descricao: texto,
      tipo,
      valor,
      origem,
      responsavel,
      natureza,
    },
  };
}

export function tratarErroBanco(error, response) {
  if (error.code === "23503" || error.code === "23502") {
    return response
      .status(400)
      .json({ error: "Conta, origem ou responsável inexistente" });
  }
  if (error.code === "22007" || error.code === "22008") {
    return response.status(400).json({ error: "Data inválida" });
  }
  if (error.code === "22003") {
    return response
      .status(400)
      .json({ error: "Valor fora do limite permitido" });
  }
  console.error(error);
  return response.status(500).json({ error: "Erro ao gravar lançamento" });
}

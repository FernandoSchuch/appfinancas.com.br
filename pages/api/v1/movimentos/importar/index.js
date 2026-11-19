import database from "infra/database.js";

const MAX_LINHAS = 2000;

function validar(body) {
  if (!body || !Number.isInteger(body.conta)) {
    return "Conta inválida";
  }
  const lista = body.movimentos;
  if (!Array.isArray(lista) || lista.length === 0) {
    return "Nenhum movimento informado";
  }
  if (lista.length > MAX_LINHAS) {
    return `Máximo de ${MAX_LINHAS} movimentos por importação`;
  }
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i];
    const n = i + 1;
    if (!m || isNaN(Date.parse(m.data))) return `Linha ${n}: data inválida`;
    if (
      typeof m.descricao !== "string" ||
      !m.descricao.trim() ||
      m.descricao.length > 1000
    )
      return `Linha ${n}: descrição inválida`;
    if (typeof m.valor !== "number" || !Number.isFinite(m.valor))
      return `Linha ${n}: valor inválido`;
    if (!Number.isInteger(m.origem)) return `Linha ${n}: origem não informada`;
    if (!Number.isInteger(m.responsavel))
      return `Linha ${n}: responsável não informado`;
  }
  return null;
}

async function importar(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", ["POST"]);
    return response.status(405).json({ error: "Método não permitido" });
  }

  const erro = validar(request.body);
  if (erro) {
    return response.status(400).json({ error: erro });
  }

  const { conta, movimentos } = request.body;

  try {
    const result = await database.query({
      text: `
        INSERT INTO movimentos
          (mov_data, mov_valor, mov_descricao, mov_tipo, ori_origem, res_responsavel, con_conta)
        SELECT x.data, ABS(x.valor), x.descricao,
               CASE WHEN (x.valor < 0) = c.con_negativo_credito THEN 'C' ELSE 'D' END,
               x.origem, x.responsavel, c.con_conta
        FROM contas_bancarias c
        CROSS JOIN unnest($2::timestamp[], $3::numeric[], $4::text[], $5::int[], $6::int[])
             AS x(data, valor, descricao, origem, responsavel)
        WHERE c.con_conta = $1
      `,
      values: [
        conta,
        movimentos.map((m) => m.data),
        movimentos.map((m) => m.valor),
        movimentos.map((m) => m.descricao.trim()),
        movimentos.map((m) => m.origem),
        movimentos.map((m) => m.responsavel),
      ],
    });

    if (result.rowCount === 0) {
      return response.status(400).json({ error: "Conta inexistente" });
    }

    return response.status(201).json({ inseridos: result.rowCount });
  } catch (error) {
    if (error.code === "23503") {
      return response
        .status(400)
        .json({ error: "Origem ou responsável inexistente" });
    }
    console.error(error);
    return response.status(500).json({ error: "Erro ao gravar movimentos" });
  }
}

export default importar;

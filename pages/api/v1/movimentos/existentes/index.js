import database from "infra/database.js";
import { limitesDoMes } from "infra/periodo.js";

async function existentes(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", ["GET"]);
    return response.status(405).json({ error: "Método não permitido" });
  }

  const conta = Number(request.query.conta);
  const mes = request.query.mes || "";

  if (!Number.isInteger(conta) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    return response.status(400).json({ error: "Conta ou mês inválido" });
  }

  const { inicio, fim } = limitesDoMes(mes);

  const result = await database.query({
    text: `
      SELECT to_char(mov_data, 'YYYY-MM-DD') AS data,
             mov_descricao AS descricao,
             mov_valor::float8 AS valor,
             ori_origem::int AS origem,
             res_responsavel::int AS responsavel
      FROM movimentos
      WHERE con_conta = $1
      AND mov_natureza = 'I'
      AND mov_data >= $2::date
      AND mov_data < $3::date
      ORDER BY mov_movimento
    `,
    values: [conta, inicio, fim],
  });

  return response.status(200).json({ movimentos: result.rows });
}

export default existentes;

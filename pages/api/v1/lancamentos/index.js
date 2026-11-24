import database from "infra/database.js";
import { limitesDoMes } from "infra/periodo.js";
import { RETORNO, lerLancamento, tratarErroBanco } from "infra/lancamentos.js";

async function lancamentos(request, response) {
  if (request.method === "GET") {
    const conta = Number(request.query.conta);
    const mes = request.query.mes || "";
    const natureza = request.query.natureza;

    if (!Number.isInteger(conta) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      return response.status(400).json({ error: "Conta ou mês inválido" });
    }
    if (natureza !== undefined && natureza !== "P" && natureza !== "M") {
      return response.status(400).json({ error: "Natureza inválida" });
    }
    const { inicio, fim } = limitesDoMes(mes);

    const result = await database.query({
      text: `
        SELECT ${RETORNO}
        FROM movimentos
        WHERE con_conta = $1::numeric
          AND mov_natureza::text = ANY($2::text[])
          AND mov_data >= $3::date
          AND mov_data < $4::date
        ORDER BY mov_data, mov_movimento
      `,
      values: [conta, natureza ? [natureza] : ["P", "M"], inicio, fim],
    });
    return response.status(200).json(result.rows);
  }

  if (request.method === "POST") {
    const { dados, erro } = lerLancamento(request.body);
    if (erro) {
      return response.status(400).json({ error: erro });
    }

    try {
      const result = await database.query({
        text: `
          INSERT INTO movimentos
            (mov_data, mov_valor, mov_descricao, mov_tipo, ori_origem, res_responsavel, con_conta, mov_natureza)
          SELECT $1::date, $2::numeric, $3::text, $4::text, $5::int, $6::int, c.con_conta, $8::text
          FROM contas_bancarias c
          WHERE c.con_conta = $7::numeric
          RETURNING ${RETORNO}
        `,
        values: [
          dados.data,
          dados.valor,
          dados.descricao,
          dados.tipo,
          dados.origem,
          dados.responsavel,
          dados.conta,
          dados.natureza,
        ],
      });

      if (result.rowCount === 0) {
        return response.status(400).json({ error: "Conta inexistente" });
      }
      return response.status(201).json(result.rows[0]);
    } catch (error) {
      return tratarErroBanco(error, response);
    }
  }

  response.setHeader("Allow", ["GET", "POST"]);
  return response.status(405).json({ error: "Método não permitido" });
}

export default lancamentos;

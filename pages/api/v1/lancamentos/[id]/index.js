import database from "infra/database.js";
import { RETORNO, lerLancamento, tratarErroBanco } from "infra/lancamentos.js";

async function lancamento(request, response) {
  const id = Number(request.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    return response.status(400).json({ error: "Código inválido" });
  }

  if (request.method === "PUT") {
    const { dados, erro } = lerLancamento(request.body);
    if (erro) {
      return response.status(400).json({ error: erro });
    }

    try {
      const result = await database.query({
        text: `
          UPDATE movimentos
          SET mov_data = $1::date,
              mov_valor = $2::numeric,
              mov_descricao = $3::text,
              mov_tipo = $4::text,
              ori_origem = $5::int,
              res_responsavel = $6::int,
              con_conta = (SELECT con_conta FROM contas_bancarias WHERE con_conta = $7::numeric),
              mov_natureza = $8::text
          WHERE mov_movimento = $9::numeric
            AND mov_natureza IN ('P', 'M')
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
          id,
        ],
      });

      if (result.rowCount === 0) {
        return response
          .status(404)
          .json({ error: "Lançamento não encontrado" });
      }
      return response.status(200).json(result.rows[0]);
    } catch (error) {
      return tratarErroBanco(error, response);
    }
  }

  if (request.method === "DELETE") {
    try {
      const result = await database.query({
        text: `DELETE FROM movimentos WHERE mov_movimento = $1::numeric AND mov_natureza IN ('P', 'M')`,
        values: [id],
      });
      if (result.rowCount === 0) {
        return response
          .status(404)
          .json({ error: "Lançamento não encontrado" });
      }
      return response.status(204).end();
    } catch (error) {
      return tratarErroBanco(error, response);
    }
  }

  response.setHeader("Allow", ["PUT", "DELETE"]);
  return response.status(405).json({ error: "Método não permitido" });
}

export default lancamento;

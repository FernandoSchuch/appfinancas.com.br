import database from "infra/database.js";

async function listas(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", ["GET"]);
    return response.status(405).json({ error: "Método não permitido" });
  }

  const contas = await database.query(
    `SELECT con_conta::int AS id, con_descricao AS descricao,
            con_negativo_credito AS "negativoCredito",
            con_formato::int AS formato
     FROM contas_bancarias ORDER BY con_descricao`,
  );
  const origens = await database.query(
    "SELECT ori_origem::int AS id, ori_descricao AS descricao FROM origens ORDER BY ori_descricao",
  );
  const responsaveis = await database.query(
    "SELECT res_responsavel::int AS id, res_nome AS descricao FROM responsaveis ORDER BY res_nome",
  );

  response.status(200).json({
    contas: contas.rows,
    origens: origens.rows,
    responsaveis: responsaveis.rows,
  });
}

export default listas;
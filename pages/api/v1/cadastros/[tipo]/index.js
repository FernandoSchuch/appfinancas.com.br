import database from "infra/database.js";
import {
  buscarCadastro,
  colunasEscrita,
  colunasRetorno,
  lerCorpo,
} from "infra/cadastros.js";

async function cadastros(request, response) {
  const cadastro = buscarCadastro(request.query.tipo);
  if (!cadastro) {
    return response.status(404).json({ error: "Cadastro inexistente" });
  }

  if (request.method === "GET") {
    const result = await database.query(
      `SELECT ${colunasRetorno(cadastro)}
       FROM ${cadastro.tabela}
       ORDER BY lower(${cadastro.nome})`,
    );
    return response.status(200).json(result.rows);
  }

  if (request.method === "POST") {
    const { dados, erro } = lerCorpo(cadastro, request.body);
    if (erro) {
      return response.status(400).json({ error: erro });
    }

    const { colunas, valores, expressoes } = colunasEscrita(cadastro, dados);

    const result = await database.query({
      text: `
        INSERT INTO ${cadastro.tabela} (${colunas.join(", ")})
        SELECT ${expressoes.join(", ")}
        WHERE NOT EXISTS (
          SELECT 1 FROM ${cadastro.tabela}
          WHERE lower(${cadastro.nome}) = lower($1::varchar)
        )
        RETURNING ${colunasRetorno(cadastro)}
      `,
      values: valores,
    });

    if (result.rowCount === 0) {
      return response
        .status(409)
        .json({ error: "Já existe um cadastro com esse nome" });
    }
    return response.status(201).json(result.rows[0]);
  }

  response.setHeader("Allow", ["GET", "POST"]);
  return response.status(405).json({ error: "Método não permitido" });
}

export default cadastros;

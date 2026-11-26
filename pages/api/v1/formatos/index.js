import database from "infra/database.js";
import { RETORNO_FORMATO, lerFormato, valoresFormato } from "infra/formatos.js";

async function formatos(request, response) {
  if (request.method === "GET") {
    const result = await database.query(
      `SELECT ${RETORNO_FORMATO} FROM formatos_importacao ORDER BY lower(fmt_nome)`,
    );
    return response.status(200).json(result.rows);
  }

  if (request.method === "POST") {
    const { dados, erro } = lerFormato(request.body);
    if (erro) {
      return response.status(400).json({ error: erro });
    }

    const result = await database.query({
      text: `
        INSERT INTO formatos_importacao
          (fmt_nome, fmt_codificacao, fmt_separador, fmt_cabecalho, fmt_linhas_pular,
           fmt_col_data, fmt_col_descricao, fmt_valor_modo, fmt_col_valor, fmt_col_debito,
           fmt_col_credito, fmt_formato_data, fmt_formato_valor, fmt_ignorar)
        SELECT $1::varchar, $2::varchar, $3::varchar,
               CASE WHEN $4::boolean THEN 'S' ELSE 'N' END,
               $5::int, $6::varchar, $7::varchar, $8::varchar, $9::varchar, $10::varchar,
               $11::varchar, $12::varchar, $13::varchar, $14::text[]
        WHERE NOT EXISTS (
          SELECT 1 FROM formatos_importacao WHERE lower(fmt_nome) = lower($1::varchar)
        )
        RETURNING ${RETORNO_FORMATO}
      `,
      values: valoresFormato(dados),
    });

    if (result.rowCount === 0) {
      return response
        .status(409)
        .json({ error: "Já existe um formato com esse nome" });
    }
    return response.status(201).json(result.rows[0]);
  }

  response.setHeader("Allow", ["GET", "POST"]);
  return response.status(405).json({ error: "Método não permitido" });
}

export default formatos;

import database from "infra/database.js";
import { RETORNO_FORMATO, lerFormato, valoresFormato } from "infra/formatos.js";

async function formato(request, response) {
  const id = Number(request.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    return response.status(400).json({ error: "Código inválido" });
  }

  if (request.method !== "PUT" && request.method !== "DELETE") {
    response.setHeader("Allow", ["PUT", "DELETE"]);
    return response.status(405).json({ error: "Método não permitido" });
  }

  const existe = await database.query({
    text: "SELECT 1 FROM formatos_importacao WHERE fmt_formato = $1::numeric",
    values: [id],
  });
  if (existe.rowCount === 0) {
    return response.status(404).json({ error: "Formato não encontrado" });
  }

  if (request.method === "PUT") {
    const { dados, erro } = lerFormato(request.body);
    if (erro) {
      return response.status(400).json({ error: erro });
    }

    const result = await database.query({
      text: `
        UPDATE formatos_importacao
        SET fmt_nome = $1::varchar,
            fmt_codificacao = $2::varchar,
            fmt_separador = $3::varchar,
            fmt_cabecalho = CASE WHEN $4::boolean THEN 'S' ELSE 'N' END,
            fmt_linhas_pular = $5::int,
            fmt_col_data = $6::varchar,
            fmt_col_descricao = $7::varchar,
            fmt_valor_modo = $8::varchar,
            fmt_col_valor = $9::varchar,
            fmt_col_debito = $10::varchar,
            fmt_col_credito = $11::varchar,
            fmt_formato_data = $12::varchar,
            fmt_formato_valor = $13::varchar,
            fmt_ignorar = $14::text[]
        WHERE fmt_formato = $15::numeric
          AND NOT EXISTS (
            SELECT 1 FROM formatos_importacao
            WHERE lower(fmt_nome) = lower($1::varchar)
              AND fmt_formato <> $15::numeric
          )
        RETURNING ${RETORNO_FORMATO}
      `,
      values: [...valoresFormato(dados), id],
    });

    if (result.rowCount === 0) {
      return response
        .status(409)
        .json({ error: "Já existe um formato com esse nome" });
    }
    return response.status(200).json(result.rows[0]);
  }

  // DELETE
  const emUso = await database.query({
    text: "SELECT 1 FROM contas_bancarias WHERE con_formato = $1::numeric LIMIT 1",
    values: [id],
  });
  if (emUso.rowCount > 0) {
    return response
      .status(409)
      .json({
        error: "Não é possível excluir: o formato está em uso por contas",
      });
  }

  await database.query({
    text: "DELETE FROM formatos_importacao WHERE fmt_formato = $1::numeric",
    values: [id],
  });
  return response.status(204).end();
}

export default formato;

import database from "infra/database.js";
import {
  buscarCadastro,
  colunasEscrita,
  colunasRetorno,
  lerCorpo,
} from "infra/cadastros.js";

const MSG_VINCULADO = "Não é possível excluir: existem movimentos vinculados";

async function cadastro(request, response) {
  const config = buscarCadastro(request.query.tipo);
  if (!config) {
    return response.status(404).json({ error: "Cadastro inexistente" });
  }

  const id = Number(request.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    return response.status(400).json({ error: "Código inválido" });
  }

  if (request.method !== "PUT" && request.method !== "DELETE") {
    response.setHeader("Allow", ["PUT", "DELETE"]);
    return response.status(405).json({ error: "Método não permitido" });
  }

  const existe = await database.query({
    text: `SELECT 1 FROM ${config.tabela} WHERE ${config.id} = $1::numeric`,
    values: [id],
  });
  if (existe.rowCount === 0) {
    return response.status(404).json({ error: "Cadastro não encontrado" });
  }

  if (request.method === "PUT") {
    const { dados, erro } = lerCorpo(config, request.body);
    if (erro) {
      return response.status(400).json({ error: erro });
    }

    const { colunas, valores, expressoes } = colunasEscrita(config, dados);
    const sets = colunas.map((c, i) => `${c} = ${expressoes[i]}`);
    valores.push(id);
    const posId = valores.length;

    try {
      const result = await database.query({
        text: `
          UPDATE ${config.tabela}
          SET ${sets.join(", ")}
          WHERE ${config.id} = $${posId}::numeric
            AND NOT EXISTS (
              SELECT 1 FROM ${config.tabela}
              WHERE lower(${config.nome}) = lower($1::varchar)
                AND ${config.id} <> $${posId}::numeric
            )
          RETURNING ${colunasRetorno(config)}
        `,
        values: valores,
      });

      if (result.rowCount === 0) {
        return response
          .status(409)
          .json({ error: "Já existe um cadastro com esse nome" });
      }
      return response.status(200).json(result.rows[0]);
    } catch (error) {
      if (error.code === "23503") {
        return response
          .status(400)
          .json({ error: "O formato de importação escolhido não existe" });
      }
      console.error(error);
      return response.status(500).json({ error: "Erro ao gravar o cadastro" });
    }
  }

  // DELETE
  const vinculados = await database.query({
    text: `SELECT 1 FROM movimentos WHERE ${config.id} = $1::numeric LIMIT 1`,
    values: [id],
  });
  if (vinculados.rowCount > 0) {
    return response.status(409).json({ error: MSG_VINCULADO });
  }

  try {
    // a linha de saldo da conta impede a exclusão, então sai junto, no mesmo comando
    const comando =
      request.query.tipo === "contas"
        ? `WITH s AS (DELETE FROM saldos_conta_bancaria WHERE con_conta = $1::numeric)
           DELETE FROM contas_bancarias WHERE con_conta = $1::numeric`
        : `DELETE FROM ${config.tabela} WHERE ${config.id} = $1::numeric`;

    await database.query({ text: comando, values: [id] });
    return response.status(204).end();
  } catch (error) {
    if (error.code === "23503") {
      return response.status(409).json({ error: MSG_VINCULADO });
    }
    console.error(error);
    return response.status(500).json({ error: "Erro ao excluir" });
  }
}

export default cadastro;

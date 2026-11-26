import database from "infra/database.js";

async function resumoMensal(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", ["GET"]);
    return response.status(405).json({ error: "Método não permitido" });
  }

  const meses = Number(request.query.meses);
  const ate = request.query.ate || "";
  const contas = (request.query.contas || "")
    .split(",")
    .filter(Boolean)
    .map(Number);
  const filtrar = request.query.filtrar === "1";

  if (!Number.isInteger(meses) || meses < 1 || meses > 36) {
    return response.status(400).json({ error: "Meses deve ser de 1 a 36" });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ate)) {
    return response.status(400).json({ error: "Mês final inválido" });
  }
  if (!contas.every(Number.isInteger)) {
    return response.status(400).json({ error: "Contas inválidas" });
  }

  const result = await database.query({
    text: `
      WITH janela AS (
        SELECT (date_trunc('month', $1::date) - g.n * interval '1 month')::date AS inicio
        FROM generate_series(0, $2::int - 1) AS g(n)
      )
      SELECT to_char(j.inicio, 'YYYY-MM') AS mes,
        COALESCE(SUM(mv.mov_valor) FILTER (WHERE mv.mov_tipo = 'C' AND mv.mov_natureza <> 'P'), 0)::float8 AS creditos,
        COALESCE(SUM(mv.mov_valor) FILTER (WHERE mv.mov_tipo = 'D' AND mv.mov_natureza <> 'P'), 0)::float8 AS debitos,
        COALESCE(SUM(mv.mov_valor) FILTER (WHERE mv.mov_tipo = 'C' AND mv.mov_natureza = 'P'), 0)::float8 AS "creditosPrevistos",
        COALESCE(SUM(mv.mov_valor) FILTER (WHERE mv.mov_tipo = 'D' AND mv.mov_natureza = 'P'), 0)::float8 AS "debitosPrevistos"
      FROM janela j
      LEFT JOIN movimentos mv
        ON mv.mov_data >= j.inicio
       AND mv.mov_data < (j.inicio + interval '1 month')
       AND mv.con_conta = ANY($3::numeric[])
       AND NOT ($4::boolean AND EXISTS (
             SELECT 1 FROM origens o
             WHERE o.ori_origem = mv.ori_origem AND o.ori_consta_relatorios = 'N'
           ))
      GROUP BY j.inicio
      ORDER BY j.inicio
    `,
    values: [`${ate}-01`, meses, contas, filtrar],
  });

  return response.status(200).json(result.rows);
}

export default resumoMensal;

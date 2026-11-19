require("dotenv").config({ path: ".env.development" });
const { Client } = require("pg");

const CONTAS = [
  "Conta Corrente Teste",
  "Cartão de Crédito Teste",
  "Poupança Teste",
];
const ORIGENS = [
  "Mercado",
  "Transporte",
  "Compras online",
  "Alimentação",
  "Lazer",
];
const RESPONSAVEIS = ["Responsável A", "Responsável B"];

const HOSTS_LOCAIS = ["localhost", "127.0.0.1", "::1"];

async function inserirSeNaoExiste(client, tabela, colunaDescricao, descricao) {
  await client.query(
    `INSERT INTO ${tabela} (${colunaDescricao})
     SELECT $1::varchar
     WHERE NOT EXISTS (SELECT 1 FROM ${tabela} WHERE ${colunaDescricao} = $1::varchar)`,
    [descricao],
  );
}

async function main() {
  const host = process.env.POSTGRES_HOST;

  if (process.env.NODE_ENV === "production" || !HOSTS_LOCAIS.includes(host)) {
    console.error(`Seed abortado: ambiente não permitido (host: ${host}).`);
    process.exit(1);
  }

  const client = new Client({
    host,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    for (const d of CONTAS)
      await inserirSeNaoExiste(client, "contas_bancarias", "con_descricao", d);
    for (const d of ORIGENS)
      await inserirSeNaoExiste(client, "origens", "ori_descricao", d);
    for (const d of RESPONSAVEIS)
      await inserirSeNaoExiste(client, "responsaveis", "res_nome", d);

    await client.query(
      "UPDATE contas_bancarias SET con_negativo_credito = true WHERE con_descricao = 'Cartão de Crédito Teste'",
    );

    await client.query(
      `INSERT INTO saldos_conta_bancaria (con_conta)
       SELECT con_conta FROM contas_bancarias
       ON CONFLICT (con_conta) DO NOTHING`,
    );

    await client.query("COMMIT");
    console.log("Seed de desenvolvimento concluído.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro no seed:", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

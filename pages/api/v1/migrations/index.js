import migrationRunner from "node-pg-migrate";
import { join } from "node:path";
import database from "infra/database.js";

export default async function migrations(req, res) {
  if (req.method === "GET" || req.method === "POST") {
    const dbClient = await database.getNewClient();
    const migrations = await migrationRunner({
      dbClient,
      databaseUrl: process.env.DATABASE_URL,
      dir: join("infra", "migrations"),
      dryRun: req.method === "GET",
      direction: "up",
      migrationsTable: "pgmigrations",
      defaultMigrationOptions: {
        transaction: true,
      },
    });
    await dbClient.end();
    res.status(migrations.length > 0 ? 201 : 200).json(migrations);
  } else {
    res.status(405).json({
      error: "Method Not Allowed",
    });
  }
}

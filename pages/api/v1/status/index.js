import database from "infra/database.js";

async function status(req, res) {
  const result = await database.query("SELECT 1 + 1 as soma;");
  res.status(200).json({ status: "ok", result: result.rows[0].soma });
}

export default status;

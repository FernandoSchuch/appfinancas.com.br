import database from "../../../../infra/database.js";

function status(req, res) {
  const result = database.query("SELECT 1 + 1;");
  console.log(result);
  res.status(200).json({ status: "ok" });
}

export default status;

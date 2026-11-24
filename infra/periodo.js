export function limitesDoMes(mes) {
  const [ano, mesNumero] = mes.split("-").map(Number);
  const inicio = `${mes}-01`;
  const fim =
    mesNumero === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mesNumero + 1).padStart(2, "0")}-01`;
  return { inicio, fim };
}

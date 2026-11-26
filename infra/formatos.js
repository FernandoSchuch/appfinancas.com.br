import {
  CODIFICACOES,
  FORMATOS_DATA,
  FORMATOS_VALOR,
  SEPARADORES,
} from "infra/importacao.js";

export const RETORNO_FORMATO = `
  fmt_formato::int AS id,
  fmt_nome AS nome,
  fmt_codificacao AS codificacao,
  fmt_separador AS separador,
  (fmt_cabecalho = 'S') AS cabecalho,
  fmt_linhas_pular AS "linhasPular",
  fmt_col_data AS "colData",
  fmt_col_descricao AS "colDescricao",
  fmt_valor_modo AS "valorModo",
  fmt_col_valor AS "colValor",
  fmt_col_debito AS "colDebito",
  fmt_col_credito AS "colCredito",
  fmt_formato_data AS "formatoData",
  fmt_formato_valor AS "formatoValor",
  fmt_ignorar AS ignorar
`;

const texto = (v) => (typeof v === "string" ? v.trim() : "");

export function lerFormato(body) {
  if (!body) return { erro: "Dados não informados" };

  const nome = texto(body.nome);
  if (!nome) return { erro: "Nome obrigatório" };
  if (nome.length > 100) return { erro: "Nome com no máximo 100 caracteres" };

  if (!CODIFICACOES.includes(body.codificacao))
    return { erro: "Codificação inválida" };
  if (
    body.separador !== "auto" &&
    !Object.hasOwn(SEPARADORES, body.separador)
  ) {
    return { erro: "Separador inválido" };
  }
  if (typeof body.cabecalho !== "boolean") {
    return { erro: "Informe se a primeira linha é cabeçalho" };
  }
  const linhasPular = body.linhasPular ?? 0;
  if (!Number.isInteger(linhasPular) || linhasPular < 0 || linhasPular > 100) {
    return { erro: "Linhas a pular deve ser de 0 a 100" };
  }
  if (!Object.hasOwn(FORMATOS_DATA, body.formatoData))
    return { erro: "Formato de data inválido" };
  if (!FORMATOS_VALOR.includes(body.formatoValor))
    return { erro: "Formato do valor inválido" };
  if (body.valorModo !== "unico" && body.valorModo !== "separado") {
    return { erro: "Modo do valor inválido" };
  }

  // sem cabeçalho a coluna é um número (1, 2, 3...); com cabeçalho, o nome da coluna
  const coluna = (valor, rotulo) => {
    const t = texto(valor);
    if (!t) return { erro: `Informe a coluna ${rotulo}` };
    if (t.length > 100)
      return { erro: `Coluna ${rotulo} com mais de 100 caracteres` };
    if (!body.cabecalho && !/^[1-9]\d{0,2}$/.test(t)) {
      return { erro: `Sem cabeçalho, a coluna ${rotulo} deve ser um número` };
    }
    return { valor: t };
  };

  const dados = {
    nome,
    codificacao: body.codificacao,
    separador: body.separador,
    cabecalho: body.cabecalho,
    linhasPular,
    formatoData: body.formatoData,
    formatoValor: body.formatoValor,
    valorModo: body.valorModo,
    colValor: null,
    colDebito: null,
    colCredito: null,
  };

  const campos = [
    ["colData", body.colData, "da data"],
    ["colDescricao", body.colDescricao, "da descrição"],
  ];
  if (body.valorModo === "unico") {
    campos.push(["colValor", body.colValor, "do valor"]);
  } else {
    campos.push(
      ["colDebito", body.colDebito, "do débito"],
      ["colCredito", body.colCredito, "do crédito"],
    );
  }
  for (const [chave, valor, rotulo] of campos) {
    const r = coluna(valor, rotulo);
    if (r.erro) return { erro: r.erro };
    dados[chave] = r.valor;
  }

  const ignorar = body.ignorar ?? [];
  if (!Array.isArray(ignorar) || ignorar.length > 50) {
    return { erro: "A lista de textos ignorados deve ter até 50 itens" };
  }
  const limpos = ignorar.map(texto).filter(Boolean);
  if (limpos.some((t) => t.length > 200)) {
    return { erro: "Cada texto ignorado deve ter no máximo 200 caracteres" };
  }
  dados.ignorar = limpos;

  return { dados };
}

// valores na ordem dos parâmetros $1..$14 usados no INSERT e no UPDATE
export function valoresFormato(d) {
  return [
    d.nome,
    d.codificacao,
    d.separador,
    d.cabecalho,
    d.linhasPular,
    d.colData,
    d.colDescricao,
    d.valorModo,
    d.colValor,
    d.colDebito,
    d.colCredito,
    d.formatoData,
    d.formatoValor,
    d.ignorar,
  ];
}

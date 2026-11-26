// Leitura genérica de arquivos CSV de extratos e faturas.
// Funções puras, sem dependências: rodam no navegador (leitura do arquivo e
// assistente de formatos) e podem ser testadas fora do Next.

export const SEPARADORES = {
  virgula: ",",
  ponto_virgula: ";",
  tab: "\t",
  barra: "|",
};

export const CODIFICACOES = ["auto", "utf-8", "windows-1252"];

export const FORMATOS_DATA = {
  "dd/mm/aaaa": {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T].*)?$/,
    ordem: ["d", "m", "a"],
  },
  "dd/mm/aa": {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:[ T].*)?$/,
    ordem: ["d", "m", "a"],
  },
  "mm/dd/aaaa": {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T].*)?$/,
    ordem: ["m", "d", "a"],
  },
  "aaaa-mm-dd": {
    regex: /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/,
    ordem: ["a", "m", "d"],
  },
  "dd-mm-aaaa": {
    regex: /^(\d{1,2})-(\d{1,2})-(\d{4})(?:[ T].*)?$/,
    ordem: ["d", "m", "a"],
  },
  "dd.mm.aaaa": {
    regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T].*)?$/,
    ordem: ["d", "m", "a"],
  },
};

export const FORMATOS_VALOR = ["virgula", "ponto"];

const TAMANHO_MAXIMO_DESCRICAO = 500;

const normalizar = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const linhaVazia = (linha) => linha.every((c) => c === "");

// Decodifica os bytes do arquivo. No modo automático tenta UTF-8 e, se houver
// bytes inválidos, usa Windows-1252 (comum em exportações de bancos).
export function decodificar(buffer, codificacao = "auto") {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let texto;
  let usada = codificacao;

  if (codificacao === "auto" || codificacao === "utf-8") {
    try {
      texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      usada = "utf-8";
    } catch {
      if (codificacao === "utf-8") {
        texto = new TextDecoder("utf-8").decode(bytes);
      } else {
        texto = new TextDecoder("windows-1252").decode(bytes);
        usada = "windows-1252";
      }
    }
  } else {
    texto = new TextDecoder(codificacao).decode(bytes);
  }
  return { texto: texto.replace(/^\uFEFF/, ""), codificacaoUsada: usada };
}

// Escolhe o separador que aparece o mesmo número de vezes na maioria das
// primeiras linhas.
export function detectarSeparador(texto) {
  const linhas = texto
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 10);
  let melhor = "virgula";
  let melhorPontos = 0;

  for (const [nome, caractere] of Object.entries(SEPARADORES)) {
    const contagens = linhas.map((l) => l.split(caractere).length - 1);
    const primeira = contagens[0];
    if (!primeira) continue;
    const consistentes = contagens.filter((n) => n === primeira).length;
    const pontos = consistentes * 1000 + primeira;
    if (pontos > melhorPontos) {
      melhor = nome;
      melhorPontos = pontos;
    }
  }
  return melhor;
}

// Divide o texto em linhas e colunas, respeitando aspas (inclusive aspas
// duplas escapadas e quebras de linha dentro de um campo entre aspas).
export function lerLinhasCsv(texto, separador) {
  const linhas = [];
  let linha = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"' && campo.trim() === "") {
      campo = "";
      entreAspas = true;
    } else if (c === separador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.map((l) => l.map((s) => s.trim()));
}

// Devolve a data como AAAA-MM-DD, ou null se não bater com o formato.
export function converterData(texto, formato) {
  const definicao = FORMATOS_DATA[formato];
  const partes =
    definicao &&
    String(texto ?? "")
      .trim()
      .match(definicao.regex);
  if (!partes) return null;

  const campos = {};
  definicao.ordem.forEach((chave, i) => {
    campos[chave] = Number(partes[i + 1]);
  });
  const ano = campos.a < 100 ? 2000 + campos.a : campos.a;
  const { m: mes, d: dia } = campos;

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Aceita "R$", espaços, sinal na frente ou atrás, parênteses e o menos tipográfico.
export function converterValor(texto, formatoValor) {
  let t = String(texto ?? "")
    .replace(/[\s\u00a0]/g, "")
    .replace(/R\$/gi, "")
    .replace(/[\u2212\u2013]/g, "-");
  if (t === "") return NaN;

  let sinal = 1;
  if (/^\(.*\)$/.test(t)) {
    sinal = -1;
    t = t.slice(1, -1);
  }
  if (t.endsWith("-")) {
    sinal = -1;
    t = t.slice(0, -1);
  }
  if (t.startsWith("-")) {
    sinal = -1;
    t = t.slice(1);
  } else if (t.startsWith("+")) {
    t = t.slice(1);
  }

  t =
    formatoValor === "virgula"
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(/,/g, "");

  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(t)) return NaN;
  const n = sinal * Number(t);
  return n === 0 ? 0 : n;
}

// Lê o texto do arquivo conforme o formato. Devolve o mesmo formato que a tela
// de importação já usa: { linhas, erros, ignoradas, mes }.
// negativoCredito só é usado quando débito e crédito vêm em colunas separadas.
export function lerComFormato(
  texto,
  formato,
  { negativoCredito = false } = {},
) {
  const resultado = {
    linhas: [],
    erros: [],
    ignoradas: [],
    mes: "",
    colunas: null,
  };

  const nomeSeparador =
    formato.separador === "auto" ? detectarSeparador(texto) : formato.separador;
  const separador = SEPARADORES[nomeSeparador];
  if (!separador) {
    resultado.erros.push("Separador do formato inválido");
    return resultado;
  }

  const todas = lerLinhasCsv(texto, separador);
  let posicao = Math.max(0, Number(formato.linhasPular) || 0);

  let cabecalho = null;
  if (formato.cabecalho) {
    while (posicao < todas.length && linhaVazia(todas[posicao])) posicao++;
    cabecalho = todas[posicao];
    posicao++;
    if (!cabecalho) {
      resultado.erros.push("Arquivo sem cabeçalho");
      return resultado;
    }
    resultado.colunas = cabecalho;
  }

  const cabecalhoNormalizado = cabecalho ? cabecalho.map(normalizar) : [];
  const problemas = [];
  const resolver = (especificacao, rotulo) => {
    if (cabecalho) {
      const indice = cabecalhoNormalizado.indexOf(normalizar(especificacao));
      if (indice < 0) {
        problemas.push(
          `Coluna "${especificacao}" (${rotulo}) não encontrada no cabeçalho. Colunas do arquivo: ${cabecalho.join(", ")}`,
        );
      }
      return indice;
    }
    const numero = Number(especificacao);
    if (!Number.isInteger(numero) || numero < 1) {
      problemas.push(
        `Número de coluna inválido para ${rotulo}: "${especificacao}"`,
      );
      return -1;
    }
    return numero - 1;
  };

  const iData = resolver(formato.colData, "data");
  const iDescricao = resolver(formato.colDescricao, "descrição");
  let iValor = -1;
  let iDebito = -1;
  let iCredito = -1;
  if (formato.valorModo === "separado") {
    iDebito = resolver(formato.colDebito, "débito");
    iCredito = resolver(formato.colCredito, "crédito");
  } else {
    iValor = resolver(formato.colValor, "valor");
  }
  if (problemas.length > 0) {
    resultado.erros.push(...problemas);
    return resultado;
  }

  const ignorar = (formato.ignorar || []).map((t) => normalizar(t));

  for (let r = posicao; r < todas.length; r++) {
    const linha = todas[r];
    if (linhaVazia(linha)) continue;
    const n = r + 1;

    const descricaoCompleta = (linha[iDescricao] ?? "").trim();
    if (ignorar.includes(normalizar(descricaoCompleta))) {
      const textoValor =
        formato.valorModo === "separado"
          ? [linha[iDebito], linha[iCredito]].filter(Boolean).join(" / ")
          : linha[iValor];
      resultado.ignoradas.push(
        `Linha ${n}: ${descricaoCompleta} (${textoValor ?? ""})`,
      );
      continue;
    }

    const data = converterData(linha[iData], formato.formatoData);
    if (!data) {
      resultado.erros.push(
        `Linha ${n}: data inválida ("${linha[iData] ?? ""}"; formato esperado ${formato.formatoData})`,
      );
      continue;
    }
    if (!descricaoCompleta) {
      resultado.erros.push(`Linha ${n}: descrição vazia`);
      continue;
    }

    let valor;
    if (formato.valorModo === "separado") {
      const debito = converterValor(linha[iDebito], formato.formatoValor);
      const credito = converterValor(linha[iCredito], formato.formatoValor);
      const temDebito = Number.isFinite(debito) && debito !== 0;
      const temCredito = Number.isFinite(credito) && credito !== 0;
      if (temDebito === temCredito) {
        resultado.erros.push(
          `Linha ${n}: informe só um valor, no débito ou no crédito`,
        );
        continue;
      }
      const modulo = Math.abs(temCredito ? credito : debito);
      // o sinal segue a convenção da conta: negativo é crédito ou débito
      const positivoEhCredito = !negativoCredito;
      valor = temCredito === positivoEhCredito ? modulo : -modulo;
    } else {
      valor = converterValor(linha[iValor], formato.formatoValor);
      if (!Number.isFinite(valor)) {
        resultado.erros.push(
          `Linha ${n}: valor inválido ("${linha[iValor] ?? ""}"; formato esperado ${formato.formatoValor === "virgula" ? "1.234,56" : "1234.56"})`,
        );
        continue;
      }
    }

    resultado.linhas.push({
      data,
      descricao: descricaoCompleta.slice(0, TAMANHO_MAXIMO_DESCRICAO),
      valor,
      origem: "",
      responsavel: "",
      previsao: null,
    });
  }

  if (resultado.erros.length === 0 && resultado.linhas.length === 0) {
    resultado.erros.push("Arquivo sem transações");
  }

  const meses = [
    ...new Set(resultado.linhas.map((l) => l.data.slice(0, 7))),
  ].sort();
  if (meses.length > 1) {
    resultado.erros.push(
      `O arquivo tem movimentos de meses diferentes (${meses.join(", ")})`,
    );
  }
  resultado.mes = meses.length === 1 ? meses[0] : "";
  return resultado;
}

// Propõe um formato a partir de um arquivo de amostra (usado pelo assistente).
export function detectarFormato(texto) {
  const avisos = [];
  const separador = detectarSeparador(texto);
  const todas = lerLinhasCsv(texto, SEPARADORES[separador]).filter(
    (l) => !linhaVazia(l),
  );
  if (todas.length === 0) return null;

  const pareceData = (s) =>
    Object.keys(FORMATOS_DATA).some((f) => converterData(s, f));
  const pareceNumero = (s) =>
    Number.isFinite(converterValor(s, "virgula")) ||
    Number.isFinite(converterValor(s, "ponto"));

  const cabecalho = !todas[0].some(pareceData);
  const dados = todas.slice(cabecalho ? 1 : 0, (cabecalho ? 1 : 0) + 30);
  const largura = Math.max(...todas.slice(0, 31).map((l) => l.length));

  const valoresDe = (c) => dados.map((l) => l[c] ?? "").filter((v) => v !== "");
  const fracao = (valores, teste) =>
    valores.length === 0 ? 0 : valores.filter(teste).length / valores.length;
  const nomeColuna = (c) => (cabecalho ? todas[0][c] : String(c + 1));
  const nomesNormalizados = cabecalho ? todas[0].map(normalizar) : [];

  // data
  let indiceData = -1;
  for (let c = 0; c < largura && indiceData < 0; c++) {
    if (fracao(valoresDe(c), pareceData) >= 0.8) indiceData = c;
  }
  let formatoData = "dd/mm/aaaa";
  if (indiceData >= 0) {
    let melhor = 0;
    for (const f of Object.keys(FORMATOS_DATA)) {
      const acertos = valoresDe(indiceData).filter((v) =>
        converterData(v, f),
      ).length;
      if (acertos > melhor) {
        melhor = acertos;
        formatoData = f;
      }
    }
  } else {
    avisos.push("Não encontrei a coluna da data");
  }

  // valor: uma coluna com sinal ou débito e crédito separados
  let valorModo = "unico";
  let indiceValor = -1;
  let indiceDebito = -1;
  let indiceCredito = -1;

  if (cabecalho) {
    indiceDebito = nomesNormalizados.findIndex((n) => n.includes("debito"));
    indiceCredito = nomesNormalizados.findIndex((n) => n.includes("credito"));
    if (
      indiceDebito >= 0 &&
      indiceCredito >= 0 &&
      indiceDebito !== indiceCredito
    ) {
      valorModo = "separado";
    } else {
      indiceDebito = -1;
      indiceCredito = -1;
    }
  }

  if (valorModo === "unico") {
    let melhorPontos = -1;
    for (let c = 0; c < largura; c++) {
      if (c === indiceData) continue;
      const valores = valoresDe(c);
      if (valores.length === 0 || fracao(valores, pareceNumero) < 0.8) continue;
      let pontos = 0;
      if (
        cabecalho &&
        /valor|amount|quantia|montante|value/.test(nomesNormalizados[c])
      )
        pontos += 100;
      if (valores.some((v) => /[.,]\d{1,2}$/.test(v.replace(/\s/g, ""))))
        pontos += 10;
      if (pontos > melhorPontos) {
        melhorPontos = pontos;
        indiceValor = c;
      }
    }
    if (indiceValor < 0) avisos.push("Não encontrei a coluna do valor");
  }

  // formato do número: vírgula ou ponto como separador decimal
  const colunasValor =
    valorModo === "separado" ? [indiceDebito, indiceCredito] : [indiceValor];
  const amostrasValor = colunasValor
    .filter((c) => c >= 0)
    .flatMap((c) => valoresDe(c))
    .map((v) => v.replace(/[\s\u00a0]/g, ""));
  const comVirgula = amostrasValor.filter((v) =>
    /,\d{1,2}\)?-?$/.test(v),
  ).length;
  const comPonto = amostrasValor.filter((v) =>
    /\.\d{1,2}\)?-?$/.test(v),
  ).length;
  const formatoValor = comPonto > comVirgula ? "ponto" : "virgula";

  // descrição: a coluna de texto mais provável entre as que sobraram
  const usadas = new Set([
    indiceData,
    indiceValor,
    indiceDebito,
    indiceCredito,
  ]);
  let indiceDescricao = -1;
  let melhorPontosDescricao = -1;
  for (let c = 0; c < largura; c++) {
    if (usadas.has(c)) continue;
    const valores = valoresDe(c);
    if (valores.length === 0) continue;
    const media = valores.reduce((s, v) => s + v.length, 0) / valores.length;
    const pontos =
      (cabecalho &&
      /descri|titulo|title|historico|lancamento|memo|detalhe/.test(
        nomesNormalizados[c],
      )
        ? 1000
        : 0) + media;
    if (pontos > melhorPontosDescricao) {
      melhorPontosDescricao = pontos;
      indiceDescricao = c;
    }
  }
  if (indiceDescricao < 0) avisos.push("Não encontrei a coluna da descrição");

  return {
    formato: {
      nome: "",
      codificacao: "auto",
      separador,
      cabecalho,
      linhasPular: 0,
      colData: indiceData >= 0 ? nomeColuna(indiceData) : "",
      colDescricao: indiceDescricao >= 0 ? nomeColuna(indiceDescricao) : "",
      valorModo,
      colValor:
        valorModo === "unico" && indiceValor >= 0
          ? nomeColuna(indiceValor)
          : "",
      colDebito: valorModo === "separado" ? nomeColuna(indiceDebito) : "",
      colCredito: valorModo === "separado" ? nomeColuna(indiceCredito) : "",
      formatoData,
      formatoValor,
      ignorar: [],
    },
    avisos,
  };
}

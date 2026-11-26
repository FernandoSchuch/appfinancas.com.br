/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createSequence("seq_formatos_importacao", { maxvalue: 99999 });
  pgm.createTable("formatos_importacao", {
    fmt_formato: {
      type: "numeric(5)",
      notNull: true,
      default: pgm.func("nextval('seq_formatos_importacao')"),
    },
    fmt_nome: { type: "varchar(100)", notNull: true },
    fmt_codificacao: { type: "varchar(20)", notNull: true, default: "auto" },
    fmt_separador: { type: "varchar(20)", notNull: true, default: "auto" },
    fmt_cabecalho: { type: "char(1)", notNull: true, default: "S" },
    fmt_linhas_pular: { type: "integer", notNull: true, default: 0 },
    fmt_col_data: { type: "varchar(100)", notNull: true },
    fmt_col_descricao: { type: "varchar(100)", notNull: true },
    fmt_valor_modo: { type: "varchar(10)", notNull: true, default: "unico" },
    fmt_col_valor: { type: "varchar(100)" },
    fmt_col_debito: { type: "varchar(100)" },
    fmt_col_credito: { type: "varchar(100)" },
    fmt_formato_data: { type: "varchar(20)", notNull: true },
    fmt_formato_valor: {
      type: "varchar(10)",
      notNull: true,
      default: "virgula",
    },
    fmt_ignorar: {
      type: "text[]",
      notNull: true,
      default: pgm.func("'{}'::text[]"),
    },
  });
  pgm.addConstraint("formatos_importacao", "pk_fmt", {
    primaryKey: "fmt_formato",
  });
  pgm.addConstraint("formatos_importacao", "ck_fmt_cabecalho", {
    check: "fmt_cabecalho IN ('S', 'N')",
  });
  pgm.addConstraint("formatos_importacao", "ck_fmt_valor_modo", {
    check: "fmt_valor_modo IN ('unico', 'separado')",
  });

  // formato de importação padrão da conta (opcional)
  pgm.addColumn("contas_bancarias", { con_formato: { type: "numeric(5)" } });
  pgm.addConstraint("contas_bancarias", "fk_con_fmt", {
    foreignKeys: {
      columns: "con_formato",
      references: "formatos_importacao(fmt_formato)",
    },
  });

  // formatos que você já usa
  pgm.sql(`
    INSERT INTO formatos_importacao
      (fmt_nome, fmt_col_data, fmt_col_descricao, fmt_col_valor, fmt_formato_data, fmt_formato_valor, fmt_ignorar)
    VALUES
      ('Nubank cartão', 'date', 'title', 'amount', 'aaaa-mm-dd', 'virgula', ARRAY['pagamento recebido']),
      ('Nubank conta', 'Data', 'Descrição', 'Valor', 'dd/mm/aaaa', 'ponto', '{}');
  `);

  // as contas marcadas como "negativo é crédito" (cartões) já ficam com o formato do cartão
  pgm.sql(`
    UPDATE contas_bancarias
    SET con_formato = (SELECT fmt_formato FROM formatos_importacao WHERE fmt_nome = 'Nubank cartão')
    WHERE con_negativo_credito;
  `);

  // descrições longas (Pix passa de 150 caracteres): amplia só se a coluna for menor que 500
  pgm.sql(`
    DO $$
    DECLARE tamanho integer;
    BEGIN
      SELECT character_maximum_length INTO tamanho
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'movimentos'
        AND column_name = 'mov_descricao';

      IF tamanho IS NOT NULL AND tamanho < 500 THEN
        ALTER TABLE movimentos ALTER COLUMN mov_descricao TYPE varchar(500);
      END IF;
    END
    $$;
  `);
};

exports.down = (pgm) => {};

/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("movimentos", {
    mov_natureza: { type: "char(1)", notNull: true, default: "I" },
  });
  pgm.addConstraint("movimentos", "ck_mov_natureza", {
    check: "mov_natureza IN ('I', 'P', 'M')",
  });

  // a trigger antiga sai primeiro: a conversão abaixo não pode mexer no saldo
  pgm.sql(`DROP TRIGGER IF EXISTS tg_aiud_mov ON movimentos;`);

  // converte o que já existir e remove mov_previsao (se a coluna existir)
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'movimentos'
          AND column_name = 'mov_previsao'
      ) THEN
        EXECUTE 'UPDATE movimentos SET mov_natureza = ''P'' WHERE mov_previsao';
        EXECUTE 'ALTER TABLE movimentos DROP COLUMN mov_previsao';
      END IF;
    END
    $$;
  `);

  // só a natureza P fica fora do saldo (I e M movimentam)
  pgm.sql(`
    CREATE OR REPLACE FUNCTION tg_aiud_mov()
    RETURNS trigger AS $$
    BEGIN
      IF TG_OP IN ('UPDATE', 'DELETE') THEN
        IF OLD.mov_natureza <> 'P' THEN
          PERFORM fn_sal_aplicar(
            OLD.con_conta,
            CASE OLD.mov_tipo WHEN 'C' THEN -OLD.mov_valor ELSE OLD.mov_valor END
          );
        END IF;
      END IF;

      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NEW.mov_natureza <> 'P' THEN
          PERFORM fn_sal_aplicar(
            NEW.con_conta,
            CASE NEW.mov_tipo WHEN 'C' THEN NEW.mov_valor ELSE -NEW.mov_valor END
          );
        END IF;
      END IF;

      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER tg_aiud_mov
    AFTER INSERT OR DELETE OR UPDATE OF mov_valor, mov_tipo, con_conta, mov_natureza
    ON movimentos
    FOR EACH ROW EXECUTE FUNCTION tg_aiud_mov();
  `);
};

exports.down = (pgm) => {};

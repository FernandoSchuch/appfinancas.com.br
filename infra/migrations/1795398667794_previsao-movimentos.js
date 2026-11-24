/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("movimentos", {
    mov_previsao: { type: "boolean", notNull: true, default: false },
  });

  // A previsão nunca entra no saldo: a trigger só aplica (e só desfaz)
  // linhas com mov_previsao = false.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION tg_aiud_mov()
    RETURNS trigger AS $$
    BEGIN
      IF TG_OP IN ('UPDATE', 'DELETE') THEN
        IF NOT OLD.mov_previsao THEN
          PERFORM fn_sal_aplicar(
            OLD.con_conta,
            CASE OLD.mov_tipo WHEN 'C' THEN -OLD.mov_valor ELSE OLD.mov_valor END
          );
        END IF;
      END IF;

      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NOT NEW.mov_previsao THEN
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

  // recria a trigger para incluir mov_previsao nas colunas que a disparam no UPDATE
  pgm.sql(`DROP TRIGGER IF EXISTS tg_aiud_mov ON movimentos;`);
  pgm.sql(`
    CREATE TRIGGER tg_aiud_mov
    AFTER INSERT OR DELETE OR UPDATE OF mov_valor, mov_tipo, con_conta, mov_previsao
    ON movimentos
    FOR EACH ROW EXECUTE FUNCTION tg_aiud_mov();
  `);
};

exports.down = (pgm) => {};

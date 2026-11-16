/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Auxiliar (não é trigger): soma/subtrai um valor no saldo da conta
  pgm.sql(`
    CREATE OR REPLACE FUNCTION fn_sal_aplicar(p_conta numeric, p_valor numeric)
    RETURNS void AS $$
    BEGIN
      INSERT INTO saldos_conta_bancaria (con_conta, sal_valor, sal_atualizacao)
      VALUES (p_conta, p_valor, now())
      ON CONFLICT (con_conta) DO UPDATE
        SET sal_valor       = saldos_conta_bancaria.sal_valor + EXCLUDED.sal_valor,
            sal_atualizacao = now();
    END;
    $$ LANGUAGE plpgsql;
  `);

  // movimentos: after insert, delete ou update de valor/tipo/conta
  pgm.sql(`
    CREATE OR REPLACE FUNCTION tg_aiud_mov()
    RETURNS trigger AS $$
    BEGIN
      IF TG_OP IN ('UPDATE', 'DELETE') THEN
        PERFORM fn_sal_aplicar(
          OLD.con_conta,
          CASE OLD.mov_tipo WHEN 'C' THEN -OLD.mov_valor ELSE OLD.mov_valor END
        );
      END IF;

      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM fn_sal_aplicar(
          NEW.con_conta,
          CASE NEW.mov_tipo WHEN 'C' THEN NEW.mov_valor ELSE -NEW.mov_valor END
        );
      END IF;

      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER tg_aiud_mov
    AFTER INSERT OR DELETE OR UPDATE OF mov_valor, mov_tipo, con_conta
    ON movimentos
    FOR EACH ROW EXECUTE FUNCTION tg_aiud_mov();
  `);

  // contas_bancarias: after insert, cria o saldo zerado
  pgm.sql(`
    CREATE OR REPLACE FUNCTION tg_ai_con()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO saldos_conta_bancaria (con_conta) VALUES (NEW.con_conta);
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER tg_ai_con
    AFTER INSERT ON contas_bancarias
    FOR EACH ROW EXECUTE FUNCTION tg_ai_con();
  `);
};

exports.down = (pgm) => {};

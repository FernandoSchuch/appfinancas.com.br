/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createSequence("seq_movimentos", { maxvalue: 9999999999 });
  pgm.createTable("movimentos", {
    mov_movimento: {
      type: "numeric(10)",
      notNull: true,
      default: pgm.func("nextval('seq_movimentos')"),
    },
    mov_data: { type: "timestamp", notNull: true },
    mov_valor: { type: "numeric(16,2)", notNull: true },
    mov_descricao: { type: "varchar(1000)" },
    mov_tipo: { type: "varchar(1)", notNull: true },
    ori_origem: { type: "numeric(5)", notNull: true },
    res_responsavel: { type: "numeric(5)", notNull: true },
    con_conta: { type: "numeric(5)", notNull: true },
  });
  pgm.addConstraint("movimentos", "pk_mov", { primaryKey: "mov_movimento" });
  pgm.addConstraint("movimentos", "ck_mov_tipo", {
    check: "mov_tipo IN ('C', 'D')",
  });
  pgm.addConstraint("movimentos", "ck_mov_valor", { check: "mov_valor > 0" });
  pgm.addConstraint("movimentos", "fk_mov_ori", {
    foreignKeys: { columns: "ori_origem", references: "origens(ori_origem)" },
  });
  pgm.addConstraint("movimentos", "fk_mov_res", {
    foreignKeys: {
      columns: "res_responsavel",
      references: "responsaveis(res_responsavel)",
    },
  });
  pgm.addConstraint("movimentos", "fk_mov_con", {
    foreignKeys: {
      columns: "con_conta",
      references: "contas_bancarias(con_conta)",
    },
  });
};

exports.down = (pgm) => {};

/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("saldos_conta_bancaria", {
    con_conta: { type: "numeric(5)", notNull: true },
    sal_valor: { type: "numeric(16,2)", notNull: true, default: 0 },
    sal_atualizacao: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
  });
  pgm.addConstraint("saldos_conta_bancaria", "pk_sal", {
    primaryKey: "con_conta",
  });
  pgm.addConstraint("saldos_conta_bancaria", "fk_sal_con", {
    foreignKeys: {
      columns: "con_conta",
      references: "contas_bancarias(con_conta)",
    },
  });
};

exports.down = (pgm) => {};

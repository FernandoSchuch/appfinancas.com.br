/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // ORIGENS
  pgm.createSequence("seq_origens", { maxvalue: 99999 });
  pgm.createTable("origens", {
    ori_origem: {
      type: "numeric(5)",
      notNull: true,
      default: pgm.func("nextval('seq_origens')"),
    },
    ori_descricao: { type: "varchar(100)", notNull: true },
  });
  pgm.addConstraint("origens", "pk_ori", { primaryKey: "ori_origem" });

  // RESPONSAVEIS
  pgm.createSequence("seq_responsaveis", { maxvalue: 99999 });
  pgm.createTable("responsaveis", {
    res_responsavel: {
      type: "numeric(5)",
      notNull: true,
      default: pgm.func("nextval('seq_responsaveis')"),
    },
    res_nome: { type: "varchar(100)", notNull: true },
  });
  pgm.addConstraint("responsaveis", "pk_res", {
    primaryKey: "res_responsavel",
  });

  // CONTAS_BANCARIAS
  pgm.createSequence("seq_contas_bancarias", { maxvalue: 99999 });
  pgm.createTable("contas_bancarias", {
    con_conta: {
      type: "numeric(5)",
      notNull: true,
      default: pgm.func("nextval('seq_contas_bancarias')"),
    },
    con_descricao: { type: "varchar(100)", notNull: true },
  });
  pgm.addConstraint("contas_bancarias", "pk_con", { primaryKey: "con_conta" });
};

exports.down = (pgm) => {};

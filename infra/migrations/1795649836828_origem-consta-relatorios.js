/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("origens", {
    ori_consta_relatorios: { type: "char(1)", notNull: true, default: "S" },
  });
  pgm.addConstraint("origens", "ck_ori_consta_relatorios", {
    check: "ori_consta_relatorios IN ('S', 'N')",
  });

  // inverte o que existe hoje: quem era "ignorar" passa a "não consta" (N)
  pgm.sql(
    `UPDATE origens SET ori_consta_relatorios = 'N' WHERE ori_ignorar_relatorios`,
  );

  pgm.dropColumn("origens", "ori_ignorar_relatorios");
};

exports.down = (pgm) => {};

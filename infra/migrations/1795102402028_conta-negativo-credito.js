/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("contas_bancarias", {
    con_negativo_credito: { type: "boolean", notNull: true, default: false },
  });
};

exports.down = (pgm) => {};

/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("origens", {
    ori_ignorar_relatorios: { type: "boolean", notNull: true, default: false },
  });
};

exports.down = (pgm) => {};

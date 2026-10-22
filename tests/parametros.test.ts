import { describe, expect, it } from "vitest";
import { validarParametros } from "../src/dominio/parametros.js";

describe("parâmetros globais", () => {
  it("aceita valores dentro dos limites", () => {
    expect(() =>
      validarParametros({
        aliquotaImpostos: 0.18,
        coeficienteDepreciacao: 0.2,
        valorBaseDepreciacao: 1000,
      }),
    ).not.toThrow();
  });

  it("aceita os limites 0 e 1 e ignora o que não foi informado", () => {
    expect(() => validarParametros({ aliquotaImpostos: 0 })).not.toThrow();
    expect(() => validarParametros({ coeficienteDepreciacao: 1 })).not.toThrow();
    expect(() => validarParametros({})).not.toThrow();
  });

  it("rejeita alíquota fora de 0 a 1", () => {
    expect(() => validarParametros({ aliquotaImpostos: 1.5 })).toThrow(
      "A alíquota de impostos deve estar entre 0 e 1.",
    );
    expect(() => validarParametros({ aliquotaImpostos: -0.1 })).toThrow();
  });

  it("rejeita coeficiente fora de 0 a 1", () => {
    expect(() => validarParametros({ coeficienteDepreciacao: 2 })).toThrow(
      "O coeficiente de depreciação deve estar entre 0 e 1.",
    );
  });

  it("rejeita valor-base zero, negativo ou não numérico", () => {
    expect(() => validarParametros({ valorBaseDepreciacao: 0 })).toThrow(
      "O valor-base de depreciação deve ser maior que zero.",
    );
    expect(() => validarParametros({ valorBaseDepreciacao: -5 })).toThrow();
    expect(() => validarParametros({ valorBaseDepreciacao: NaN })).toThrow();
  });
});

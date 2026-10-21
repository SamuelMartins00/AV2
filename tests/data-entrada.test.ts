import { describe, expect, it } from "vitest";
import { mensagemErroDataEntrada } from "../src/dominio/validadores/data-entrada.js";

const agora = new Date("2026-10-20T12:00:00Z");

describe("validação da data de entrada do lote", () => {
  it("aceita a data de hoje e datas dentro dos últimos 90 dias", () => {
    expect(mensagemErroDataEntrada(new Date("2026-10-20T10:00:00Z"), agora)).toBeNull();
    expect(mensagemErroDataEntrada(new Date("2026-08-01T00:00:00Z"), agora)).toBeNull();
  });

  it("rejeita datas futuras", () => {
    expect(mensagemErroDataEntrada(new Date("2026-10-21T00:00:00Z"), agora)).toBe(
      "A data de entrada não pode ser futura.",
    );
  });

  it("rejeita datas anteriores a 90 dias", () => {
    expect(mensagemErroDataEntrada(new Date("2026-07-01T00:00:00Z"), agora)).toBe(
      "A data de entrada não pode ser anterior a 90 dias.",
    );
  });

  it("rejeita datas inválidas", () => {
    expect(mensagemErroDataEntrada(new Date("não é data"), agora)).toBe(
      "A data de entrada informada é inválida.",
    );
  });
});

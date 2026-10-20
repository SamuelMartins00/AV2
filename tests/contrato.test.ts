import { describe, expect, it } from "vitest";
import {
  contratoEstaVigente,
  lerData,
  validarContrato,
  validarRenovacao,
} from "../src/dominio/contrato.js";
import { ErroDominio } from "../src/dominio/erros.js";

const d = (texto: string) => new Date(texto);

describe("regras de contrato", () => {
  it("aceita vencimento posterior à assinatura", () => {
    expect(() =>
      validarContrato(d("2026-01-01"), d("2027-01-01"), 1500),
    ).not.toThrow();
  });

  it("rejeita vencimento anterior ou igual à assinatura", () => {
    expect(() =>
      validarContrato(d("2026-01-01"), d("2026-01-01"), 1500),
    ).toThrow(ErroDominio);
  });

  it("rejeita valor mensal negativo", () => {
    expect(() =>
      validarContrato(d("2026-01-01"), d("2027-01-01"), -1),
    ).toThrow("O valor mensal do contrato é inválido.");
  });

  it("exige que a renovação seja posterior ao vencimento atual", () => {
    expect(() =>
      validarRenovacao(d("2027-01-01"), d("2027-06-01")),
    ).not.toThrow();
    expect(() => validarRenovacao(d("2027-01-01"), d("2027-01-01"))).toThrow(
      "A nova data de vencimento deve ser posterior à atual.",
    );
  });

  it("calcula a vigência pela data de referência", () => {
    const assinatura = d("2026-01-01");
    const vencimento = d("2027-01-01");
    expect(contratoEstaVigente(assinatura, vencimento, d("2026-06-01"))).toBe(
      true,
    );
    expect(contratoEstaVigente(assinatura, vencimento, d("2027-06-01"))).toBe(
      false,
    );
  });

  it("rejeita datas inválidas com status 400", () => {
    expect(() => lerData("não é data", "Data de vencimento")).toThrow(
      "Data de vencimento inválida.",
    );
  });
});
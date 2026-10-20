import { describe, expect, it } from "vitest";
import {
  mensagemErroCNPJ,
  normalizarCNPJ,
} from "../src/dominio/validadores/cnpj.js";

describe("validação de CNPJ", () => {
  it("aceita CNPJs válidos, com ou sem máscara", () => {
    expect(mensagemErroCNPJ("11.222.333/0001-81")).toBeNull();
    expect(mensagemErroCNPJ("45246333000133")).toBeNull();
    expect(mensagemErroCNPJ("00.000.000/0001-91")).toBeNull();
  });

  it("rejeita quantidade de dígitos incorreta", () => {
    expect(mensagemErroCNPJ("1122233300018")).toBe(
      "O CNPJ deve possuir 14 dígitos.",
    );
  });

  it("rejeita sequências de dígitos repetidos", () => {
    expect(mensagemErroCNPJ("11111111111111")).toBe(
      "O CNPJ informado é inválido.",
    );
  });

  it("rejeita dígitos verificadores errados", () => {
    expect(mensagemErroCNPJ("11.222.333/0001-82")).toBe(
      "Os dígitos verificadores do CNPJ são inválidos.",
    );
  });

  it("normaliza removendo tudo que não é dígito", () => {
    expect(normalizarCNPJ("11.222.333/0001-81")).toBe("11222333000181");
  });
});
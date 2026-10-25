import { describe, expect, it } from "vitest";
import { normalizarNomeExibicao, validarPaginacao } from "../src/modules/usuarios/usuarios.politica.js";

describe("políticas de gestão de usuários", () => {
  it("normaliza espaços externos sem alterar o conteúdo interno do nome", () => {
    expect(normalizarNomeExibicao("  Ana Silva  ")).toBe("Ana Silva");
  });

  it("rejeita nomes vazios, curtos ou acima do limite", () => {
    expect(() => normalizarNomeExibicao("  ")).toThrow();
    expect(() => normalizarNomeExibicao("A")).toThrow();
    expect(() => normalizarNomeExibicao("A".repeat(101))).toThrow();
    expect(normalizarNomeExibicao("A".repeat(100))).toHaveLength(100);
  });

  it("usa paginação padrão e aceita o limite máximo", () => {
    expect(validarPaginacao()).toEqual({ page: 1, limit: 20 });
    expect(validarPaginacao(3, 100)).toEqual({ page: 3, limit: 100 });
  });

  it("rejeita paginação inválida", () => {
    expect(() => validarPaginacao(0, 20)).toThrow();
    expect(() => validarPaginacao(1.5, 20)).toThrow();
    expect(() => validarPaginacao(1, 101)).toThrow();
    expect(() => validarPaginacao(1, 0)).toThrow();
  });
});

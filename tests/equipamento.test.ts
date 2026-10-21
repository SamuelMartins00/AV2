import { describe, expect, it } from "vitest";
import {
  calcularDepreciacao,
  gerarCodigoBarras,
  indiceEstado,
  validarMovimentacao,
  validarMudancaEstado,
  validarMudancaStatus,
} from "../src/dominio/equipamento.js";
import { ErroDominio } from "../src/dominio/erros.js";

describe("estado físico", () => {
  it("ordena do melhor para o pior estado", () => {
    expect(indiceEstado("NOVO")).toBe(0);
    expect(indiceEstado("INSERVIVEL")).toBe(6);
  });

  it("exige justificativa quando o estado piora 2 ou mais categorias", () => {
    expect(() => validarMudancaEstado("NOVO", "USADO_LEVE", "")).toThrow(
      "É obrigatória uma justificativa quando o estado físico piora duas ou mais categorias.",
    );
    expect(() =>
      validarMudancaEstado("NOVO", "USADO_LEVE", "Caiu no transporte"),
    ).not.toThrow();
  });

  it("não exige justificativa para piora de 1 categoria nem para melhora", () => {
    expect(() => validarMudancaEstado("NOVO", "BOM_ESTADO", "")).not.toThrow();
    expect(() => validarMudancaEstado("USADO_LEVE", "NOVO", "")).not.toThrow();
  });
});

describe("status de rastreamento", () => {
  it("só permite EM_DESMONTE a partir de AGUARDANDO_DESMONTE", () => {
    expect(() =>
      validarMudancaStatus("AGUARDANDO_TRIAGEM", "EM_DESMONTE", "Teste"),
    ).toThrow("O equipamento só pode entrar em desmonte após a triagem completa.");
    expect(() =>
      validarMudancaStatus("AGUARDANDO_DESMONTE", "EM_DESMONTE", "Teste"),
    ).not.toThrow();
  });

  it("exige justificativa em toda mudança de status", () => {
    expect(() =>
      validarMudancaStatus("AGUARDANDO_TRIAGEM", "EM_TRIAGEM", "   "),
    ).toThrow("A justificativa não pode ser vazia.");
  });

  it("devolve erro de domínio com status 409 na regra de triagem", () => {
    try {
      validarMudancaStatus("EM_TRIAGEM", "EM_DESMONTE", "Teste");
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).statusCode).toBe(409);
    }
  });
});

describe("movimentação", () => {
  it("exige destino e responsável", () => {
    expect(() => validarMovimentacao("  ", "ana", "AGUARDANDO_TRIAGEM")).toThrow(
      "O destino da movimentação é obrigatório.",
    );
    expect(() => validarMovimentacao("Doca 1", " ", "AGUARDANDO_TRIAGEM")).toThrow(
      "O responsável pela movimentação é obrigatório.",
    );
  });

  it("bloqueia destino de desmontagem antes da triagem", () => {
    expect(() =>
      validarMovimentacao("Bancada de Desmontagem", "ana", "AGUARDANDO_TRIAGEM"),
    ).toThrow("O equipamento só pode ser movimentado para desmontagem após a triagem.");
    expect(() =>
      validarMovimentacao("Bancada de Desmontagem", "ana", "AGUARDANDO_DESMONTE"),
    ).not.toThrow();
    expect(() =>
      validarMovimentacao("Bancada de Desmontagem", "ana", "EM_DESMONTE"),
    ).not.toThrow();
  });

  it("permite outros destinos em qualquer status", () => {
    expect(() =>
      validarMovimentacao("Estoque A", "ana", "AGUARDANDO_TRIAGEM"),
    ).not.toThrow();
  });
});

describe("código de barras", () => {
  it("formata TIPO-000001", () => {
    expect(gerarCodigoBarras("NOTEBOOK", 1)).toBe("NOTEBOOK-000001");
    expect(gerarCodigoBarras("COMPUTADOR_MESA", 123)).toBe("COMPUTADOR_MESA-000123");
  });

  it("rejeita sequência inválida", () => {
    expect(() => gerarCodigoBarras("NOTEBOOK", 0)).toThrow(
      "A sequência do código de barras deve ser um número inteiro positivo.",
    );
    expect(() => gerarCodigoBarras("NOTEBOOK", 1.5)).toThrow();
  });
});

describe("depreciação", () => {
  const base = { coeficiente: 0.2, valorBase: 1000, anoFabricacao: 2024, anoReferencia: 2026 };

  it("calcula a depreciação acumulada", () => {
    // residual = 1000 * 0,8^2 * 1 = 640 -> depreciação 360
    expect(calcularDepreciacao({ ...base, estado: "NOVO" })).toBe(360);
    // residual = 1000 * 0,64 * 0,84 = 537,6 -> depreciação 462,4
    expect(calcularDepreciacao({ ...base, estado: "USADO_LEVE" })).toBe(462.4);
  });

  it("não deprecia por anos futuros", () => {
    expect(
      calcularDepreciacao({ ...base, anoFabricacao: 2030, estado: "NOVO" }),
    ).toBe(0);
  });

  it("valida os parâmetros", () => {
    expect(() => calcularDepreciacao({ ...base, coeficiente: 1.5, estado: "NOVO" })).toThrow(
      "O coeficiente de depreciação deve estar entre 0 e 1.",
    );
    expect(() => calcularDepreciacao({ ...base, valorBase: 0, estado: "NOVO" })).toThrow(
      "O valor-base de depreciação deve ser maior que zero.",
    );
  });
});

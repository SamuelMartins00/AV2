import { describe, expect, it } from "vitest";
import { resumirContratos } from "../src/dominio/financeiro.js";

describe("resumo financeiro dos contratos", () => {
  it("calcula total, média e imposto estimado", () => {
    const resumo = resumirContratos([1500.5, 900], 0.18);
    expect(resumo.valorMensalTotal).toBe(2400.5);
    expect(resumo.valorMensalMedio).toBe(1200.25);
    expect(resumo.impostoEstimado).toBe(432.09);
  });

  it("não acumula erro de ponto flutuante", () => {
    // 0,1 + 0,2 em ponto flutuante dá 0,30000000000000004
    expect(resumirContratos([0.1, 0.2], 0).valorMensalTotal).toBe(0.3);
  });

  it("devolve zeros quando não há contratos", () => {
    expect(resumirContratos([], 0.18)).toEqual({
      valorMensalTotal: 0,
      valorMensalMedio: 0,
      impostoEstimado: 0,
    });
  });
});

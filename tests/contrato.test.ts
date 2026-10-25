import { describe, expect, it } from "vitest";
import {
  adicionarMesesCalendario,
  contratoElegivelRenovacaoAutomatica,
  contratoEstaVigente,
  lerData,
  validarContrato,
  validarDuracaoRenovacaoMeses,
  validarRenovacao,
} from "../src/dominio/contrato.js";
import { ErroDominio } from "../src/dominio/erros.js";

const d = (texto: string) => new Date(texto);

describe("regras de contrato", () => {
  it("aceita vencimento posterior à assinatura", () => {
    expect(() => validarContrato(d("2026-01-01"), d("2027-01-01"), 1500)).not.toThrow();
  });

  it("rejeita vencimento anterior ou igual à assinatura", () => {
    expect(() => validarContrato(d("2026-01-01"), d("2026-01-01"), 1500)).toThrow(ErroDominio);
  });

  it("rejeita valor mensal negativo", () => {
    expect(() => validarContrato(d("2026-01-01"), d("2027-01-01"), -1)).toThrow("O valor mensal do contrato é inválido.");
  });

  it("exige que a renovação seja posterior ao vencimento atual", () => {
    expect(() => validarRenovacao(d("2027-01-01"), d("2027-06-01"))).not.toThrow();
    expect(() => validarRenovacao(d("2027-01-01"), d("2027-01-01"))).toThrow("A nova data de vencimento deve ser posterior à atual.");
  });

  it("calcula a vigência pela data de referência", () => {
    const assinatura = d("2026-01-01");
    const vencimento = d("2027-01-01");
    expect(contratoEstaVigente(assinatura, vencimento, d("2026-06-01"))).toBe(true);
    expect(contratoEstaVigente(assinatura, vencimento, d("2027-06-01"))).toBe(false);
  });

  it("rejeita datas inválidas com status 400", () => {
    expect(() => lerData("não é data", "Data de vencimento")).toThrow("Data de vencimento inválida.");
  });

  it("exige duração de renovação como inteiro positivo", () => {
    expect(() => validarDuracaoRenovacaoMeses(12)).not.toThrow();
    for (const valor of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validarDuracaoRenovacaoMeses(valor)).toThrow(ErroDominio);
    }
  });

  it("soma meses de calendário respeitando o último dia do mês", () => {
    expect(adicionarMesesCalendario(d("2025-01-31T12:30:00.000Z"), 1).toISOString()).toBe("2025-02-28T12:30:00.000Z");
    expect(adicionarMesesCalendario(d("2024-01-31T12:30:00.000Z"), 1).toISOString()).toBe("2024-02-29T12:30:00.000Z");
    expect(adicionarMesesCalendario(d("2025-10-25T00:00:00.000Z"), 12).toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });
  it("não considera elegível para renovação automática contrato sem duração ou encerrado", () => {
    const base = { renovacaoAutomatica: true, duracaoRenovacaoMeses: 12, encerradoEm: null };
    expect(contratoElegivelRenovacaoAutomatica(base)).toBe(true);
    expect(contratoElegivelRenovacaoAutomatica({ ...base, duracaoRenovacaoMeses: null })).toBe(false);
    expect(contratoElegivelRenovacaoAutomatica({ ...base, encerradoEm: d("2026-01-01") })).toBe(false);
    expect(contratoElegivelRenovacaoAutomatica({ ...base, renovacaoAutomatica: false })).toBe(false);
  });

});

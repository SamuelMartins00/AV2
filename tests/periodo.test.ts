import { describe, expect, it } from "vitest";
import { ErroDominio } from "../src/dominio/erros.js";
import { lerData } from "../src/dominio/contrato.js";
import { lerFimDoDia, lerPeriodo } from "../src/dominio/periodo.js";

describe("período dos relatórios", () => {
  it("aceita um período válido", () => {
    const periodo = lerPeriodo("2026-01-01", "2026-10-31");
    expect(periodo.inicio.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("inclui o dia inteiro quando a data final vem sem horário", () => {
    expect(lerFimDoDia("2026-10-31", "Data final").toISOString()).toBe(
      "2026-10-31T23:59:59.999Z",
    );
  });

  it("respeita o horário quando a data final o informa", () => {
    expect(
      lerFimDoDia("2026-10-31T10:00:00.000Z", "Data final").toISOString(),
    ).toBe("2026-10-31T10:00:00.000Z");
  });

  it("rejeita data inicial inválida com status 400", () => {
    try {
      lerPeriodo("não é data", "2026-10-31");
      expect.unreachable();
    } catch (erro) {
      expect((erro as ErroDominio).message).toBe(
        "Data inicial do período inválida.",
      );
      expect((erro as ErroDominio).statusCode).toBe(400);
    }
  });

  it("rejeita datas de calendário impossíveis", () => {
    expect(() => lerData("2026-02-31", "Data")).toThrowError("Data inválida.");
    expect(() => lerData("2025-02-29", "Data")).toThrowError("Data inválida.");
    expect(() => lerPeriodo("2026-02-31", "2026-03-31")).toThrowError("Data inicial do período inválida.");
  });

  it("aceita 29 de fevereiro somente em ano bissexto", () => {
    expect(lerData("2024-02-29", "Data").toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(() => lerData("2023-02-29", "Data")).toThrowError("Data inválida.");
  });

  it("rejeita horários ISO impossíveis e preserva o fuso explícito", () => {
    expect(() => lerData("2026-10-31T25:00:00Z", "Data")).toThrowError("Data inválida.");
    expect(() => lerData("2026-10-31T10:61:00Z", "Data")).toThrowError("Data inválida.");
    expect(lerData("2026-10-31T10:00:00+03:00", "Data").toISOString()).toBe("2026-10-31T07:00:00.000Z");
  });

  it("rejeita período invertido com status 422", () => {
    try {
      lerPeriodo("2026-12-01", "2026-01-01");
      expect.unreachable();
    } catch (erro) {
      expect((erro as ErroDominio).message).toBe(
        "A data inicial não pode ser posterior à data final.",
      );
      expect((erro as ErroDominio).statusCode).toBe(422);
    }
  });
});

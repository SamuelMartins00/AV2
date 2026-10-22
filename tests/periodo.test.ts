import { describe, expect, it } from "vitest";
import { ErroDominio } from "../src/dominio/erros.js";
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

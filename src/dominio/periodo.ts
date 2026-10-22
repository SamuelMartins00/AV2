import { lerData } from "./contrato.js";
import { ErroDominio } from "./erros.js";

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Data final de um período. Quando vem só a data (2026-10-31), vale o dia
 * inteiro, até 23:59:59.999 UTC; senão o registro das 15h do dia 31 ficaria fora.
 */
export function lerFimDoDia(valor: string, campo: string): Date {
  const data = lerData(valor, campo);
  return SO_DATA.test(valor.trim())
    ? new Date(`${valor.trim()}T23:59:59.999Z`)
    : data;
}

export interface Periodo {
  inicio: Date;
  fim: Date;
}

export function lerPeriodo(inicio: string, fim: string): Periodo {
  const periodo = {
    inicio: lerData(inicio, "Data inicial do período"),
    fim: lerFimDoDia(fim, "Data final do período"),
  };
  if (periodo.inicio > periodo.fim) {
    throw new ErroDominio(
      "A data inicial não pode ser posterior à data final.",
      422,
    );
  }
  return periodo;
}

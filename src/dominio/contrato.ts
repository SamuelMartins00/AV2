import { ErroDominio } from "./erros.js";

export function lerData(valor: string, campo: string): Date {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    throw new ErroDominio(`${campo} inválida.`, 400);
  }
  return data;
}

export function validarContrato(
  assinatura: Date,
  vencimento: Date,
  valorMensal: number,
): void {
  if (vencimento <= assinatura) {
    throw new ErroDominio(
      "A data de vencimento deve ser posterior à data de assinatura.",
      422,
    );
  }
  if (!Number.isFinite(valorMensal) || valorMensal < 0) {
    throw new ErroDominio("O valor mensal do contrato é inválido.", 422);
  }
}

export function validarRenovacao(
  vencimentoAtual: Date,
  novoVencimento: Date,
): void {
  if (novoVencimento <= vencimentoAtual) {
    throw new ErroDominio(
      "A nova data de vencimento deve ser posterior à atual.",
      422,
    );
  }
}

export function contratoEstaVigente(
  assinatura: Date,
  vencimento: Date,
  agora: Date = new Date(),
): boolean {
  return agora >= assinatura && agora <= vencimento;
}

/** Valida a duração contratual expressa em meses inteiros. */
export function validarDuracaoRenovacaoMeses(meses: number): void {
  if (!Number.isSafeInteger(meses) || meses <= 0) {
    throw new ErroDominio("A duração da renovação deve ser um número inteiro positivo de meses.", 422);
  }
}

/** Soma meses de calendário sem deixar o JavaScript transbordar para o mês seguinte.
 * Ex.: 31 de janeiro + 1 mês resulta no último dia de fevereiro.
 */
export function adicionarMesesCalendario(dataBase: Date, meses: number): Date {
  validarDuracaoRenovacaoMeses(meses);
  const resultado = new Date(dataBase.getTime());
  const diaOriginal = resultado.getUTCDate();
  resultado.setUTCDate(1);
  resultado.setUTCMonth(resultado.getUTCMonth() + meses);
  const ultimoDia = new Date(Date.UTC(
    resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0,
    resultado.getUTCHours(), resultado.getUTCMinutes(), resultado.getUTCSeconds(), resultado.getUTCMilliseconds(),
  )).getUTCDate();
  resultado.setUTCDate(Math.min(diaOriginal, ultimoDia));
  return resultado;
}

export function contratoElegivelRenovacaoAutomatica(contrato: {
  renovacaoAutomatica: boolean;
  duracaoRenovacaoMeses: number | null;
  encerradoEm: Date | null;
}): boolean {
  return contrato.renovacaoAutomatica
    && contrato.encerradoEm === null
    && contrato.duracaoRenovacaoMeses !== null
    && Number.isSafeInteger(contrato.duracaoRenovacaoMeses)
    && contrato.duracaoRenovacaoMeses > 0;
}

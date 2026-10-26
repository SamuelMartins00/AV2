import { ErroDominio } from "./erros.js";

const DATA_ISO_COM_COMPONENTES = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](.*))?$/;
const HORARIO_ISO = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:([zZ])|([+-])(\d{2}):?(\d{2}))?$/;

function dataCalendarioValida(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const diasPorMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= (diasPorMes[mes - 1] ?? 0);
}

function componentesIsoValidos(valor: string): boolean {
  const partes = DATA_ISO_COM_COMPONENTES.exec(valor);
  if (!partes) return true; // Mantém os demais formatos que Date já aceitava.

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (!dataCalendarioValida(ano, mes, dia)) return false;

  const horario = partes[4];
  if (horario === undefined) return true;
  const componentes = HORARIO_ISO.exec(horario);
  if (!componentes) return false;

  const hora = Number(componentes[1]);
  const minuto = Number(componentes[2]);
  const segundo = componentes[3] === undefined ? 0 : Number(componentes[3]);
  if (hora > 23 || minuto > 59 || segundo > 59) return false;

  // Offset explícito precisa estar dentro dos limites sintáticos de ISO 8601.
  if (componentes[6] !== undefined) {
    const horaOffset = Number(componentes[7]);
    const minutoOffset = Number(componentes[8]);
    if (horaOffset > 23 || minutoOffset > 59) return false;
  }
  return true;
}

export function lerData(valor: string, campo: string): Date {
  const texto = valor.trim();
  if (!texto || !componentesIsoValidos(texto)) {
    throw new ErroDominio(`${campo} inválida.`, 400);
  }

  const data = new Date(texto);
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

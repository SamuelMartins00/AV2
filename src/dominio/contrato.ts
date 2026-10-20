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
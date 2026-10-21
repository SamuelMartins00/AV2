import { ErroDominio } from "./erros.js";
import {
  ESTADOS_FISICOS,
  type EstadoFisico,
  type StatusRastreamento,
  type TipoEquipamento,
} from "./enums.js";

export function indiceEstado(estado: EstadoFisico): number {
  return ESTADOS_FISICOS.indexOf(estado);
}

export function validarMudancaEstado(
  atual: EstadoFisico,
  novo: EstadoFisico,
  justificativa: string,
): void {
  const queda = indiceEstado(novo) - indiceEstado(atual);
  if (queda >= 2 && !justificativa.trim()) {
    throw new ErroDominio(
      "É obrigatória uma justificativa quando o estado físico piora duas ou mais categorias.",
      422,
    );
  }
}

export function validarMudancaStatus(
  atual: StatusRastreamento,
  novo: StatusRastreamento,
  justificativa: string,
): void {
  if (!justificativa.trim()) {
    throw new ErroDominio("A justificativa não pode ser vazia.", 422);
  }
  if (novo === "EM_DESMONTE" && atual !== "AGUARDANDO_DESMONTE") {
    throw new ErroDominio(
      "O equipamento só pode entrar em desmonte após a triagem completa.",
      409,
    );
  }
}

export function validarMovimentacao(
  destino: string,
  responsavel: string,
  statusAtual: StatusRastreamento,
): void {
  if (!destino.trim()) {
    throw new ErroDominio("O destino da movimentação é obrigatório.", 422);
  }
  if (!responsavel.trim()) {
    throw new ErroDominio(
      "O responsável pela movimentação é obrigatório.",
      422,
    );
  }

  const destinoNormalizado = destino.trim().toLowerCase();
  if (
    destinoNormalizado.includes("desmont") &&
    statusAtual !== "AGUARDANDO_DESMONTE" &&
    statusAtual !== "EM_DESMONTE"
  ) {
    throw new ErroDominio(
      "O equipamento só pode ser movimentado para desmontagem após a triagem.",
      409,
    );
  }
}

export function gerarCodigoBarras(
  tipo: TipoEquipamento,
  sequencia: number,
): string {
  if (!Number.isInteger(sequencia) || sequencia <= 0) {
    throw new ErroDominio(
      "A sequência do código de barras deve ser um número inteiro positivo.",
      422,
    );
  }
  return `${tipo}-${sequencia.toString().padStart(6, "0")}`;
}

interface EntradaDepreciacao {
  coeficiente: number;
  valorBase: number;
  anoFabricacao: number;
  estado: EstadoFisico;
  anoReferencia?: number;
}

export function calcularDepreciacao(entrada: EntradaDepreciacao): number {
  const { coeficiente, valorBase, anoFabricacao, estado } = entrada;
  const anoReferencia = entrada.anoReferencia ?? new Date().getFullYear();

  if (!Number.isFinite(coeficiente) || coeficiente < 0 || coeficiente > 1) {
    throw new ErroDominio(
      "O coeficiente de depreciação deve estar entre 0 e 1.",
      422,
    );
  }
  if (!Number.isFinite(valorBase) || valorBase <= 0) {
    throw new ErroDominio(
      "O valor-base de depreciação deve ser maior que zero.",
      422,
    );
  }

  const anosUso = Math.max(0, anoReferencia - anoFabricacao);
  const fatorEstado = 1 - indiceEstado(estado) * 0.08;
  const valorResidual =
    valorBase * Math.pow(1 - coeficiente, anosUso) * Math.max(0.1, fatorEstado);

  return Number(Math.max(0, valorBase - valorResidual).toFixed(2));
}

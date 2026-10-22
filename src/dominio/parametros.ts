import { ErroDominio } from "./erros.js";

export interface ParametrosParciais {
  aliquotaImpostos?: number;
  coeficienteDepreciacao?: number;
  valorBaseDepreciacao?: number;
}

export function validarParametros(parametros: ParametrosParciais): void {
  const { aliquotaImpostos, coeficienteDepreciacao, valorBaseDepreciacao } =
    parametros;

  if (
    aliquotaImpostos !== undefined &&
    (!Number.isFinite(aliquotaImpostos) ||
      aliquotaImpostos < 0 ||
      aliquotaImpostos > 1)
  ) {
    throw new ErroDominio("A alíquota de impostos deve estar entre 0 e 1.", 422);
  }

  if (
    coeficienteDepreciacao !== undefined &&
    (!Number.isFinite(coeficienteDepreciacao) ||
      coeficienteDepreciacao < 0 ||
      coeficienteDepreciacao > 1)
  ) {
    throw new ErroDominio(
      "O coeficiente de depreciação deve estar entre 0 e 1.",
      422,
    );
  }

  if (
    valorBaseDepreciacao !== undefined &&
    (!Number.isFinite(valorBaseDepreciacao) || valorBaseDepreciacao <= 0)
  ) {
    throw new ErroDominio(
      "O valor-base de depreciação deve ser maior que zero.",
      422,
    );
  }
}

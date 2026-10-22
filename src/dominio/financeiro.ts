export interface ResumoFinanceiro {
  valorMensalTotal: number;
  valorMensalMedio: number;
  impostoEstimado: number;
}

/** Soma em centavos inteiros, para não acumular erro de ponto flutuante. */
export function resumirContratos(
  valoresMensais: number[],
  aliquota: number,
): ResumoFinanceiro {
  const totalCentavos = valoresMensais.reduce(
    (soma, valor) => soma + Math.round(valor * 100),
    0,
  );
  const mediaCentavos =
    valoresMensais.length > 0
      ? Math.round(totalCentavos / valoresMensais.length)
      : 0;

  return {
    valorMensalTotal: totalCentavos / 100,
    valorMensalMedio: mediaCentavos / 100,
    impostoEstimado: Math.round(totalCentavos * aliquota) / 100,
  };
}

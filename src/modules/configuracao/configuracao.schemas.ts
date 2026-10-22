export interface AtualizarConfiguracaoBody {
  aliquotaImpostos?: number;
  coeficienteDepreciacao?: number;
  valorBaseDepreciacao?: number;
}

// Sem minimum/maximum de propósito: os limites são validados no domínio,
export const atualizarConfiguracaoSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      aliquotaImpostos: { type: "number" },
      coeficienteDepreciacao: { type: "number" },
      valorBaseDepreciacao: { type: "number" },
    },
  },
} as const;

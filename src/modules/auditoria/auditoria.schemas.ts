export interface ConsultaJournalQuery {
  pagina?: number;
  limite?: number;
  entidade?: string;
  operacao?: string;
  responsavel?: string;
  inicio?: string;
  fim?: string;
}

export const consultaJournalSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      pagina: { type: "integer", minimum: 1, maximum: 1000000 },
      limite: { type: "integer", minimum: 1, maximum: 100 },
      entidade: { type: "string", minLength: 1, maxLength: 100, pattern: ".*\\S.*" },
      operacao: { type: "string", minLength: 1, maxLength: 100, pattern: ".*\\S.*" },
      responsavel: { type: "string", minLength: 1, maxLength: 191, pattern: ".*\\S.*" },
      inicio: { type: "string", minLength: 10, maxLength: 40 },
      fim: { type: "string", minLength: 10, maxLength: 40 },
    },
  },
} as const;

export const TIPOS_EQUIPAMENTO = [
  "COMPUTADOR_MESA",
  "NOTEBOOK",
  "MONITOR",
  "IMPRESSORA",
  "SERVIDOR",
  "ROTEADOR",
  "CABO_ESTRUTURADO",
  "FONTE_ALIMENTACAO",
] as const;
export type TipoEquipamento = (typeof TIPOS_EQUIPAMENTO)[number];

// A ordem importa: do melhor para o pior estado (índice 0 a 6)
export const ESTADOS_FISICOS = [
  "NOVO",
  "BOM_ESTADO",
  "USADO_LEVE",
  "USADO_MODERADO",
  "DANIFICADO_LEVE",
  "DANIFICADO_GRAVE",
  "INSERVIVEL",
] as const;
export type EstadoFisico = (typeof ESTADOS_FISICOS)[number];

export const RESULTADOS_TRIAGEM = [
  "AGUARDANDO_AVALIACAO",
  "APROVADO_PARA_DESMONTAGEM",
  "DESTINADO_AO_REAPROVEITAMENTO_DE_PECAS",
  "DESTINADO_A_RECICLAGEM",
  "DESTINADO_AO_DESCARTE_SEGURO",
] as const;
export type ResultadoTriagem = (typeof RESULTADOS_TRIAGEM)[number];

export const STATUS_RASTREAMENTO = [
  "AGUARDANDO_TRIAGEM",
  "EM_TRIAGEM",
  "AGUARDANDO_DESMONTE",
  "EM_DESMONTE",
  "PECAS_REAPROVEITADAS",
  "MATERIAL_RECICLAVEL",
  "DESCARTE_SEGURO",
  "BAIXA_DEFINITIVA",
] as const;
export type StatusRastreamento = (typeof STATUS_RASTREAMENTO)[number];

export const STATUS_LOTE = [
  "RECEBIDO",
  "EM_TRIAGEM",
  "TRIAGEM_CONCLUIDA",
  "ENCAMINHADO",
  "FINALIZADO",
] as const;
export type StatusLote = (typeof STATUS_LOTE)[number];

// Lotes que ainda aceitam novos equipamentos e a conclusão da triagem
export const STATUS_LOTE_ABERTO = ["RECEBIDO", "EM_TRIAGEM"] as const;

// Equipamentos que ainda não concluíram a triagem
export const STATUS_PRE_TRIAGEM = ["AGUARDANDO_TRIAGEM", "EM_TRIAGEM"] as const;

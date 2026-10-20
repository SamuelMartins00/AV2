export const PAPEIS = [
  "ADMINISTRADOR",
  "OPERADOR_CADASTRO",
  "GESTOR_ALMOXARIFADO",
  "AUDITOR",
] as const;

export type Papel = (typeof PAPEIS)[number];
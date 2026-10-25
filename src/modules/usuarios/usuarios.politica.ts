import { ErroDominio } from "../../dominio/erros.js";

export function normalizarNomeExibicao(nome: string): string {
  const normalizado = nome.trim();
  if (normalizado.length < 2 || normalizado.length > 100) {
    throw new ErroDominio("Nome de exibição deve ter entre 2 e 100 caracteres", 422);
  }
  return normalizado;
}

export function validarPaginacao(pageInformada?: number, limitInformado?: number) {
  const page = pageInformada ?? 1;
  const limit = limitInformado ?? 20;
  if (!Number.isSafeInteger(page) || page < 1) throw new ErroDominio("page deve ser um inteiro positivo", 400);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ErroDominio("limit deve estar entre 1 e 100", 400);
  return { page, limit };
}

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";

interface EntradaJournal {
  operacao: string;
  entidade: string;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  usuario: string;
}

// Converte datas e Decimals em JSON puro; null e undefined viram NULL no banco
function paraJson(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor === undefined || valor === null) return undefined;
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

export function registrarJournal(
  tx: Prisma.TransactionClient,
  entrada: EntradaJournal,
) {
  return tx.journalTransacao.create({
    data: {
      operacao: entrada.operacao,
      entidade: entrada.entidade,
      dadosAntes: paraJson(entrada.dadosAntes),
      dadosDepois: paraJson(entrada.dadosDepois),
      usuarioResponsavel: entrada.usuario,
    },
  });
}

/**
 * Registra eventos de segurança fora da transação de autenticação.
 * É best-effort: falha no journal não altera a resposta nem o resultado da sessão.
 * Não passe tokens, senhas, hashes ou credenciais nesta função
 */
export async function registrarEventoSeguranca(entrada: EntradaJournal): Promise<void> {
  try {
    await prisma.journalTransacao.create({
      data: {
        operacao: entrada.operacao,
        entidade: entrada.entidade,
        dadosAntes: paraJson(entrada.dadosAntes),
        dadosDepois: paraJson(entrada.dadosDepois),
        usuarioResponsavel: entrada.usuario,
      },
    });
  } catch {
    // Não registrar dados de entrada, tokens ou detalhes da exceção no log de falha
    console.error("Não foi possível registrar um evento de segurança no journal.");
  }
}

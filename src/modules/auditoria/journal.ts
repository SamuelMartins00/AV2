import type { Prisma } from "../../generated/prisma/client.js";

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
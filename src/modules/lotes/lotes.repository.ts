import { prisma } from "../../config/prisma.js";
import {
  STATUS_LOTE_ABERTO,
  STATUS_PRE_TRIAGEM,
  type EstadoFisico,
  type TipoEquipamento,
} from "../../dominio/enums.js";
import { gerarCodigoBarras } from "../../dominio/equipamento.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { registrarJournal } from "../auditoria/journal.js";

const comEquipamentos = {
  equipamentos: { orderBy: { posicaoNoLote: "asc" } },
} as const;

export type LoteCompleto = Prisma.LoteGetPayload<{
  include: typeof comEquipamentos;
}>;

export interface DadosNovoLote {
  organizacaoId: number;
  dataEntrada: Date;
  notaFiscal: string;
  transportadora: string;
  observacoes?: string;
}

export interface DadosNovoEquipamento {
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: number;
}

export type ResultadoLote<T> =
  | { tipo: "ok"; valor: T }
  | { tipo: "conflito" }
  | { tipo: "nao_encontrada" }
  | { tipo: "status_invalido" }
  | { tipo: "sem_equipamentos" };

async function ultimaSequencia(
  tx: Prisma.TransactionClient,
  tipo: TipoEquipamento,
): Promise<number> {
  const ultimo = await tx.equipamento.findFirst({
    where: { tipo },
    orderBy: { id: "desc" },
    select: { codigoBarrasInterno: true },
  });
  if (!ultimo) return 0;

  const numero = Number(ultimo.codigoBarrasInterno.split("-").pop());
  return Number.isInteger(numero) ? numero : 0;
}

// Gera o código de barras (TIPO-000001) e a posição de cada equipamento.
// Se outra transação gerar o mesmo valor ao mesmo tempo, o UNIQUE do banco
// recusa e o service repete a operação inteira.
async function inserirEquipamentos(
  tx: Prisma.TransactionClient,
  loteId: number,
  itens: DadosNovoEquipamento[],
  posicaoInicial: number,
): Promise<void> {
  const sequencias = new Map<TipoEquipamento, number>();
  let posicao = posicaoInicial;

  for (const item of itens) {
    const atual = sequencias.get(item.tipo) ?? (await ultimaSequencia(tx, item.tipo));
    const proxima = atual + 1;
    sequencias.set(item.tipo, proxima);
    posicao += 1;

    await tx.equipamento.create({
      data: {
        loteId,
        posicaoNoLote: posicao,
        codigoBarrasInterno: gerarCodigoBarras(item.tipo, proxima),
        tipo: item.tipo,
        marca: item.marca,
        modelo: item.modelo,
        anoFabricacao: item.anoFabricacao,
        estadoFisico: item.estadoFisico,
        pesoQuilogramas: item.pesoQuilogramas,
      },
    });
  }
}

export const lotesRepository = {
  async organizacaoExiste(id: number): Promise<boolean> {
    return (await prisma.organizacao.count({ where: { id } })) > 0;
  },

  buscarPorId(id: number) {
    return prisma.lote.findUnique({ where: { id }, include: comEquipamentos });
  },

  listarPorPeriodo(inicio?: Date, fim?: Date) {
    return prisma.lote.findMany({
      where: { dataEntrada: { gte: inicio, lte: fim } },
      include: { equipamentos: { select: { pesoQuilogramas: true } } },
      orderBy: { dataEntrada: "desc" },
    });
  },

  criar(
    lote: DadosNovoLote,
    equipamentos: DadosNovoEquipamento[],
    usuario: string,
  ) {
    return prisma.$transaction(async (tx): Promise<LoteCompleto> => {
      const criado = await tx.lote.create({ data: lote });
      await inserirEquipamentos(tx, criado.id, equipamentos, 0);

      const completo = await tx.lote.findUniqueOrThrow({
        where: { id: criado.id },
        include: comEquipamentos,
      });

      await registrarJournal(tx, {
        operacao: "CRIAR",
        entidade: "Lote",
        dadosDepois: completo,
        usuario,
      });

      return completo;
    });
  },

  adicionarEquipamentos(
    loteId: number,
    itens: DadosNovoEquipamento[],
    usuario: string,
  ) {
    return prisma.$transaction(
      async (tx): Promise<ResultadoLote<LoteCompleto>> => {
        // Trava a linha do lote e confirma, na mesma instrução, que ele ainda
        // está aberto: evita incluir equipamento em lote com triagem concluída.
        const travado = await tx.lote.updateMany({
          where: { id: loteId, statusProcessamento: { in: [...STATUS_LOTE_ABERTO] } },
          data: { versao: { increment: 1 } },
        });
        if (travado.count === 0) {
          const existe = await tx.lote.findUnique({
            where: { id: loteId },
            select: { id: true },
          });
          return { tipo: existe ? "status_invalido" : "nao_encontrada" };
        }

        const antes = await tx.lote.findUniqueOrThrow({
          where: { id: loteId },
          include: comEquipamentos,
        });
        const ultimaPosicao = antes.equipamentos.at(-1)?.posicaoNoLote ?? 0;

        await inserirEquipamentos(tx, loteId, itens, ultimaPosicao);

        const depois = await tx.lote.findUniqueOrThrow({
          where: { id: loteId },
          include: comEquipamentos,
        });

        await registrarJournal(tx, {
          operacao: "ADICIONAR_EQUIPAMENTO",
          entidade: "Lote",
          dadosAntes: antes,
          dadosDepois: depois,
          usuario,
        });

        return { tipo: "ok", valor: depois };
      },
    );
  },

  concluirTriagem(loteId: number, versao: number, usuario: string) {
    return prisma.$transaction(
      async (tx): Promise<ResultadoLote<LoteCompleto>> => {
        const antes = await tx.lote.findUnique({
          where: { id: loteId },
          include: comEquipamentos,
        });
        if (!antes) return { tipo: "nao_encontrada" };
        if (antes.equipamentos.length === 0) return { tipo: "sem_equipamentos" };
        if (!(STATUS_LOTE_ABERTO as readonly string[]).includes(antes.statusProcessamento)) {
          return { tipo: "status_invalido" };
        }

        const resultado = await tx.lote.updateMany({
          where: {
            id: loteId,
            versao,
            statusProcessamento: { in: [...STATUS_LOTE_ABERTO] },
          },
          data: {
            statusProcessamento: "TRIAGEM_CONCLUIDA",
            versao: { increment: 1 },
          },
        });
        if (resultado.count === 0) return { tipo: "conflito" };

        await tx.equipamento.updateMany({
          where: {
            loteId,
            statusRastreamento: { in: [...STATUS_PRE_TRIAGEM] },
          },
          data: {
            statusRastreamento: "AGUARDANDO_DESMONTE",
            versao: { increment: 1 },
          },
        });

        const depois = await tx.lote.findUniqueOrThrow({
          where: { id: loteId },
          include: comEquipamentos,
        });

        await registrarJournal(tx, {
          operacao: "PROCESSAR_TRIAGEM",
          entidade: "Lote",
          dadosAntes: antes,
          dadosDepois: { ...depois, justificativa: "Triagem do lote concluída." },
          usuario,
        });

        return { tipo: "ok", valor: depois };
      },
    );
  },
};

import type { Equipamento, Movimentacao } from "../../generated/prisma/client.js";

export function equipamentoParaResposta(eq: Equipamento) {
  return {
    id: eq.id,
    codigoBarrasInterno: eq.codigoBarrasInterno,
    loteId: eq.loteId,
    posicaoNoLote: eq.posicaoNoLote,
    tipo: eq.tipo,
    marca: eq.marca,
    modelo: eq.modelo,
    anoFabricacao: eq.anoFabricacao,
    estadoFisico: eq.estadoFisico,
    statusRastreamento: eq.statusRastreamento,
    pesoQuilogramas: eq.pesoQuilogramas.toNumber(),
    versao: eq.versao,
  };
}

export function movimentacaoParaResposta(mov: Movimentacao) {
  return {
    id: mov.id,
    equipamentoId: mov.equipamentoId,
    dataHora: mov.dataHora,
    origem: mov.origem,
    destino: mov.destino,
    responsavel: mov.responsavel,
    observacao: mov.observacao,
  };
}

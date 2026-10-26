import {
  calcularDepreciacao,
  validarMovimentacao,
  validarMudancaEstado,
  validarMudancaStatus,
} from "../../dominio/equipamento.js";
import { ErroDominio } from "../../dominio/erros.js";
import { lotesRepository } from "../lotes/lotes.repository.js";
import { MSG_CONFLITO, type ResultadoEscrita } from "../compartilhado/params.js";
import {
  equipamentoParaResposta,
  movimentacaoParaResposta,
} from "./equipamentos.mapper.js";
import { equipamentosRepository as repo } from "./equipamentos.repository.js";
import type {
  AtualizarEstadoBody,
  AvaliarTriagemBody,
  BaixaDefinitivaBody,
  AtualizarStatusBody,
  MovimentarBody,
  ListarEquipamentosQuery,
} from "./equipamentos.schemas.js";

function naoEncontrado(id: number): ErroDominio {
  return new ErroDominio(`Equipamento ${id} não encontrado.`, 404);
}

function exigirOk(id: number, resultado: ResultadoEscrita<null>): void {
  if (resultado.tipo === "nao_encontrada") throw naoEncontrado(id);
  if (resultado.tipo === "conflito") throw new ErroDominio(MSG_CONFLITO, 409);
}

export class EquipamentosService {
  private async obterOuFalhar(id: number) {
    const eq = await repo.buscarPorId(id);
    if (!eq) throw naoEncontrado(id);
    return eq;
  }

  async listar(filtros: ListarEquipamentosQuery) {
    const equipamentos = await repo.listar(filtros);
    return equipamentos.map(equipamentoParaResposta);
  }

  async rastrear(id: number) {
    const eq = await repo.buscarComHistorico(id);
    if (!eq) throw naoEncontrado(id);

    const { movimentacoes, ...equipamento } = eq;
    return {
      equipamento: equipamentoParaResposta(equipamento),
      movimentacoes: movimentacoes.map(movimentacaoParaResposta),
    };
  }

  async atualizarEstado(
    id: number,
    corpo: AtualizarEstadoBody,
    usuario: string,
  ) {
    const eq = await this.obterOuFalhar(id);
    const justificativa = (corpo.justificativa ?? "").trim();

    validarMudancaEstado(eq.estadoFisico, corpo.novoEstado, justificativa);

    exigirOk(
      id,
      await repo.atualizarEstado(
        id,
        corpo.versao,
        corpo.novoEstado,
        justificativa,
        usuario,
      ),
    );
    return equipamentoParaResposta(await this.obterOuFalhar(id));
  }

  async atualizarStatus(
    id: number,
    corpo: AtualizarStatusBody,
    usuario: string,
  ) {
    const eq = await this.obterOuFalhar(id);
    const justificativa = corpo.justificativa.trim();

    validarMudancaStatus(eq.statusRastreamento, corpo.novoStatus, justificativa, eq.resultadoTriagem);

    exigirOk(
      id,
      await repo.atualizarStatus(
        id,
        corpo.versao,
        corpo.novoStatus,
        justificativa,
        usuario,
      ),
    );
    return equipamentoParaResposta(await this.obterOuFalhar(id));
  }

  async movimentar(id: number, corpo: MovimentarBody, usuario: string) {
    const eq = await this.obterOuFalhar(id);

    validarMovimentacao(corpo.destino, usuario, eq.statusRastreamento, eq.resultadoTriagem);

    const resultado = await repo.registrarMovimentacao(
      id,
      corpo.destino.trim(),
      corpo.observacao?.trim() || undefined,
      usuario,
    );
    if (resultado.tipo === "nao_encontrada") throw naoEncontrado(id);
    return movimentacaoParaResposta(resultado.valor);
  }

  async avaliarTriagem(id: number, corpo: AvaliarTriagemBody, usuario: string) {
    const justificativa = corpo.justificativa.trim();
    if (!justificativa) throw new ErroDominio("A justificativa não pode ser vazia.", 422);
    const resultado = await lotesRepository.avaliarEquipamento(id, corpo.versao, corpo.resultadoTriagem, justificativa, usuario);
    if (resultado.tipo === "nao_encontrada") throw naoEncontrado(id);
    if (resultado.tipo === "conflito") throw new ErroDominio(MSG_CONFLITO, 409);
    if (resultado.tipo === "status_invalido") throw new ErroDominio("A triagem só pode ser registrada enquanto o equipamento e o lote estiverem em etapa aberta.", 409);
    return equipamentoParaResposta(resultado.valor);
  }

  async baixarDefinitivamente(id: number, corpo: BaixaDefinitivaBody, usuario: string) {
    const justificativa = corpo.justificativa.trim();
    if (!justificativa) throw new ErroDominio("A justificativa não pode ser vazia.", 422);
    const resultado = await repo.baixarDefinitivamente(id, corpo.versao, justificativa, usuario);
    if (resultado.tipo === "nao_encontrada") throw naoEncontrado(id);
    if (resultado.tipo === "conflito") throw new ErroDominio(MSG_CONFLITO, 409);
    if (resultado.tipo === "status_invalido") throw new ErroDominio("A baixa definitiva já foi registrada.", 409);
    return equipamentoParaResposta(resultado.valor);
  }

  async depreciacao(id: number) {
    const eq = await this.obterOuFalhar(id);

    const config = await repo.buscarConfiguracao();
    if (!config) {
      throw new ErroDominio("Os parâmetros globais não foram configurados.", 422);
    }

    const coeficiente = config.coeficienteDepreciacao.toNumber();
    const valorBase = config.valorBaseDepreciacao.toNumber();

    return {
      equipamentoId: eq.id,
      depreciacaoAcumulada: calcularDepreciacao({
        coeficiente,
        valorBase,
        anoFabricacao: eq.anoFabricacao,
        estado: eq.estadoFisico,
      }),
      coeficiente,
      valorBase,
    };
  }
}

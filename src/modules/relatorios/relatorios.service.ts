import {
  STATUS_RASTREAMENTO,
  type StatusRastreamento,
} from "../../dominio/enums.js";
import { ErroDominio } from "../../dominio/erros.js";
import { resumirContratos } from "../../dominio/financeiro.js";
import { lerPeriodo } from "../../dominio/periodo.js";
import { relatoriosRepository as repo } from "./relatorios.repository.js";
import type { PeriodoQuery, StatusQuery } from "./relatorios.schemas.js";

const OBSERVACAO_FINANCEIRA =
  "Este relatório apresenta valores contratuais mensais de contratos que estiveram vigentes em algum momento do período. Não representa receita recebida ou reconhecida.";

function contagemZerada(): Record<StatusRastreamento, number> {
  return Object.fromEntries(
    STATUS_RASTREAMENTO.map((status) => [status, 0]),
  ) as Record<StatusRastreamento, number>;
}

export class RelatoriosService {
  async porOrganizacao(organizacaoId: number, consulta: PeriodoQuery) {
    const periodo = lerPeriodo(consulta.inicio, consulta.fim);

    const organizacao = await repo.buscarOrganizacao(organizacaoId);
    if (!organizacao) {
      throw new ErroDominio(`Organização ${organizacaoId} não encontrada.`, 404);
    }

    const [lotesRecebidos, grupos] = await Promise.all([
      repo.contarLotes(organizacaoId, periodo.inicio, periodo.fim),
      repo.agruparEquipamentosPorStatus(organizacaoId, periodo.inicio, periodo.fim),
    ]);

    const equipamentosPorStatus = contagemZerada();
    let equipamentosRecebidos = 0;
    let pesoGramas = 0;

    for (const grupo of grupos) {
      equipamentosPorStatus[grupo.statusRastreamento] = grupo._count._all;
      equipamentosRecebidos += grupo._count._all;
      pesoGramas += Math.round(
        (grupo._sum.pesoQuilogramas?.toNumber() ?? 0) * 1000,
      );
    }

    return {
      organizacao,
      periodo,
      lotesRecebidos,
      equipamentosRecebidos,
      pesoTotalKg: pesoGramas / 1000,
      equipamentosPorStatus,
    };
  }

  async porStatus(consulta: StatusQuery) {
    const equipamentos = await repo.listarEquipamentosPorStatus(consulta.status);
    return {
      status: consulta.status,
      quantidade: equipamentos.length,
      equipamentos,
    };
  }

  async financeiro(consulta: PeriodoQuery) {
    const periodo = lerPeriodo(consulta.inicio, consulta.fim);

    const config = await repo.buscarConfiguracao();
    if (!config) {
      throw new ErroDominio("Os parâmetros globais não foram configurados.", 422);
    }
    const aliquota = config.aliquotaImpostos.toNumber();

    const contratos = await repo.listarContratosNoPeriodo(
      periodo.inicio,
      periodo.fim,
    );
    const valores = contratos.map((c) => c.valorMensal.toNumber());
    const resumo = resumirContratos(valores, aliquota);

    return {
      periodo,
      contratosNoPeriodo: contratos.length,
      ...resumo,
      aliquotaImpostos: aliquota,
      contratos: contratos.map((contrato) => ({
        organizacaoId: contrato.organizacaoId,
        razaoSocial: contrato.organizacao.razaoSocial,
        cnpj: contrato.organizacao.cnpj,
        valorMensal: contrato.valorMensal.toNumber(),
      })),
      observacao: OBSERVACAO_FINANCEIRA,
    };
  }
}

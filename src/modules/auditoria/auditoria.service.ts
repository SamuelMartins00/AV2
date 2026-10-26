import { lerData } from "../../dominio/contrato.js";
import { ErroDominio } from "../../dominio/erros.js";
import { lerFimDoDia } from "../../dominio/periodo.js";
import { auditoriaRepository } from "./auditoria.repository.js";
import type { ConsultaJournalQuery } from "./auditoria.schemas.js";

const CHAVE_SENSIVEL = /(senha|password|hash|token|secret|credential|autorizacao|authorization|jwt|cookie)/i;

function sanitizarSnapshot(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(sanitizarSnapshot);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .filter(([chave]) => !CHAVE_SENSIVEL.test(chave))
        .map(([chave, conteudo]) => [chave, sanitizarSnapshot(conteudo)]),
    );
  }
  return valor;
}

export class AuditoriaService {
  async listar(consulta: ConsultaJournalQuery) {
    const pagina = consulta.pagina ?? 1;
    const limite = consulta.limite ?? 20;
    let inicio: Date | undefined;
    let fim: Date | undefined;

    if (consulta.inicio !== undefined) inicio = lerData(consulta.inicio, "Data inicial");
    if (consulta.fim !== undefined) fim = lerFimDoDia(consulta.fim, "Data final");
    if (inicio && fim && inicio > fim) {
      throw new ErroDominio("A data inicial não pode ser posterior à data final.", 422);
    }

    const { total, registros } = await auditoriaRepository.listar(
      {
        entidade: consulta.entidade?.trim(),
        operacao: consulta.operacao?.trim(),
        responsavel: consulta.responsavel?.trim(),
        inicio,
        fim,
      },
      pagina,
      limite,
    );

    return {
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
      registros: registros.map((registro) => ({
        ...registro,
        dadosAntes: sanitizarSnapshot(registro.dadosAntes),
        dadosDepois: sanitizarSnapshot(registro.dadosDepois),
      })),
    };
  }
}

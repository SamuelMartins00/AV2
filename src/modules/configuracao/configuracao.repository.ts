import { prisma } from "../../config/prisma.js";
import type { ParametrosParciais } from "../../dominio/parametros.js";
import { registrarJournal } from "../auditoria/journal.js";

export const configuracaoRepository = {
  // A configuração é uma linha única (id = 1); se não existir, é criada com os padrões
  obter() {
    return prisma.configuracaoGlobal.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  },

  atualizar(dados: ParametrosParciais, usuario: string) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.configuracaoGlobal.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });

      await tx.configuracaoGlobal.update({ where: { id: 1 }, data: dados });

      const depois = await tx.configuracaoGlobal.findUniqueOrThrow({
        where: { id: 1 },
      });

      await registrarJournal(tx, {
        operacao: "ATUALIZAR_PARAMETROS",
        entidade: "ConfiguracaoGlobal",
        dadosAntes: antes,
        dadosDepois: depois,
        usuario,
      });

      return depois;
    });
  },
};

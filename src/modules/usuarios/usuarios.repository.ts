import { prisma } from "../../config/prisma.js";
import type { Papel } from "../../dominio/papel.js";
import { registrarJournal } from "../auditoria/journal.js";

// Nunca selecionar hashSenha: ele não pode sair do banco nem ir para o journal
const camposPublicos = {
  id: true,
  usuario: true,
  papel: true,
  ultimoAcesso: true,
  criadoEm: true,
} as const;

export const usuariosRepository = {
  buscarPorNome(usuario: string) {
    return prisma.usuario.findUnique({
      where: { usuario },
      select: { id: true },
    });
  },

  listar() {
    return prisma.usuario.findMany({
      select: camposPublicos,
      orderBy: { id: "asc" },
    });
  },

  criar(usuario: string, hashSenha: string, papel: Papel, administrador: string) {
    return prisma.$transaction(async (tx) => {
      const criado = await tx.usuario.create({
        data: { usuario, hashSenha, papel },
        select: camposPublicos,
      });

      await registrarJournal(tx, {
        operacao: "CRIAR_USUARIO",
        entidade: "Usuario",
        dadosDepois: criado,
        usuario: administrador,
      });

      return criado;
    });
  },
};

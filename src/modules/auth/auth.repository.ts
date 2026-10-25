import { prisma } from "../../config/prisma.js";
import { registrarJournal } from "../auditoria/journal.js";

export const authRepository = {
  buscarUsuarioPorNome(usuario: string) {
    return prisma.usuario.findUnique({ where: { usuario } });
  },

  buscarUsuarioPorId(id: number) {
    return prisma.usuario.findUnique({ where: { id } });
  },

  criarSessaoSeAtivo(id: number, versaoSeguranca: number, tokenHash: string, expiraEm: Date) {
    return prisma.$transaction(async (tx) => {
      const atualizada = await tx.usuario.updateMany({
        where: { id, ativo: true, versaoSeguranca },
        data: { ultimoAcesso: new Date() },
      });
      if (atualizada.count !== 1) return false;
      await tx.refreshToken.create({ data: { usuarioId: id, tokenHash, expiraEm } });
      return true;
    });
  },

  atualizarSenhaERevogarTokens(usuarioId: number, hashSenha: string) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.usuario.findUnique({ where: { id: usuarioId } });
      if (!antes || !antes.ativo) return false;
      const atualizado = await tx.usuario.updateMany({
        where: { id: usuarioId, ativo: true, versaoSeguranca: antes.versaoSeguranca },
        data: { hashSenha, senhaAlteracaoObrigatoria: false, versaoSeguranca: { increment: 1 } },
      });
      if (atualizado.count !== 1) return false;
      await tx.refreshToken.updateMany({ where: { usuarioId, revogado: false }, data: { revogado: true } });
      await registrarJournal(tx, { operacao: "ALTERAR_PROPRIA_SENHA", entidade: "Usuario", dadosAntes: { id: antes.id, usuario: antes.usuario }, dadosDepois: { id: antes.id, usuario: antes.usuario, versaoSeguranca: antes.versaoSeguranca + 1 }, usuario: antes.usuario });
      return true;
    });
  },

  buscarRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash }, include: { usuario: true } });
  },

  revogarRefreshToken(tokenHash: string) {
    return prisma.refreshToken.updateMany({ where: { tokenHash, revogado: false }, data: { revogado: true } });
  },

  revogarTodosDoUsuario(usuarioId: number) {
    return prisma.refreshToken.updateMany({ where: { usuarioId, revogado: false }, data: { revogado: true } });
  },

  rotacionarRefreshToken(idAntigo: number, usuarioId: number, versaoSeguranca: number, novoHash: string, expiraEm: Date) {
    return prisma.$transaction(async (tx) => {
      // Serializa a rotação com desativação, troca de senha e alteração de privilégios.
      await tx.$queryRaw`SELECT id FROM Usuario WHERE id = ${usuarioId} FOR UPDATE`;
      const tokenAntigo = await tx.refreshToken.findUnique({ where: { id: idAntigo }, include: { usuario: true } });
      if (!tokenAntigo || tokenAntigo.revogado || tokenAntigo.usuarioId !== usuarioId || !tokenAntigo.usuario.ativo || tokenAntigo.usuario.senhaAlteracaoObrigatoria || tokenAntigo.usuario.versaoSeguranca !== versaoSeguranca) return false;
      const revogado = await tx.refreshToken.updateMany({ where: { id: idAntigo, revogado: false }, data: { revogado: true } });
      if (revogado.count === 0) return false;
      await tx.refreshToken.create({ data: { usuarioId, tokenHash: novoHash, expiraEm } });
      return true;
    });
  },
};

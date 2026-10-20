import { prisma } from "../../config/prisma.js";

export const authRepository = {
  buscarUsuarioPorNome(usuario: string) {
    return prisma.usuario.findUnique({ where: { usuario } });
  },

  buscarUsuarioPorId(id: number) {
    return prisma.usuario.findUnique({ where: { id } });
  },

  atualizarUltimoAcesso(id: number) {
    return prisma.usuario.update({
      where: { id },
      data: { ultimoAcesso: new Date() },
    });
  },

  atualizarSenhaERevogarTokens(usuarioId: number, hashSenha: string) {
    return prisma.$transaction([
      prisma.usuario.update({ where: { id: usuarioId }, data: { hashSenha } }),
      prisma.refreshToken.updateMany({
        where: { usuarioId, revogado: false },
        data: { revogado: true },
      }),
    ]);
  },

  criarRefreshToken(usuarioId: number, tokenHash: string, expiraEm: Date) {
    return prisma.refreshToken.create({
      data: { usuarioId, tokenHash, expiraEm },
    });
  },

  buscarRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { usuario: true },
    });
  },

  revogarRefreshToken(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revogado: false },
      data: { revogado: true },
    });
  },

  revogarTodosDoUsuario(usuarioId: number) {
    return prisma.refreshToken.updateMany({
      where: { usuarioId, revogado: false },
      data: { revogado: true },
    });
  },

  // Troca atômica: revoga o token antigo e cria o novo na mesma transação.
  // Se o antigo já tinha sido revogado por outra requisição, não cria nada.
  rotacionarRefreshToken(
    idAntigo: number,
    usuarioId: number,
    novoHash: string,
    expiraEm: Date,
  ) {
    return prisma.$transaction(async (tx) => {
      const revogado = await tx.refreshToken.updateMany({
        where: { id: idAntigo, revogado: false },
        data: { revogado: true },
      });
      if (revogado.count === 0) return false;

      await tx.refreshToken.create({
        data: { usuarioId, tokenHash: novoHash, expiraEm },
      });
      return true;
    });
  },
};
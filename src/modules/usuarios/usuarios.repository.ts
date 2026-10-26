import type { Prisma } from "../../generated/prisma/client.js";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import type { Papel } from "../../dominio/papel.js";
import { registrarJournal } from "../auditoria/journal.js";

const camposPublicos = {
  id: true,
  usuario: true,
  nomeExibicao: true,
  papel: true,
  ativo: true,
  ultimoAcesso: true,
  criadoEm: true,
} as const;

const dadosAuditoria = (u: { id: number; usuario: string; nomeExibicao: string; papel: Papel; ativo: boolean }) => ({
  id: u.id, usuario: u.usuario, nomeExibicao: u.nomeExibicao, papel: u.papel, ativo: u.ativo,
});

async function garantirControle() {
  await prisma.configuracaoGlobal.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

async function bloquearOperacoesAdministrativas(tx: Prisma.TransactionClient) {
  // Todas as operações que podem alterar o conjunto de administradores bloqueiam esta mesma linha.
  await tx.$queryRaw`SELECT id FROM ConfiguracaoGlobal WHERE id = 1 FOR UPDATE`;
}

export const usuariosRepository = {
  buscarPorNome(usuario: string) {
    return prisma.usuario.findUnique({ where: { usuario }, select: { id: true } });
  },

  buscarPorId(id: number) {
    return prisma.usuario.findUnique({ where: { id }, select: camposPublicos });
  },

  listar(filtros: { page: number; limit: number; papel?: Papel; ativo?: boolean }) {
    const where = {
      ...(filtros.papel ? { papel: filtros.papel } : {}),
      ...(filtros.ativo !== undefined ? { ativo: filtros.ativo } : {}),
    };
    return prisma.$transaction(async (tx) => {
      const [items, total] = await Promise.all([
        tx.usuario.findMany({ where, select: camposPublicos, orderBy: { id: "asc" }, skip: (filtros.page - 1) * filtros.limit, take: filtros.limit }),
        tx.usuario.count({ where }),
      ]);
      return { items, pagination: { page: filtros.page, limit: filtros.limit, total, totalPages: Math.ceil(total / filtros.limit) } };
    });
  },

  async criar(dados: { usuario: string; nomeExibicao: string; hashSenha: string; papel: Papel }, administradorId: number, administrador: string, senhaAtualAdmin?: string) {
    await garantirControle();
    return prisma.$transaction(async (tx) => {
      await bloquearOperacoesAdministrativas(tx);
      const ator = await tx.usuario.findUnique({ where: { id: administradorId } });
      if (!ator || !ator.ativo || ator.papel !== "ADMINISTRADOR") throw new Error("ATOR_SEM_PERMISSAO");
      if (dados.papel === "ADMINISTRADOR") {
        if (!senhaAtualAdmin || !(await bcrypt.compare(senhaAtualAdmin, ator.hashSenha))) throw new Error("SENHA_ADMIN_INVALIDA");
      }
      const criado = await tx.usuario.create({ data: { ...dados, nomeExibicao: dados.nomeExibicao.trim() }, select: camposPublicos });
      await registrarJournal(tx, { operacao: "CRIAR_USUARIO", entidade: "Usuario", dadosDepois: dadosAuditoria(criado), usuario: administrador });
      return criado;
    }, { ...(dados.papel === "ADMINISTRADOR" ? { isolationLevel: "Serializable" as const } : {}), maxWait: 10_000, timeout: 15_000 });
  },

  async atualizar(id: number, dados: { nomeExibicao?: string; papel?: Papel }, senhaAtualAdmin: string | undefined, administradorId: number, administrador: string) {
    await garantirControle();
    return prisma.$transaction(async (tx) => {
      await bloquearOperacoesAdministrativas(tx);
      const ator = await tx.usuario.findUnique({ where: { id: administradorId } });
      if (!ator || !ator.ativo || ator.papel !== "ADMINISTRADOR") throw new Error("ATOR_SEM_PERMISSAO");
      const alvo = await tx.usuario.findUnique({ where: { id } });
      if (!alvo) return null;
      const papelMudou = dados.papel !== undefined && dados.papel !== alvo.papel;
      if (papelMudou && alvo.papel === "ADMINISTRADOR" && id !== administradorId) throw new Error("ALTERACAO_OUTRO_ADMINISTRADOR_PROIBIDA");
      if (papelMudou && dados.papel === "ADMINISTRADOR" && alvo.papel !== "ADMINISTRADOR") {
        if (!senhaAtualAdmin || !(await bcrypt.compare(senhaAtualAdmin, ator.hashSenha))) throw new Error("SENHA_ADMIN_INVALIDA");
      }
      if (papelMudou && alvo.papel === "ADMINISTRADOR" && dados.papel !== "ADMINISTRADOR") {
        const outros = await tx.usuario.count({ where: { ativo: true, papel: "ADMINISTRADOR", id: { not: id } } });
        if (outros < 1) throw new Error("ULTIMO_ADMINISTRADOR");
      }
      const antes = dadosAuditoria(alvo);
      const atualizado = await tx.usuario.update({ where: { id }, data: { ...(dados.nomeExibicao !== undefined ? { nomeExibicao: dados.nomeExibicao.trim() } : {}), ...(papelMudou ? { papel: dados.papel, versaoSeguranca: { increment: 1 } } : {}) }, select: camposPublicos });
      if (papelMudou) await tx.refreshToken.updateMany({ where: { usuarioId: id, revogado: false }, data: { revogado: true } });
      await registrarJournal(tx, { operacao: papelMudou ? "ATUALIZAR_USUARIO_E_PAPEL" : "ATUALIZAR_USUARIO", entidade: "Usuario", dadosAntes: antes, dadosDepois: dadosAuditoria(atualizado), usuario: administrador });
      return atualizado;
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 15_000 });
  },

  atualizarMeuNome(id: number, nomeExibicao: string, ator: string) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.usuario.findUnique({ where: { id } });
      if (!antes || !antes.ativo) return null;
      const atualizado = await tx.usuario.update({ where: { id }, data: { nomeExibicao: nomeExibicao.trim() }, select: camposPublicos });
      await registrarJournal(tx, { operacao: "ATUALIZAR_PROPRIO_NOME", entidade: "Usuario", dadosAntes: { id, nomeExibicao: antes.nomeExibicao }, dadosDepois: { id, nomeExibicao: atualizado.nomeExibicao }, usuario: ator });
      return atualizado;
    });
  },

  desativar(id: number, administradorId: number, administrador: string) {
    return this.alterarSituacao(id, false, administradorId, administrador);
  },

  reativar(id: number, administradorId: number, administrador: string) {
    return this.alterarSituacao(id, true, administradorId, administrador);
  },

  async alterarSituacao(id: number, ativo: boolean, administradorId: number, administrador: string) {
    await garantirControle();
    return prisma.$transaction(async (tx) => {
      await bloquearOperacoesAdministrativas(tx);
      const ator = await tx.usuario.findUnique({ where: { id: administradorId } });
      if (!ator || !ator.ativo || ator.papel !== "ADMINISTRADOR") throw new Error("ATOR_SEM_PERMISSAO");
      const alvo = await tx.usuario.findUnique({ where: { id } });
      if (!alvo) return null;
      if (!ativo && alvo.papel === "ADMINISTRADOR" && id !== administradorId) throw new Error("ALTERACAO_OUTRO_ADMINISTRADOR_PROIBIDA");
      if (!ativo && alvo.papel === "ADMINISTRADOR") {
        const outros = await tx.usuario.count({ where: { ativo: true, papel: "ADMINISTRADOR", id: { not: id } } });
        if (outros < 1) throw new Error("ULTIMO_ADMINISTRADOR");
      }
      if (alvo.ativo === ativo) return tx.usuario.findUnique({ where: { id }, select: camposPublicos });
      const atualizado = await tx.usuario.update({ where: { id }, data: { ativo, versaoSeguranca: { increment: 1 } }, select: camposPublicos });
      await tx.refreshToken.updateMany({ where: { usuarioId: id, revogado: false }, data: { revogado: true } });
      await registrarJournal(tx, { operacao: ativo ? "REATIVAR_USUARIO" : "DESATIVAR_USUARIO", entidade: "Usuario", dadosAntes: dadosAuditoria(alvo), dadosDepois: dadosAuditoria(atualizado), usuario: administrador });
      return atualizado;
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 15_000 });
  },


  async excluir(id: number, administradorId: number, administrador: string) {
    await garantirControle();
    return prisma.$transaction(async (tx) => {
      await bloquearOperacoesAdministrativas(tx);
      const ator = await tx.usuario.findUnique({ where: { id: administradorId } });
      if (!ator || !ator.ativo || ator.papel !== "ADMINISTRADOR") throw new Error("ATOR_SEM_PERMISSAO");
      if (id === administradorId) throw new Error("EXCLUSAO_PROPRIA_PROIBIDA");

      const alvo = await tx.usuario.findUnique({ where: { id } });
      if (!alvo) return false;
      if (alvo.papel === "ADMINISTRADOR" && alvo.ativo) {
        const outros = await tx.usuario.count({ where: { ativo: true, papel: "ADMINISTRADOR", id: { not: id } } });
        if (outros < 1) throw new Error("ULTIMO_ADMINISTRADOR");
      }

      // Journal e exclusão ficam na mesma transação. RefreshToken usa onDelete:Cascade;
      // não há relações de domínio apontando para Usuario e o journal guarda o ator como texto.
      await registrarJournal(tx, {
        operacao: "EXCLUIR_USUARIO",
        entidade: "Usuario",
        dadosAntes: dadosAuditoria({ ...alvo, ativo: alvo.ativo }),
        dadosDepois: { id: alvo.id, excluido: true },
        usuario: administrador,
      });
      await tx.usuario.delete({ where: { id } });
      return true;
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 15_000 });
  },

  async redefinirSenha(id: number, hashSenha: string, administradorId: number, administrador: string) {
    await garantirControle();
    return prisma.$transaction(async (tx) => {
      await bloquearOperacoesAdministrativas(tx);
      const ator = await tx.usuario.findUnique({ where: { id: administradorId } });
      if (!ator || !ator.ativo || ator.papel !== "ADMINISTRADOR") throw new Error("ATOR_SEM_PERMISSAO");
      if (id === administradorId) throw new Error("REDEFINICAO_PROPRIA_SENHA_PROIBIDA");
      const alvo = await tx.usuario.findUnique({ where: { id } });
      if (!alvo) return null;
      const atualizado = await tx.usuario.update({ where: { id }, data: { hashSenha, senhaAlteracaoObrigatoria: true, versaoSeguranca: { increment: 1 } }, select: camposPublicos });
      await tx.refreshToken.updateMany({ where: { usuarioId: id, revogado: false }, data: { revogado: true } });
      await registrarJournal(tx, { operacao: "REDEFINIR_SENHA_USUARIO", entidade: "Usuario", dadosAntes: { id: alvo.id, usuario: alvo.usuario }, dadosDepois: { id: atualizado.id, usuario: atualizado.usuario, senhaAlteracaoObrigatoria: true }, usuario: administrador });
      return atualizado;
    });
  },
};

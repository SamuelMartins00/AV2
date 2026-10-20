import bcrypt from "bcryptjs";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";

// Senhas apenas para desenvolvimento e testes
const usuarios = [
  { usuario: "admin", senha: "Admin@12345", papel: "ADMINISTRADOR" },
  { usuario: "operador", senha: "Operador@12345", papel: "OPERADOR_CADASTRO" },
  { usuario: "gestor", senha: "Gestor@12345", papel: "GESTOR_ALMOXARIFADO" },
  { usuario: "auditor", senha: "Auditor@12345", papel: "AUDITOR" },
] as const;

async function main() {
  for (const u of usuarios) {
    const hashSenha = await bcrypt.hash(u.senha, env.bcryptCusto);
    await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      update: {},
      create: { usuario: u.usuario, hashSenha, papel: u.papel },
    });
  }

  await prisma.configuracaoGlobal.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  console.log("Seed concluído.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
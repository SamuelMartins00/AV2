import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

const app = buildApp();
let encerrando = false;

async function encerrar(sinal: string): Promise<void> {
  if (encerrando) return;
  encerrando = true;

  app.log.info(`Sinal ${sinal} recebido, encerrando o servidor...`);
  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (erro) {
    app.log.error(erro);
    process.exit(1);
  }
}

process.on("SIGINT", () => void encerrar("SIGINT"));
process.on("SIGTERM", () => void encerrar("SIGTERM"));

try {
  await app.listen({ port: env.port, host: env.host });
} catch (erro) {
  app.log.error(erro);
  await prisma.$disconnect();
  process.exit(1);
}
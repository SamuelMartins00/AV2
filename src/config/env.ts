import "dotenv/config";

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente ausente: ${nome}`);
  }
  return valor;
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT deve ser um número inteiro positivo");
}

export const env = {
  port,
  host: process.env.HOST ?? "127.0.0.1",
  databaseUrl: obrigatoria("DATABASE_URL"),
  jwtSecret: obrigatoria("JWT_SECRET"),
} as const;
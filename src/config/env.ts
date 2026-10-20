import "dotenv/config";

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente ausente: ${nome}`);
  }
  return valor;
}

function inteiroPositivo(nome: string, padrao: number): number {
  const valor = Number(process.env[nome] ?? padrao);
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error(`${nome} deve ser um número inteiro positivo`);
  }
  return valor;
}

export const env = {
  port: inteiroPositivo("PORT", 3000),
  host: process.env.HOST ?? "127.0.0.1",
  databaseUrl: obrigatoria("DATABASE_URL"),
  jwtSecret: obrigatoria("JWT_SECRET"),
  jwtAccessExpira: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  refreshTtlMinutos: inteiroPositivo("REFRESH_TTL_MINUTES", 30),
  bcryptCusto: inteiroPositivo("BCRYPT_COST", 10),
} as const;
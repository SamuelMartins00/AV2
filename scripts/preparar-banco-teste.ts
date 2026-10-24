import "dotenv/config";
import { execSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("Defina TEST_DATABASE_URL no .env (ex.: .../logistica_db_test).");
  process.exit(1);
}

const nomeDoBanco = new URL(url).pathname.slice(1);
if (!nomeDoBanco.endsWith("_test")) {
  console.error(
    `O banco de testes deve terminar em "_test" (recebido: "${nomeDoBanco}").`,
  );
  process.exit(1);
}

console.log(`Aplicando as migrações em "${nomeDoBanco}"...`);
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});

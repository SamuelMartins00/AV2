import "dotenv/config";
import { defineConfig } from "vitest/config";

const urlTeste = process.env.TEST_DATABASE_URL;
if (!urlTeste) {
  throw new Error(
    "Defina TEST_DATABASE_URL no .env com um banco exclusivo para testes (ex.: logistica_db_test).",
  );
}

// Os testes apagam todos os dados do banco: por isso só rodam em um banco
// cujo nome termina em "_test". O banco de desenvolvimento nunca é tocado.
export default defineConfig({
  test: {
    include: ["tests/integracao/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: urlTeste,
      JWT_SECRET: "segredo-de-teste-da-integracao",
      BCRYPT_COST: "4",
      REFRESH_TTL_MINUTES: "30",
    },
  },
});

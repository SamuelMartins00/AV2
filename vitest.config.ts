import { configDefaults, defineConfig } from "vitest/config";
// Testes unitários: rápidos e sem banco de dados.
// Os testes de integração têm configuração própria (vitest.integracao.config.ts).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/integracao/**"],
  },
});

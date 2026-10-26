# AV2 — Logítica Green

API REST de logística reversa de equipamentos eletrônicos, construída com Node.js, TypeScript, Fastify, Prisma 7.10.1, `@prisma/adapter-mariadb` e MySQL 8.

## Requisitos

- Node.js 22.12 ou superior.
- Docker Engine com Docker Compose, ou um servidor MySQL 8.0.16 ou superior.
- Acesso de rede ao MySQL configurado em `.env`.

## Configuração local — Windows (PowerShell)

1. Crie a configuração local a partir do exemplo:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

2. Edite `.env` e defina credenciais locais, `JWT_SECRET` forte e os nomes corretos dos bancos. Não compartilhe nem versione `.env`. O exemplo usa `logistica_db` para desenvolvimento e `logistica_db_test` exclusivamente para testes de integração.
3. Inicie o MySQL de desenvolvimento e teste:

   ```powershell
   docker compose up -d
   ```

4. Instale exatamente as dependências versionadas e gere o cliente Prisma:

   ```powershell
   npm ci
   npm run db:generate
   ```

5. **Antes de aplicar migrações**, confira em `.env` que `DATABASE_URL` aponta para o banco de desenvolvimento correto. Em uma instalação nova, aplique as migrações versionadas:

   ```powershell
   npx prisma migrate deploy
   ```

6. Opcionalmente, depois de confirmar novamente o banco em `DATABASE_URL`, crie os dados demonstrativos:

   ```powershell
   npm run db:seed
   ```

7. Inicie a API:

   ```powershell
   npm run dev
   ```

A API fica em `http://localhost:3000`; a documentação Swagger fica em `http://localhost:3000/docs`. A porta e o host podem ser alterados por `PORT` e `HOST`.

## Configuração local — Ubuntu

Os comandos são equivalentes em Bash:

```bash
cp .env.example .env
nano .env
docker compose up -d
npm ci
npm run db:generate
# Confira DATABASE_URL e o nome do banco antes de continuar.
npx prisma migrate deploy
# Opcional: confira DATABASE_URL antes de executar o seed.
npm run db:seed
npm run dev
```

Não use o banco de testes para desenvolvimento. Não execute migrações em produção sem revisão e autorização próprias. O comando `npm run db:migrate` usa `prisma migrate dev` e deve ser reservado ao desenvolvimento, após conferir explicitamente o destino configurado.

## Bancos e Docker

- Desenvolvimento: `logistica_db`.
- Testes de integração: `logistica_db_test` (o nome precisa terminar em `_test`).
- `docker/init.sql` cria os dois bancos quando o volume MySQL é inicializado pela primeira vez. Se já houver um volume criado anteriormente, verifique quais bancos existem antes de executar qualquer alteração; o script de inicialização do MySQL não é reexecutado automaticamente em volumes existentes.
- `docker compose down` para os serviços sem remover o volume. Não use `docker compose down -v` como procedimento de rotina.

A suíte de integração contém operações de limpeza das tabelas. Ela verifica o sufixo `_test` antes de executar e nunca deve ser apontada para desenvolvimento ou produção.

## Testes e validação

```powershell
npm test
npm run test:integracao
npx prisma validate
npm run db:generate
npm run typecheck
npm run build
git diff --check
```

Em Ubuntu, use os mesmos comandos em Bash. `npm test` executa os testes unitários; `npm run test:integracao` usa `TEST_DATABASE_URL` do `.env` e a configuração de integração. Confirme que essa URL aponta para o banco exclusivo `logistica_db_test` antes de executar. Não rode a suíte de integração se o destino não puder ser confirmado.

## Funcionalidades principais

- Autenticação JWT e refresh tokens rotativos.
- Autorização por papéis: administrador, operador de cadastro, gestor de almoxarifado e auditor.
- Organizações e contratos, incluindo encerramento antecipado e renovação controlada.
- Lotes, triagem individual, movimentações e rastreabilidade de equipamentos.
- Exclusão segura de lotes vazios e equipamentos sem histórico operacional por `DELETE /api/v1/lotes/:id` e `DELETE /api/v1/equipamentos/:id` (papéis `ADMINISTRADOR` e `GESTOR_ALMOXARIFADO`); vínculos e histórico bloqueiam a remoção.
- Baixa definitiva autorizada, justificada e auditada.
- Relatórios por organização, status e valores contratuais mensais.
- Parâmetros globais persistidos de impostos e depreciação.
- Journal de operações de domínio e eventos de segurança de autenticação; consulta somente de leitura em `GET /api/v1/auditoria/journal` para administrador e auditor.

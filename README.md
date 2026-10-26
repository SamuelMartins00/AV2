<h1 align="center">AV2 — Logística Green</h1>

<p align="center">
  API REST para gestão de logística reversa de equipamentos eletrônicos, com autenticação, rastreabilidade, auditoria e relatórios.
</p>

---

## Descrição do Sistema

O **Logística Green** é uma API REST desenvolvida para apoiar o gerenciamento do fluxo de logística reversa de equipamentos eletrônicos. A aplicação organiza o cadastro de organizações e contratos, o recebimento de lotes, a triagem e movimentação de equipamentos, além da rastreabilidade e auditoria das operações.

O projeto utiliza uma arquitetura em camadas, com rotas, controllers, services e repositories, e disponibiliza documentação interativa dos endpoints por meio do Swagger.

---

## Tecnologias Utilizadas

| Camada | Tecnologia |
|---|---|
| **Runtime** | Node.js 22.12 ou superior |
| **Linguagem** | TypeScript |
| **API HTTP** | Fastify 5 |
| **ORM e cliente de banco** | Prisma 7.10.1 |
| **Adaptador de banco** | `@prisma/adapter-mariadb` |
| **Banco de dados** | MySQL 8.0.16 ou superior |
| **Documentação da API** | Swagger / OpenAPI (`@fastify/swagger` e `@fastify/swagger-ui`) |
| **Autenticação** | JWT e refresh tokens rotativos |
| **Testes** | Vitest |
| **Containerização do banco** | Docker Engine e Docker Compose |

---

## Autenticação e Perfis de Acesso

A API utiliza autenticação JWT e controle de acesso baseado em papéis. Os perfis existentes são:

- **ADMINISTRADOR** — acesso administrativo conforme as políticas da API.
- **OPERADOR_CADASTRO** — operações de cadastro autorizadas para o perfil.
- **GESTOR_ALMOXARIFADO** — operações de almoxarifado autorizadas para o perfil.
- **AUDITOR** — consulta de informações de rastreabilidade e auditoria conforme as permissões definidas.

As permissões são verificadas nos endpoints; não presuma que um usuário autenticado pode executar todas as operações. Por exemplo, a exclusão de lotes e equipamentos é restrita a `ADMINISTRADOR` e `GESTOR_ALMOXARIFADO`, e ainda depende das regras de exclusão segura.

---

## Funcionalidades Principais

- **Autenticação e sessões** — JWT, refresh tokens rotativos, logout e invalidação de sessões conforme as regras do sistema.
- **Organizações e contratos** — cadastro, atualização, controle de vigência, renovação e encerramento de contratos.
- **Lotes** — registro de lotes e controle de versão.
- **Equipamentos** — cadastro, triagem, movimentações e rastreabilidade.
- **Exclusão segura** — `DELETE /api/v1/lotes/:id` permite excluir apenas lotes recebidos sem equipamentos vinculados; `DELETE /api/v1/equipamentos/:id` permite excluir equipamentos que atendam aos critérios de ausência de histórico operacional.
- **Baixa definitiva** — operação autorizada, justificada e auditada.
- **Relatórios** — consultas por organização, status e valores contratuais mensais.
- **Parâmetros globais** — configuração persistida de impostos e depreciação.
- **Journal de auditoria** — registro de operações de domínio e eventos de segurança; consulta somente de leitura em `GET /api/v1/auditoria/journal`, restrita a administrador e auditor.
- **Documentação interativa** — endpoints e contratos HTTP publicados no Swagger.

---

## Estrutura do Projeto

```text
├── docker
│   └── init.sql                              
├── docs
│   ├── prints
│   │   ├── linux0.png
│   │   ├── linux1.png
│   │   ├── linux2.png
│   │   └── swagger.png
│   ├── DECISOES.md
│   ├── ENTENDENDO_AV2.md
│   ├── Regras_de_Negocio.md
│   └── VPC_AV2.md
├── prisma
│   ├── migrations
│   │   ├── 20261019234026_init
│   │   │   └── migration.sql
│   │   ├── 20261019234443_checks
│   │   │   └── migration.sql
│   │   ├── 20261024170000_gestao_usuarios
│   │   │   └── migration.sql
│   │   ├── 20261025120000_controle_contratos_renovacao
│   │   │   └── migration.sql
│   │   ├── 20261025190000_triagem_individual_baixa_definitiva
│   │   │   └── migration.sql
│   │   ├── 20261026160000_config_valor_base_positivo
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   ├── schema.prisma
│   └── seed.ts
├── scripts
│   └── preparar-banco-teste.ts
├── src
│   ├── config
│   │   ├── env.ts
│   │   └── prisma.ts
│   ├── dominio
│   │   ├── validadores
│   │   │   ├── cnpj.ts
│   │   │   └── data-entrada.ts
│   │   ├── contrato.ts
│   │   ├── enums.ts
│   │   ├── equipamento.ts
│   │   ├── erros.ts
│   │   ├── financeiro.ts
│   │   ├── papel.ts
│   │   ├── parametros.ts
│   │   ├── periodo.ts
│   │   └── tentativas.ts
│   ├── modules
│   │   ├── auditoria
│   │   │   ├── auditoria.controller.ts
│   │   │   ├── auditoria.repository.ts
│   │   │   ├── auditoria.routes.ts
│   │   │   ├── auditoria.schemas.ts
│   │   │   ├── auditoria.service.ts
│   │   │   └── journal.ts
│   │   ├── auth
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.repository.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.schemas.ts
│   │   │   └── auth.service.ts
│   │   ├── compartilhado
│   │   │   └── params.ts
│   │   ├── configuracao
│   │   │   ├── configuracao.controller.ts
│   │   │   ├── configuracao.repository.ts
│   │   │   ├── configuracao.routes.ts
│   │   │   ├── configuracao.schemas.ts
│   │   │   └── configuracao.service.ts
│   │   ├── equipamentos
│   │   │   ├── equipamentos.controller.ts
│   │   │   ├── equipamentos.mapper.ts
│   │   │   ├── equipamentos.repository.ts
│   │   │   ├── equipamentos.routes.ts
│   │   │   ├── equipamentos.schemas.ts
│   │   │   └── equipamentos.service.ts
│   │   ├── lotes
│   │   │   ├── lotes.controller.ts
│   │   │   ├── lotes.repository.ts
│   │   │   ├── lotes.routes.ts
│   │   │   ├── lotes.schemas.ts
│   │   │   └── lotes.service.ts
│   │   ├── organizacoes
│   │   │   ├── organizacoes.controller.ts
│   │   │   ├── organizacoes.repository.ts
│   │   │   ├── organizacoes.routes.ts
│   │   │   ├── organizacoes.schemas.ts
│   │   │   └── organizacoes.service.ts
│   │   ├── relatorios
│   │   │   ├── relatorios.controller.ts
│   │   │   ├── relatorios.repository.ts
│   │   │   ├── relatorios.routes.ts
│   │   │   ├── relatorios.schemas.ts
│   │   │   └── relatorios.service.ts
│   │   └── usuarios
│   │       ├── usuarios.controller.ts
│   │       ├── usuarios.politica.ts
│   │       ├── usuarios.repository.ts
│   │       ├── usuarios.routes.ts
│   │       ├── usuarios.schemas.ts
│   │       └── usuarios.service.ts
│   ├── plugins
│   │   ├── auth.ts
│   │   └── swagger.ts
│   ├── types
│   │   └── fastify.d.ts
│   ├── app.ts
│   └── server.ts
├── tests
│   ├── integracao
│   │   └── jornada.test.ts
│   ├── cnpj.test.ts
│   ├── contrato.test.ts
│   ├── data-entrada.test.ts
│   ├── equipamento.test.ts
│   ├── financeiro.test.ts
│   ├── parametros.test.ts
│   ├── periodo.test.ts
│   └── usuarios-politica.test.ts
├── .env.example
├── .gitattributes
├── .gitignore
├── README.md
├── docker-compose.yml
├── package-lock.json
├── package.json
├── prisma.config.ts
├── tsconfig.json
├── vitest.config.ts
└── vitest.integracao.config.ts
```

---

## Requisitos

- Node.js **22.12 ou superior** e npm.
- Docker Engine com o plugin Docker Compose, ou um servidor MySQL **8.0.16 ou superior**.
- Acesso de rede ao MySQL configurado em `.env`.
- Git para clonar o repositório.

---

## Configuração Local — Windows (PowerShell)

### 1. Criar e configurar o `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

Edite `.env`, configure credenciais locais e defina um `JWT_SECRET` forte. Não compartilhe nem versione esse arquivo. O exemplo utiliza `logistica_db` para desenvolvimento e `logistica_db_test` exclusivamente para testes de integração.

### 2. Iniciar o MySQL

Com o Docker Desktop aberto:

```powershell
docker compose up -d
docker compose ps
```

### 3. Instalar dependências e gerar o cliente Prisma

```powershell
npm ci
npm run db:generate
```

### 4. Aplicar as migrações

**Antes de aplicar migrações**, confira em `.env` se `DATABASE_URL` aponta para o banco de desenvolvimento correto. Em uma instalação nova, aplique as migrações versionadas:

```powershell
npx prisma migrate deploy
```

Opcionalmente, depois de confirmar novamente o banco indicado em `DATABASE_URL`, crie os dados demonstrativos:

```powershell
npm run db:seed
```

### 5. Iniciar a API

```powershell
npm run dev
```

A API estará disponível em `http://localhost:3000` e a documentação Swagger em `http://localhost:3000/docs`. O host e a porta podem ser alterados pelas variáveis `HOST` e `PORT`.

---

## Como Instalar o Docker no Linux 

Os comandos abaixo são para uma instância Ubuntu. Se estiver usando outra distribuição Linux, consulte as instruções oficiais correspondentes.

### 1. Atualizar os pacotes e instalar os pré-requisitos

```bash
sudo apt update
sudo apt install -y ca-certificates curl
```

### 2. Instalar o Docker Engine e o Docker Compose

Para um ambiente de laboratório ou validação, pode-se usar o script de instalação disponibilizado pelo Docker:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Verifique se o serviço está ativo e se os comandos estão disponíveis:

```bash
sudo systemctl enable --now docker
sudo docker --version
sudo docker compose version
sudo docker run --rm hello-world
```

> **Observação de segurança:** para ambientes de produção, prefira seguir o procedimento de instalação pelo repositório oficial do Docker para a distribuição utilizada. O script de conveniência é apresentado aqui para facilitar a preparação de um ambiente de laboratório.

### 3. (Opcional) Usar Docker sem `sudo`

```bash
sudo usermod -aG docker "$USER"
```

Depois, encerre a sessão SSH e conecte-se novamente para que a alteração de grupo tenha efeito. O grupo `docker` concede privilégios elevados, equivalentes na prática a acesso administrativo ao host; adicione somente usuários confiáveis. Até a nova sessão iniciar, continue usando `sudo docker`.

### 4. Preparar o projeto na instância

Instale também Node.js 22.12 ou superior e npm, usando um método apropriado para a distribuição e a política do ambiente. Depois, clone o repositório e entre na pasta do projeto:

```bash
git clone https://github.com/SamuelMartins00/AV2.git
cd AV2
```

Se o repositório já estiver clonado na instância, entre na pasta existente em vez de cloná-lo novamente.

### 5. Configurar e iniciar o banco de dados

```bash
cp .env.example .env
nano .env
docker compose up -d
docker compose ps
```

O arquivo `.env.example` usa `localhost` para a conexão da API com o MySQL. Isso é apropriado quando a API é executada diretamente na própria instância Linux e o MySQL publica a porta `3306` no host. Altere as credenciais de exemplo antes de usar o ambiente.

### 6. Instalar dependências, migrar e iniciar a API

```bash
npm ci
npm run db:generate
# Confirme DATABASE_URL e o banco de destino antes de aplicar migrações.
npx prisma migrate deploy
# Opcional: confirme DATABASE_URL antes de criar dados demonstrativos.
npm run db:seed
```

Para iniciar a API em uma sessão de terminal:

```bash
HOST=0.0.0.0 PORT=3000 npm run dev
```

Para um processo de execução mais estável, compile e use o comando de produção configurado no projeto:

```bash
npm run build
HOST=0.0.0.0 PORT=3000 npm start
```

A API escuta na porta `3000`. Para acessá-la externamente na AWS, configure o Security Group para permitir somente as origens e portas necessárias. Não exponha a porta `3306` do MySQL à internet pública. Para uso de produção, configure também gerenciamento seguro de segredos e um supervisor de processo apropriado.

A documentação Swagger ficará em `http://<IP-PÚBLICO-OU-DNS-DA-EC2>:3000/docs` se a porta estiver acessível pelas regras de rede. Se estiver executando localmente, acesse `http://localhost:3000/docs`.

---

## Variáveis de Ambiente

Crie o arquivo `.env` a partir de `.env.example` e configure os valores de acordo com o ambiente. Não versione credenciais nem segredos reais.

| Variável | Descrição | Exemplo local |
|---|---|---|
| `DATABASE_URL` | URL de conexão do banco usado pela aplicação e por comandos Prisma | `mysql://root:senha@localhost:3306/logistica_db` |
| `TEST_DATABASE_URL` | URL exclusiva do banco usado nos testes de integração; o nome deve terminar em `_test` | `mysql://root:senha@localhost:3306/logistica_db_test` |
| `HOST` | Interface de rede na qual a API escuta | `127.0.0.1` local; `0.0.0.0` para acesso pela rede/contêiner |
| `PORT` | Porta HTTP da API | `3000` |
| `JWT_SECRET` | Segredo usado para assinar tokens JWT; configure um valor longo, aleatório e privado | Gere um segredo forte para o ambiente |
| `JWT_ACCESS_EXPIRES` | Tempo de validade do access token | `15m` |
| `REFRESH_TTL_MINUTES` | Tempo de validade do refresh token em minutos | `30` |
| `BCRYPT_COST` | Custo configurado para o hash de senhas | `10` |

O `.env.example` é apenas um modelo. Troque senhas e segredos antes de iniciar uma implantação acessível por outras pessoas.

---

## Bancos de Dados e Docker Compose

- **Desenvolvimento:** `logistica_db`.
- **Testes de integração:** `logistica_db_test`; o nome precisa terminar em `_test`.
- O arquivo `docker/init.sql` cria os dois bancos quando o volume do MySQL é inicializado pela primeira vez.
- Se o volume já existir, o script de inicialização não será executado novamente automaticamente. Verifique os bancos existentes antes de executar alterações.
- `docker compose down` interrompe e remove os serviços, mas mantém o volume de dados.
- Evite `docker compose down -v`: esse comando remove o volume e pode apagar os dados do MySQL.

A suíte de integração contém operações de limpeza de tabelas. Ela verifica o sufixo `_test` e nunca deve ser apontada para o banco de desenvolvimento ou de produção.

---

## Testes e Validação

Execute na raiz do projeto:

```bash
npm test
npm run test:integracao
npx prisma validate
npm run db:generate
npm run typecheck
npm run build
git diff --check
```

- `npm test` executa os testes unitários.
- `npm run test:integracao` executa os testes de integração e usa `TEST_DATABASE_URL` do `.env` e a configuração de integração.
- Antes dos testes de integração, confirme que `TEST_DATABASE_URL` aponta exclusivamente para `logistica_db_test` ou outro banco de teste cujo nome termine em `_test`.
- Não execute a suíte se não puder confirmar o destino do banco.

O comando `npm run db:migrate` utiliza `prisma migrate dev` e deve ser reservado ao desenvolvimento, após confirmar explicitamente o banco configurado. Não execute migrações em produção sem revisão e autorização próprias.

---

## Acesso à API e Swagger

Com a API em execução:

| Recurso | Endereço local | Finalidade |
|---|---|---|
| API REST | `http://localhost:3000` | Endpoints da API |
| Swagger UI | `http://localhost:3000/docs` | Explorar e testar os endpoints documentados |
| Verificação de saúde | `http://localhost:3000/api/v1/saude` | Verificar a disponibilidade da API e a conexão com o banco |

As rotas de negócio utilizam o prefixo `/api/v1`. As operações protegidas exigem autenticação e respeitam as permissões associadas ao papel do usuário.

---

## Segurança e Cuidados Operacionais

- Não versione nem compartilhe `.env`, senhas, tokens ou chaves JWT.
- Use credenciais fortes e exclusivas para ambientes compartilhados.
- Não exponha o MySQL publicamente; limite o acesso de rede ao necessário.
- Antes de migrar ou semear dados, confirme o banco configurado em `DATABASE_URL`.
- Antes dos testes de integração, confirme `TEST_DATABASE_URL` e o sufixo `_test`.
- Não remova volumes Docker sem compreender que isso pode apagar os dados persistidos.
- Em produção, revise migrações, segredos, regras de rede, logs e processo de inicialização antes de publicar a aplicação.

## Prints de comprovação
<p align="start">
  <img src="./docs/prints/linux0.png" width="400">
  <img src="./docs/prints/linux1.png" width="400">
  <img src="./docs/prints/linux2.png" width="400">
  <img src="./docs/prints/swagger.png" width="400">
</p>
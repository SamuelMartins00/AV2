# Registro de decisões arquiteturais — AV2 / Logística Green

Este documento registra decisões que podem ser sustentadas pelo código atual.

## Decisões adotadas

### D-01 — API monolítica em camadas

- **Decisão:** API REST Fastify com módulos separados em rotas, controllers, services e repositories, além de funções de domínio em `src/dominio/`.
- **Motivo:** manter as regras de negócio separadas da camada HTTP e da persistência sem introduzir a complexidade de microserviços além de ser requisito da atividade
- **Alternativa não adotada:** dividir os módulos em serviços independentes. Não há necessidade comprovada no escopo atual.
- **Trade-off:** o deploy é simples, mas os módulos compartilham o mesmo processo e banco.

### D-02 — TypeScript, Fastify, Prisma 7 e MySQL

- **Decisão:** Node.js 22.12+, TypeScript, Fastify 5, Prisma 7.10.1, `@prisma/adapter-mariadb` e MySQL 8.0.16+.
- **Motivo:** validação de entrada, tipos gerados, persistência relacional e suporte a constraints `CHECK`.
- **Alternativa não adotada:** substituir ORM, driver ou versão principal nesta etapa. Não há evidência de que isso seja necessário.
- **Trade-off:** a configuração do adapter e as migrações SQL precisam ser mantidas compatíveis com o MySQL.

### D-03 — Modelo relacional e preservação de histórico

- **Decisão:** organizações, contratos, lotes, equipamentos e movimentações possuem relações e restrições referenciais; exclusões físicas são restringidas quando podem quebrar o histórico.
- **Motivo:** preservar rastreabilidade e integridade referencial.
- **Alternativa não adotada:** apagar fisicamente registros operacionais com histórico.

### D-04 — Autenticação e papéis

- **Decisão:** JWT de acesso, refresh tokens persistidos como hashes, rotação de refresh token e autorização por papel nas rotas.
- **Motivo:** sessões revogáveis e menor privilégio por operação.
- **Trade-off:** os eventos de autenticação do journal são best-effort e não fazem parte da transação de sessão; o endpoint não deve expor tokens ou credenciais.

### D-05 — Transações e concorrência

- **Decisão:** operações que atualizam entidades relacionadas e o journal usam transações Prisma; entidades com mutações concorrentes utilizam campos de versão e verificações condicionais quando previstos no fluxo.
- **Motivo:** impedir commits parciais e detectar conflitos de atualização.
- **Limitação:** não há controle de versão explícito para a configuração global; alterações concorrentes nessa linha seguem a política do banco e da operação atual.

### D-06 — Journal de auditoria

- **Decisão:** reutilizar `JournalTransacao` para operações de domínio e eventos de segurança, com entidade, operação, responsável, timestamp e snapshots quando aplicáveis.
- **Motivo:** manter uma fonte comum de auditoria.
- **Alternativa não adotada:** criar um mecanismo paralelo de journal.
- **Limitação:** a gravação de eventos de autenticação é independente e best-effort porque falhas de login não possuem uma transação de domínio a compartilhar; não se afirma atomicidade nesses eventos.

### D-07 — Triagem individual e baixa definitiva

- **Decisão:** `resultadoTriagem` representa a decisão de destino e não substitui `statusRastreamento`, que representa a situação operacional. A baixa definitiva é uma operação separada, autorizada e justificada.
- **Motivo:** não confundir a decisão de triagem com a execução física nem inferir decisões de registros históricos.
- **Trade-off:** relatórios operacionais atuais não reconstroem automaticamente estados históricos a partir do journal.

### D-08 — Configuração global persistida

- **Decisão:** a linha `ConfiguracaoGlobal` fornece alíquota de impostos e parâmetros de depreciação consumidos pelos services. O seed inicializa a configuração; o GET é somente leitura.
- **Motivo:** manter uma fonte persistente comum e auditar alterações explícitas.
- **Limitação:** a constraint SQL de `valorBaseDepreciacao` ainda precisa ser alinhada à regra de domínio (> 0) após a verificação dos dados existentes. A migração foi deliberadamente adiada até essa verificação.

### D-09 — Relatórios

- **Decisão:** o relatório financeiro inclui contratos vigentes em algum instante do período, considerando assinatura, vencimento e encerramento antecipado. Os valores são valores contratuais mensais.
- **Motivo:** representar sobreposição temporal da vigência efetiva.
- **Limitação:** não representa receita recebida ou reconhecimento contábil. O relatório por organização agrupa equipamentos pela situação atual, não reconstrói snapshots históricos.

### D-10 — Ambientes e testes

- **Decisão:** desenvolvimento usa `logistica_db`; testes de integração usam `logistica_db_test`, cujo nome deve terminar em `_test`.
- **Motivo:** separar dados operacionais dos dados que a suíte de integração limpa.
- **Trade-off:** a configuração do `.env` deve ser verificada antes de aplicar migrações ou rodar a suíte de integração.

### D-11 — Exclusão física condicionada de lotes e equipamentos

- **Decisão:** disponibilizar `DELETE /api/v1/lotes/:id` e `DELETE /api/v1/equipamentos/:id` sem exclusão em cascata e sem novos estados de exclusão lógica.
- **Lote:** excluir fisicamente somente quando estiver em `RECEBIDO` e sem equipamentos. Se houver equipamentos ou o lote já estiver em outro estado operacional, responder HTTP 409. A operação não remove equipamentos para satisfazer a condição.
- **Equipamento:** excluir fisicamente somente no estado inicial, sem movimentações, dados de triagem/baixa ou eventos operacionais próprios no journal. Se houver histórico operacional, bloquear a remoção com HTTP 409. Não confundir exclusão cadastral com baixa definitiva.
- **Autorização:** reutilizar os papéis já autorizados a gerir lotes/equipamentos (`ADMINISTRADOR` e `GESTOR_ALMOXARIFADO`); não ampliar a autorização para operador ou auditor.
- **Integridade e concorrência:** verificar vínculos antes da remoção, condicionar o `deleteMany` à versão lida e manter as FKs `onDelete: Restrict` como proteção final contra corridas. Conflitos concorrentes são reportados como 409.
- **Auditoria:** gravar `EXCLUIR` com snapshot anterior dentro da mesma transação. Se o journal falhar, a exclusão não deve ser confirmada. Os eventos de auditoria existentes não são apagados.
- **Alternativas rejeitadas:** exclusão em cascata de equipamentos/movimentações; exclusão de equipamentos já triados ou baixados; exclusão lógica improvisada com novos campos/estados; remoção de registros históricos para contornar FKs.
- **Limitação:** o journal mantém snapshots JSON e não possui FK para lote/equipamento. A remoção segura depende das verificações do service/repository, controle de versão e constraints relacionais existentes.

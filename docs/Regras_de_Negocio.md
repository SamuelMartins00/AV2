# Regras de Negócio — AV2 / Logítica Green

> Este documento descreve regras identificadas no código presente no repositório.

## 1. Usuários, autenticação e autorização

- O login (`Usuario.usuario`) é único. A conta contém nome de exibição, hash de senha, papel, estado ativo, versão de segurança e último acesso. Fonte: modelo Prisma `Usuario` e restrição única no banco.
- Papéis existentes: `ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO` e `AUDITOR`.
- A gestão administrativa de usuários exige autenticação e papel `ADMINISTRADOR`. `/usuarios/me` e alteração do próprio nome exigem autenticação.
- Nome de exibição é aparado e deve ter de 2 a 100 caracteres. Listagem: página padrão 1, limite padrão 20 e limite máximo 100.
- Senhas são armazenadas com bcrypt. Criação/redefinição exige 8–72 caracteres. Criar ou promover administrador exige confirmação da senha atual do administrador.
- Desativação, reativação, redefinição de senha e alteração de papel revogam refresh tokens ativos. Operações de mudança de papel/situação e redefinição incrementam a versão de segurança conforme o código.
- A aplicação impede desativar o último administrador ativo, alterar o papel de outro administrador e redefinir a própria senha pelo endpoint administrativo.
- **Exclusão de usuário implementada neste trabalho:** somente administrador; não permite autoexclusão nem excluir o último administrador ativo. A exclusão e o evento `EXCLUIR_USUARIO` são gravados na mesma transação. Refresh tokens relacionados são removidos pela relação `onDelete: Cascade`. O journal guarda o responsável como texto, sem FK para a conta excluída.
- Eventos de segurança de autenticação são best-effort: falha no journal não reverte a operação de autenticação. Eventos de negócio que usam `registrarJournal(tx, ...)` dentro da transação são atômicos com a alteração correspondente.

**Limites:** o modelo contém `versaoSeguranca`; a invalidação de access tokens depende também da validação feita pelo plugin/fluxo de autenticação. A política de autoexclusão foi adotada para evitar perda da conta do administrador autenticado. Se o negócio desejar outra política, ela precisa ser decidida explicitamente.

## 2. Organizações e contratos

- CNPJ de organização é único. Organização possui razão social, endereço, dados de contato, data de cadastro, estado ativo e versão.
- Uma organização possui no máximo um contrato associado pelo campo único `Contrato.organizacaoId`; a relação usa `onDelete: Restrict`.
- Contrato armazena datas de assinatura/vencimento, cláusulas JSON, valor mensal decimal, renovação automática, duração da renovação, encerramento/motivo e versão.
- Há operações de criação, renovação, encerramento, correção retroativa de encerramento e reativação de organização. A reativação passa pelas condições de contrato implementadas no serviço.
- Operações de renovação automática possuem estados, tentativas, janelas de reivindicação, próxima tentativa e chave única por contrato/vencimento original. A execução efetiva e os critérios de retry/intervenção manual dependem do serviço que processa essas operações; a mera existência do indicador `renovacaoAutomatica` não prova que o contrato será renovado sem falhas.

## 3. Lotes

- Lote pertence a uma organização existente e contém data de entrada, nota fiscal, transportadora, observações opcionais, status e versão. A relação com organização usa `onDelete: Restrict`.
- Estados de lote: `RECEBIDO`, `EM_TRIAGEM`, `TRIAGEM_CONCLUIDA`, `ENCAMINHADO` e `FINALIZADO`.
- Existem endpoints para criar/listar/consultar lotes, adicionar equipamentos e concluir triagem do lote.
- A posição do equipamento é única dentro do lote (`@@unique([loteId, posicaoNoLote])`).
- **Cancelamento de lote: não implementado nas rotas identificadas.** Não inferir política de cancelamento sem decisão explícita.
- **Exclusão física de lote:** `DELETE /api/v1/lotes/:id` é permitida para `ADMINISTRADOR` e `GESTOR_ALMOXARIFADO` somente quando o lote está em `RECEBIDO` e não possui equipamentos vinculados. Lote inexistente retorna 404; estado incompatível, vínculos ou conflito concorrente retornam 409. A verificação é feita no service/repository e a FK `Lote.organizacao` com `onDelete: Restrict` continua protegendo a integridade.
- A exclusão não apaga equipamentos automaticamente. Um lote com qualquer equipamento vinculado não pode ser excluído, mesmo que os equipamentos ainda não tenham histórico.

## 4. Equipamentos, triagem e baixa definitiva

- Equipamento possui código de barras interno único, lote, posição, tipo, marca, modelo, ano de fabricação, estado físico, status de rastreamento, resultado de triagem, peso e versão.
- Tipos, estados físicos, status de rastreamento e resultados de triagem são enums definidos no Prisma.
- **Estado físico** (condição do item), **status de rastreamento** (etapa operacional) e **resultado de triagem** (destinação indicada) são conceitos separados.
- Triagem individual pode registrar resultado, responsável, data/hora e justificativa. A triagem de lote possui endpoint próprio.
- Baixa definitiva possui campos próprios para data/hora, responsável e justificativa; a rota exige administrador e a implementação registra controle de versão e auditoria.
- Existem rotas de consulta/histórico, alteração de estado físico, alteração de status, movimentação, triagem individual e baixa definitiva.
- As regras de transição entre estados dependem dos validadores e serviços; não se deve presumir que todas as combinações dos enums sejam transições válidas.
- **Exclusão física de equipamento:** `DELETE /api/v1/equipamentos/:id` é permitida para `ADMINISTRADOR` e `GESTOR_ALMOXARIFADO` apenas quando o equipamento permanece no estado inicial (`AGUARDANDO_TRIAGEM` e `AGUARDANDO_AVALIACAO`), não possui campos de triagem/baixa preenchidos, movimentações nem eventos operacionais no journal que identifiquem o equipamento. A operação não é baixa definitiva nem altera o estado operacional.
- Equipamentos com triagem, mudança operacional registrada, movimentação, desmontagem ou baixa definitiva são preservados e a exclusão é bloqueada com HTTP 409. Equipamento inexistente retorna 404.
- A exclusão de equipamento não exclui o lote pai. A FK `Movimentacao.equipamento` usa `onDelete: Restrict`; se houver uma movimentação que escape à verificação prévia, a restrição do banco bloqueia a exclusão.

## 5. Movimentações e rastreabilidade

- Cada movimentação referencia um equipamento existente e guarda data/hora, origem, destino, responsável e observação opcional. A relação usa `onDelete: Restrict`.
- Há consulta de histórico do equipamento e movimentações. A leitura do histórico permite administrador, gestor e auditor; movimentações operacionais são restritas a administrador/gestor conforme as rotas.
- Quando alteração de negócio e journal são feitos na mesma transação, ambos confirmam ou falham juntos.
- Origem e destino são texto, não referências a um catálogo de locais. Não presumir que localização atual seja sempre derivada da última movimentação sem confirmar a implementação da consulta específica.

## 6. Relatórios

- Existem relatórios por organização/período, por status de equipamentos e financeiro por período. As rotas são restritas a administrador e auditor.
- O relatório financeiro aplica as condições temporais e de vigência/encerramento presentes no repositório.
- Valores monetários são armazenados em campos `Decimal`.

## 7. Configuração global

- Há registro de configuração global com `id=1`, alíquota de impostos, coeficiente de depreciação e valor-base de depreciação.
- Defaults do modelo: alíquota `0.18`, coeficiente `0.2`, valor-base `1000`.
- Migrations impõem limites para os parâmetros e a migration `20261026160000_config_valor_base_positivo` exige valor-base maior que zero.
- Leitura e alteração são rotas separadas; a alteração exige administrador.
- A restrição SQL só vale em cada ambiente depois que a migration correspondente tiver sido aplicada naquele banco.

## 8. Auditoria e integridade

- `JournalTransacao` guarda timestamp, operação, entidade, snapshots JSON antes/depois e responsável textual.
- Existe endpoint paginado de leitura do journal com filtros definidos pelo schema/serviço, restrito a administrador/auditor.
- `registrarJournal(tx, ...)` grava na transação de negócio; se falhar, a transação deve falhar. Eventos de segurança de autenticação são best-effort e podem faltar se o journal não estiver disponível.
- Tokens, senhas e hashes não devem ser gravados no journal.
- Relações de organização/contrato, organização/lote, lote/equipamento e equipamento/movimentação usam restrições referenciais para evitar remoção em cascata de dados operacionais.
- Exclusões de lote/equipamento permitidas são registradas como `EXCLUIR` no journal dentro da mesma transação da exclusão. Se a gravação do journal falhar, a transação não deve confirmar a remoção. O snapshot anterior é preservado no journal como JSON; não há FK do journal para esses modelos.
- Como o responsável do journal é texto e não FK, a auditoria mantém o nome do ator após excluir a conta, mas não oferece vínculo relacional com o usuário original.

## 9. Validações e concorrência

- Schemas Fastify definem tipos, campos obrigatórios, limites, formatos e propriedades permitidas nas rotas onde estão registrados.
- IDs administrativos de usuário devem seguir o padrão textual de inteiro positivo. Paginação de usuários segue `page >= 1` e `1 <= limit <= 100`.
- O banco protege unicidade de login, CNPJ, código de barras interno e posição no lote, além das relações declaradas.
- Operações que alteram o conjunto de administradores bloqueiam a linha de controle de `ConfiguracaoGlobal` e usam transações. Conflitos concorrentes reconhecidos são convertidos em HTTP 409.
- Exclusão física não é uma regra geral para entidades operacionais. Lotes só podem ser excluídos vazios e em estado inicial; equipamentos só podem ser excluídos sem histórico operacional. A exclusão de usuário segue política específica documentada na seção 1.

# Value Proposition Canvas

## 1. Perfil do Administrador do Sistema

### Tarefas
- Criar, atualizar, desativar e administrar contas de usuários.
- Atribuir papéis e garantir que as permissões correspondam às responsabilidades de cada pessoa.
- Configurar parâmetros globais do sistema, como alíquotas de impostos e coeficientes de depreciação, quando aplicáveis.
- Acompanhar ocorrências de acesso e apoiar a manutenção da integridade do sistema.

### Dores
- Risco de usuários obterem permissões além das necessárias.
- Dificuldade para identificar a origem de acessos ou alterações suspeitas.
- Configurações incorretas que possam afetar registros e cálculos operacionais.
- Falta de visibilidade sobre as contas ativas e os papéis atribuídos.

### Ganhos desejados
- Controle centralizado das contas e papéis de usuário.
- Maior clareza sobre quem pode executar cada operação.
- Configurações globais organizadas e consistentes.
- Registros que facilitem a investigação de eventos relevantes.

## 2. Mapa de Valor do Administrador

### Produtos e serviços
- Módulo de gerenciamento de usuários e papéis.
- Autenticação e gestão de sessões.
- Configurações globais do sistema.
- Registro de eventos e operações administrativas.

### Analgésicos
- Permissões baseadas em papéis para restringir funções administrativas.
- Validação de entradas e confirmação de operações sensíveis.
- Registro de eventos de autenticação e mudanças de configuração.
- Mecanismos de sessão e proteção de credenciais compatíveis com a arquitetura adotada.

### Criadores de ganhos
- Painel ou consultas de usuários, papéis e configurações.
- Visibilidade sobre as alterações administrativas registradas.
- Capacidade de manter regras de acesso consistentes conforme a equipe muda.

## 3. Perfil do Operador de Cadastro

### Tarefas
- Cadastrar organizações clientes com dados completos e corretos.
- Registrar contratos de coleta e relacioná-los às organizações correspondentes.
- Consultar e atualizar informações cadastrais conforme sua autorização.
- Localizar rapidamente registros para atender às demandas da operação.

### Dores
- Erros de digitação e campos obrigatórios esquecidos.
- Cadastros duplicados ou identificadores inconsistentes.
- Dificuldade para encontrar organizações e contratos.
- Retrabalho quando os dados precisam ser corrigidos ou confirmados.

### Ganhos desejados
- Cadastro mais rápido e padronizado.
- Menos inconsistências e duplicidades.
- Facilidade para localizar organizações e contratos.
- Mensagens de validação claras para corrigir problemas no momento do registro.

## 4. Mapa de Valor do Operador de Cadastro

### Produtos e serviços
- Cadastro e manutenção de organizações clientes.
- Cadastro e consulta de contratos de coleta.
- Busca de registros por identificadores ou atributos relevantes.
- Validação dos dados cadastrais.

### Analgésicos
- Validação de campos obrigatórios e formatos.
- Verificação de unicidade de identificadores, como CNPJ, conforme as regras definidas.
- Mensagens claras para campos inválidos ou registros já existentes.
- Busca centralizada para reduzir a necessidade de consultar fontes separadas.

### Criadores de ganhos
- Fluxo de cadastro consistente e previsível.
- Dados padronizados que facilitam etapas posteriores do processo.
- Recuperação mais rápida de informações para atendimento e operação.

## 5. Perfil do Gestor de Almoxarifado

### Tarefas
- Registrar a entrada de lotes e as informações documentais necessárias.
- Cadastrar equipamentos e associá-los aos lotes correspondentes.
- Registrar a triagem e o estado físico dos itens.
- Atribuir ou consultar códigos de identificação interna.
- Atualizar e consultar as movimentações dos equipamentos conforme o fluxo operacional.

### Dores
- Perda de rastreabilidade entre recebimento, triagem e movimentações.
- Confusão entre equipamentos semelhantes ou códigos incorretos.
- Tentativa de executar uma etapa sem cumprir os requisitos anteriores.
- Registros atrasados ou incompletos durante períodos de maior demanda.

### Ganhos desejados
- Identificação individual e consulta rápida dos equipamentos.
- Visão atualizada de lotes e estados operacionais.
- Histórico das movimentações de cada item.
- Menos erros de fluxo graças às validações de negócio.

## 6. Mapa de Valor do Gestor de Almoxarifado

### Produtos e serviços
- Registro e consulta de lotes recebidos.
- Cadastro e identificação de equipamentos.
- Registro de triagem e estado físico.
- Registro e consulta de movimentações.
- Busca de itens por código interno e outros identificadores disponíveis.

### Analgésicos
- Validação de datas e dados necessários para registrar lotes.
- Regras que impeçam movimentações incompatíveis com o estado do equipamento.
- Obrigatoriedade de justificativa em alterações relevantes do estado físico, conforme regra definida.
- Histórico de eventos que ajude a reconstruir o caminho do equipamento.

### Criadores de ganhos
- Acompanhamento mais claro do fluxo de entrada e processamento.
- Identificação de gargalos por meio da consulta de registros e relatórios disponíveis.
- Melhor organização do inventário e dos dados usados pelas etapas seguintes.

## 7. Perfil do Auditor

### Tarefas do usuário
- Consultar o histórico de operações e movimentações.
- Pesquisar a trajetória de um lote ou equipamento específico.
- Gerar relatórios para análise, verificação e prestação de contas.
- Identificar lacunas ou inconsistências que precisem ser investigadas.

### Dores
- Informações dispersas ou difíceis de recuperar.
- Dificuldade para estabelecer a sequência de eventos de um equipamento.
- Ausência de dados suficientes para esclarecer quando ou por quem uma operação foi registrada.
- Risco de alteração acidental dos dados durante uma consulta.

### Ganhos desejados
- Consulta clara e confiável dos registros disponíveis.
- Relatórios que facilitem a verificação dos processos.
- Histórico de movimentações acessível por identificador.
- Garantia de que o perfil de auditoria não permita modificar os dados operacionais.

## 8. Mapa de Valor do Auditor

### Produtos e serviços
- Consulta de históricos e movimentações.
- Pesquisa de organizações, lotes e equipamentos conforme a autorização.
- Geração de relatórios operacionais e de auditoria.
- Acesso de leitura aos registros relevantes para a auditoria.

### Analgésicos
- Permissão exclusivamente de leitura para o perfil de auditor.
- Histórico organizado por registro e sequência de eventos.
- Filtros e buscas que reduzam o tempo necessário para localizar evidências.
- Relatórios que reúnam informações relevantes sem exigir consolidação manual.

### Criadores de ganhos
- Maior rapidez na análise de registros.
- Evidências organizadas para apoiar verificações e prestação de contas.
- Possibilidade de comparar registros e identificar padrões ou lacunas, conforme os dados disponíveis.

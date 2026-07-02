# One Dice Site v1.95.0

## Foco

Update de validação camada por camada, revisão de estrutura e otimização geral.

Esta versão foi feita a partir da v1.94.5 e revisa o projeto como camadas:

- auth;
- hub;
- campaign;
- sheet;
- realtime;
- database;
- assets/static.

## Varredura feita

Foram revisados os arquivos principais do pacote:

- HTML;
- CSS;
- JavaScript do cliente;
- OBS;
- rotas do servidor;
- sockets;
- banco de dados;
- Docker;
- variáveis de ambiente;
- assets e referências internas.

## Limpeza funcional

Removidos do JavaScript ativo os blocos antigos de gerenciador de campanha **V190 até V191**, que ainda podiam reativar comportamentos antigos.

O gerenciador moderno passa a ser a camada oficial a partir da estrutura **V192+**.

Para não quebrar chamadas internas já existentes, a v1.95 recria uma ponte moderna compatível com nomes antigos, sem reabrir o layout antigo.

## Núcleo v1.95

Adicionado:

- `od195LayerValidator`;
- validação de tela ativa única;
- validação de URL canônica;
- validação de gerenciador moderno dentro de campanha;
- bloqueio final de painéis antigos na camada campaign;
- limpeza de estado local inconsistente;
- ponte moderna para `od1905LiveCampaignCore`;
- sincronização de presença com menos ruído;
- render moderno com lock antiflicker;
- auditoria salva em `localStorage.od195_last_layer_audit`;
- log de problemas em `localStorage.od195_layer_issues`.

## URLs organizadas

Mantidas como padrão:

- `/login`;
- `/inicio`;
- `/personagens`;
- `/campanhas`;
- `/campanha/:id`;
- `/campanha/:id/:tab`;
- `/ficha/:id`;
- `/personagem/:id`.

`/mesa/:id` continua sendo normalizada para `/campanha/:id`.

## Backend

Adicionado endpoint de validação de camadas:

- `GET /api/health/layers`.

Ele valida se as camadas principais do banco e do servidor estão disponíveis.

## Package

Adicionado script:

- `npm run check`.

Ele executa `node --check` nos arquivos principais de JavaScript.

## Resultado da limpeza

- blocos antigos V190-V191 removidos do JavaScript ativo;
- aproximadamente 115,615 caracteres de código legado retirados;
- gerenciador moderno preservado;
- compatibilidade interna preservada;
- flicker reduzido por render lock;
- camada campaign protegida contra retorno do modelo antigo.

## Versão

1.95.0

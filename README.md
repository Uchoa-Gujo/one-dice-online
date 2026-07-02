# One Dice Site v1.95.2

## Foco

Hotfix para corrigir regressões da v1.95.1 dentro da ficha e da campanha.

## Corrigido

- Ficha abrindo com layout quebrado;
- painel de rolagens/chat sobrepondo o menu/miolo da ficha;
- menu de três linhas sumindo dentro da ficha;
- o menu de três linhas continua oculto apenas dentro da campanha;
- abertura de ficha pela aba Personagens da campanha;
- abertura de ficha pela aba Personagens do hub;
- campanha ficando preta ao abrir;
- botão Voltar da campanha voltando para `/campanhas`;
- botão Voltar mal posicionado na ficha/campanha;
- retorno da ficha para campanha com botão pequeno e separado;
- atributos voltam para modelo clássico próximo das versões 1.89/1.90;
- removidos efeitos de `content-visibility`/`contain` que estavam causando tela preta ou render incompleto na campanha.

## Validação

Validar:

- `npm run check`;
- `client/script.js`;
- `client/obs.js`;
- `server/server.js`;
- `server/database.js`;
- `server/middleware.js`;
- `server/routes/auth.js`;
- `server/routes/characters.js`;
- `server/routes/tables.js`;
- `server/sockets/index.js`.

## Versão

1.95.2

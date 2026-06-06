# One Dice Site v1.42 — limpeza final antes de teste

Esta versão parte da v1.41 e faz uma limpeza geral e segura antes do teste no navegador.

## Limpeza feita

- Atualização completa de versão/cache para `1.42.0`.
- Remoção dos READMEs antigos de correções intermediárias para deixar o pacote mais limpo.
- Normalização de quebras de linha e espaços finais nos arquivos de código/configuração.
- Criação de `server/async-router.js` para remover blocos repetidos de proteção assíncrona nas rotas.
- Remoção de declarações legadas duplicadas no `client/script.js` que eram sobrescritas por versões mais novas (`showAuth`, `showApp`, `login`, `initApp`, `renderCharacterList`, `escapeHtml`, `updateChar`, `addChat`, `renderChat`).
- Rotas `auth`, `characters` e `tables` agora usam o mesmo helper compartilhado.
- Adição de camada final `V142 - limpeza final e integridade` no cliente.

## Ajustes de integridade no cliente

- Remove duplicatas visuais de barra rápida, paleta, modal de backup, input de importação e botão OBS quando renders antigos tentam recriá-los.
- Normaliza botões antigos de duplicar ficha para o handler único da v138+.
- Garante que `defense` e `dodge` continuem manuais, sem `readonly`.
- Se por algum render antigo aparecer ID duplicado para Defesa/Esquiva, a cópia extra perde o ID para não quebrar seletores.

## Validação executada

- `node --check` em:
  - `client/script.js`
  - `client/obs.js`
  - `client/block-inventory/script.js`
  - `server/server.js`
  - `server/database.js`
  - `server/middleware.js`
  - `server/async-router.js`
  - `server/routes/auth.js`
  - `server/routes/characters.js`
  - `server/routes/tables.js`

Também foram conferidas referências de CSS/JS/imagens dos HTMLs principais.

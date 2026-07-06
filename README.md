# One Dice Site v1.95.22 — cookies de sessão seguros e desempenho sem mexer no layout

## Resumo

Esta versão continua em cima da base estável recuperada e **não mexe em login visual, boot, loaders, layout de ficha, cards de personagem ou Socket.IO visual**.

O foco foi adicionar cookies do jeito certo: não para guardar fichas inteiras, nem dados grandes, mas para melhorar a estabilidade da sessão entre navegadores/abas e reduzir problemas de autenticação quando o `localStorage` de uma conta/navegador fica diferente do outro.

## O que foi feito

- Adicionei cookie de sessão seguro no servidor: `od_session_token`.
- O cookie principal é `HttpOnly`, ou seja, o JavaScript do navegador não consegue ler esse token diretamente.
- Adicionei cookie leve de indicação de sessão: `od_session_hint`.
- O `od_session_hint` não guarda dados sensíveis; ele só indica para o frontend que pode tentar restaurar sessão pelo servidor.
- O login agora salva a sessão tanto no modelo antigo com token local quanto no cookie seguro do servidor.
- O cadastro também já cria o cookie de sessão.
- A rota `/api/auth/me` agora renova/confirma o cookie e também devolve um token compatível com o sistema atual.
- Adicionei a rota `/api/auth/logout` para limpar os cookies de sessão.
- O logout agora tenta chamar `/api/auth/logout` para limpar o cookie no servidor.
- As chamadas `fetch` do sistema online agora usam `credentials: 'same-origin'` para enviar cookies na mesma origem do site.
- O middleware de autenticação agora aceita token por `Authorization: Bearer` ou pelo cookie seguro.
- O Socket.IO agora também consegue autenticar por cookie se o token local não estiver disponível.
- Ajustei CORS para aceitar credenciais de forma segura, sem forçar isso em tela ou layout.
- Atualizei a versão para **1.95.22**.
- Atualizei o cache busting do `index.html` para `style.css?v=1.95.22` e `script.js?v=1.95.22`.

## Arquivos alterados

- `server/middleware.js`
- `server/routes/auth.js`
- `server/server.js`
- `server/sockets/index.js`
- `client/script.js`
- `client/index.html`
- `package.json`
- `README.md`

## Limpezas realizadas e motivo

### 1. Sessão dependente apenas de `localStorage/sessionStorage`

**O que foi limpo:**  
A autenticação não depende mais exclusivamente do token salvo no `localStorage` ou `sessionStorage`.

**Por que foi limpo:**  
Cada navegador, conta e perfil pode ter um estado local diferente. Isso explica parte da sensação de “cada navegador tem um bug específico”: um navegador pode estar com token antigo, outro com cache/localStorage diferente, outro com sessão parcialmente limpa.

**Como foi substituído:**  
Foi adicionada uma segunda camada segura de sessão pelo servidor usando cookie `HttpOnly`. O modelo antigo continua funcionando para não quebrar o sistema atual, mas agora o servidor também consegue reconhecer a sessão pelo cookie.

### 2. Logout sem limpeza de cookie

**O que foi limpo:**  
Antes, sair da conta limpava apenas dados locais do navegador.

**Por que foi limpo:**  
Com cookies de sessão, o logout precisa limpar o cookie no servidor também. Caso contrário, o usuário poderia sair visualmente, mas ainda ter sessão válida no backend.

**Como foi substituído:**  
Foi criada a rota `POST /api/auth/logout`, que remove os cookies `od_session_token` e `od_session_hint`.

### 3. Middleware aceitando só Bearer Token

**O que foi limpo:**  
A autenticação do backend antes lia apenas o header `Authorization`.

**Por que foi limpo:**  
Isso deixava o sistema dependente demais do JavaScript e do armazenamento local do navegador.

**Como foi substituído:**  
O middleware agora aceita:

- `Authorization: Bearer <token>`;
- cookie seguro `od_session_token`.

### 4. Socket.IO dependente apenas de token vindo do JavaScript

**O que foi limpo:**  
O Socket.IO antes tentava autenticar apenas com `socket.handshake.auth.token`.

**Por que foi limpo:**  
Se o token local não existir ou estiver inconsistente, o tempo real pode falhar mesmo com sessão válida no servidor.

**Como foi substituído:**  
O Socket.IO agora também consegue ler o cookie de sessão enviado pelo navegador.

## Observação sobre performance e cookies

Cookies ajudam principalmente em **sessão, consistência entre abas/navegadores e autenticação**.

Eles **não são bons** para guardar fichas, campanhas, inventário, imagens, magias ou dados grandes, porque cookies são enviados em toda requisição e podem piorar a performance se ficarem pesados.

Por isso esta versão usa cookies apenas para sessão. Os dados grandes continuam fora dos cookies.

## Como testar

1. Subir a versão no servidor.
2. Fazer hard refresh no Chrome/Brave.
3. Fazer hard refresh no Firefox.
4. Entrar com uma conta existente.
5. Fechar e abrir o navegador.
6. Confirmar que a sessão consegue restaurar normalmente.
7. Sair da conta.
8. Recarregar a página e confirmar que a conta não volta logada depois do logout.
9. Criar uma conta teste.
10. Confirmar que entra normalmente e que fichas/mesas continuam carregando.
11. Abrir uma ficha e confirmar que o patch não alterou visual, background, menu ou cards.

## Importante

Esta versão não tenta corrigir visual de ficha ou personagens. Ela só adiciona a camada de cookies de sessão para melhorar estabilidade entre navegadores sem repetir o erro de mexer em boot/loading/layout ao mesmo tempo.

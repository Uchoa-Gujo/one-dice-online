# One Dice Site v1.95.16

## Foco

Correção direta no código-fonte para resolver o login/carregamento infinito que continuava acontecendo mesmo após as versões 1.95.13, 1.95.14 e 1.95.15.

Desta vez a correção não ficou limitada a esconder telas de loading. A busca foi feita nas camadas de boot, login, restauração de sessão, chamadas de API, handlers antigos de formulário e CSS que podia manter o login visualmente preso.

O problema estava em uma combinação perigosa:

- loaders antigos `od180`, `od1805` e `od1776` ainda existiam no projeto;
- listeners antigos de login rodavam antes dos patches novos;
- a restauração de sessão podia chamar `/api/auth/me` sem timeout real;
- o login podia ficar esperando `/api/auth/login`, `/api/characters` ou `/api/tables` responderem;
- o usuário via a tela de login ou uma tela de carregamento presa, sem retorno claro.

A v1.95.16 adiciona uma proteção no início do `client/script.js` e um controlador final de login no fim do arquivo. O login agora não depende mais dos loaders antigos e não fica preso esperando carregamentos secundários de fichas/mesas.

Esta versão mantém as correções anteriores:

- login centralizado;
- remoção da Fonte Manga;
- botão **EXCLUIR** funcionando em personagens;
- aba **Seus Personagens** travada no design moderno após criar personagem;
- menu de três traços da ficha sem botão **X**;
- background antigo removido;
- atributos resumidos em coluna.

## Corrigido

- adicionei o bloco **V195.16 - Guardião raiz contra login/carregamento infinito** no início do `client/script.js`;
- adicionei timeout real nas chamadas `fetch` para `/api/auth`, `/api/characters` e `/api/tables`;
- adicionei o bloco **V195.16 - Login final sem travar** no fim do `client/script.js`;
- o submit/click do login agora é capturado no `window`, antes dos listeners antigos do `document`;
- o login entra na tela inicial imediatamente após autenticar;
- fichas e mesas carregam em segundo plano e não bloqueiam mais a entrada;
- se o servidor ou banco demorar demais, o login mostra erro em vez de parecer carregamento infinito;
- a restauração de sessão salva também tem timeout e não prende mais a tela;
- loaders antigos são removidos no início, no DOMContentLoaded, no load e por failsafes;
- o visual do login foi destravado por CSS final para impedir opacidade/pointer-events herdados de loaders antigos;
- atualizei a versão para **1.95.16**.

## Arquivos alterados

- `client/index.html`
- `client/script.js`
- `client/style.css`
- `package.json`
- `README.md`

## Limpezas realizadas e motivo

### 1. Corte do carregamento infinito na raiz

**O que foi feito:**  
Foi criado um guardião inicial no começo do `client/script.js` para remover imediatamente:

- `#od180-boot-screen`;
- `#od1805-boot-screen`;
- `#od1776-solid-loader`;
- `.od1776-solid-loader`;
- `.od180-loader-stuck`;
- classes `od180-booting`, `od1805-booting` e `od1775-restoring-route`.

**Por que foi feito:**  
As versões anteriores tentavam fechar o loading depois que ele já tinha sido criado. Isso ainda permitia que alguma camada antiga prendesse a tela antes do login terminar de montar.

**Como foi substituído:**  
A v1.95.16 limpa essas camadas antes das rotinas antigas de login/boot rodarem e repete a limpeza em failsafes curtos.

### 2. Timeout real nas chamadas da API

**O que foi feito:**  
Foi adicionada uma proteção global sobre `fetch` para as rotas principais:

- `/api/auth/login`;
- `/api/auth/me`;
- `/api/characters`;
- `/api/tables`.

**Por que foi feito:**  
Se o servidor ou o banco demorasse, o login/restauração ficava esperando sem resposta visual clara. Para o usuário isso parecia “rodando infinitamente”.

**Como foi substituído:**  
Agora essas chamadas têm tempo máximo. Se passar do limite, a requisição é cancelada e a tela de login fica utilizável com mensagem de erro.

### 3. Login final capturado antes dos handlers antigos

**O que foi feito:**  
Foi criado um controlador final de login que captura `submit` e clique no botão de entrar pelo `window` em modo captura.

**Por que foi feito:**  
O projeto tem vários listeners antigos de login no `document`. Alguns deles chamavam loaders ou aguardavam carregamentos secundários. Como listeners antigos podiam rodar antes do patch, o login continuava preso.

**Como foi substituído:**  
O novo controlador pega o evento antes dos listeners antigos, cancela a propagação e executa o fluxo novo de login.

### 4. Fichas e mesas não bloqueiam mais o login

**O que foi feito:**  
Depois que `/api/auth/login` confirma o usuário, o site entra imediatamente na tela inicial.

**Por que foi feito:**  
Antes, o login podia depender do carregamento completo de fichas e mesas. Se uma dessas chamadas falhasse ou demorasse, o usuário ficava travado.

**Como foi substituído:**  
Fichas e mesas agora carregam em segundo plano. Se falharem, o login continua concluído e o erro fica apenas no console.

### 5. Restauração de sessão antiga não prende mais a tela

**O que foi feito:**  
Foi adicionado um restaurador rápido com timeout para sessão salva.

**Por que foi feito:**  
Se existisse token antigo em `localStorage`/`sessionStorage`, o site podia tentar restaurar sessão indefinidamente.

**Como foi substituído:**  
Se `/api/auth/me` não responder em tempo aceitável, a sessão online é limpa e o login aparece normalmente.

### 6. Desbloqueio visual final do login

**O que foi feito:**  
Foi adicionado CSS final para garantir que o login fique visível, clicável e com contraste correto.

**Por que foi feito:**  
Algumas classes antigas de boot deixavam `opacity`, `visibility` ou `pointer-events` herdados. Isso fazia o login parecer carregado, mas o usuário não conseguia prosseguir corretamente.

**Como foi substituído:**  
A classe `od19516-login-unlocked` força o login ativo a ficar visível, com botões e inputs clicáveis.

## Como testar

1. Rodar `npm run check`.
2. Subir a versão nova no servidor.
3. Abrir em aba anônima.
4. Abrir em navegador com cache limpo.
5. Abrir em navegador com sessão antiga salva.
6. Confirmar que o login aparece sem loading infinito.
7. Fazer login.
8. Confirmar que a tela inicial aparece mesmo que fichas/mesas demorem.
9. Entrar em **Seus Personagens**.
10. Criar personagem e confirmar que o design moderno não volta ao antigo.
11. Excluir personagem e confirmar que ele não retorna por cache.
12. Abrir ficha e conferir menu de três traços, background e atributos resumidos.

## Validação feita

- `npm run check` executado com sucesso.
- `client/script.js` validado por `node --check`.
- `client/obs.js` validado por `node --check`.
- `server/server.js` validado por `node --check`.
- `server/database.js` validado por `node --check`.
- `server/middleware.js` validado por `node --check`.
- `server/routes/auth.js` validado por `node --check`.
- `server/routes/characters.js` validado por `node --check`.
- `server/routes/tables.js` validado por `node --check`.
- `server/sockets/index.js` validado por `node --check`.

## Versão

1.95.16

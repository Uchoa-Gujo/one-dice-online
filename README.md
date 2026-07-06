# One Dice Site v1.95.14

## Foco

Patch direto no código-fonte para resolver o problema em que o site continuava **carregando/rodando infinitamente** mesmo após a correção anterior.

Desta vez a busca foi feita de forma geral, sem focar apenas no login. Foram revisadas as camadas de abertura, login, restauração de sessão, telas ativas, loaders antigos, CSS de boot, scripts inline do `index.html`, funções finais do `script.js`, observadores e regras visuais que podiam esconder a interface.

Esta versão mantém as correções anteriores:

- login centralizado;
- remoção da Fonte Manga;
- botão **EXCLUIR** funcionando em personagens;
- aba **Seus Personagens** travada no design moderno após criar personagem;
- menu de três traços da ficha sem botão **X**;
- background antigo removido;
- atributos resumidos em coluna.

## Corrigido

- removi fisicamente as telas de boot do `index.html`:
  - `#od180-boot-screen`;
  - `#od1805-boot-screen`;
- removi o script inline que adicionava `od180-booting` na abertura do site;
- removi o preboot antigo `od1805`, que escondia `#auth-screen`, `#sessions-screen`, `#app-screen` e `#overlay-screen`;
- neutralizei a função antiga `ensureBoot()`, que ainda podia recriar o loader `od180`;
- neutralizei a função antiga `showBoot()`, que ainda podia recriar o loader `od1805`;
- adicionei uma proteção inicial `od19514EarlyNoInfiniteBoot` no começo do `script.js`;
- adicionei uma proteção inline no `index.html` para remover qualquer loader antes mesmo do script principal terminar de carregar;
- adicionei CSS final que impede qualquer loader antigo de aparecer por cima do site;
- forcei a remoção das classes antigas de boot:
  - `od180-booting`;
  - `od1805-booting`;
  - `od1775-restoring-route`;
  - `od180-booting-body`;
  - `od1805-booting-body`;
- garanti que as telas reais não fiquem invisíveis se alguma classe antiga de boot voltar;
- atualizei todas as referências de versão para **1.95.14**.

## Arquivos alterados

- `client/index.html`
- `client/script.js`
- `client/style.css`
- `package.json`
- `README.md`

## Limpezas realizadas e motivo

### 1. Remoção dos loaders do HTML

**O que foi removido:**  
Foram removidos do `index.html` os blocos visuais dos loaders `od180` e `od1805`, além do preboot que criava a tela “Carregando One Dice”.

**Por que foi removido:**  
A versão anterior tentava fechar os loaders por JavaScript, mas eles ainda existiam fisicamente no HTML. Se alguma função antiga falhasse, fosse interrompida ou recriasse uma classe de boot, a tela de loading podia continuar cobrindo tudo.

**Como foi substituído:**  
O HTML agora abre direto com a tela real. O script inicial apenas aplica tema escuro/acento e não cria mais tela de carregamento.

### 2. Remoção do preboot `od1805`

**O que foi removido:**  
Foi removida a camada `od1805-preboot`, que adicionava `od1805-booting` no `<html>` e escondia as telas principais.

**Por que foi removido:**  
Essa camada era perigosa porque escondia login, início e ficha com CSS. Mesmo que o site estivesse funcionando, a interface podia continuar invisível.

**Como foi substituído:**  
A versão 1.95.14 não usa mais preboot visual. Se o sistema precisar restaurar sessão, ele faz isso sem cobrir o site inteiro.

### 3. Neutralização de `ensureBoot()`

**O que foi limpo:**  
A função antiga `ensureBoot()` não cria mais `#od180-boot-screen`.

**Por que foi limpo:**  
Ela ainda podia ser chamada por camadas antigas e recriar a tela de carregamento depois que outra correção já tinha removido o loader.

**Como foi substituído:**  
Agora essa função apenas remove loaders/classes antigas e retorna `null`.

### 4. Neutralização de `showBoot()`

**O que foi limpo:**  
A função antiga `showBoot()` não cria mais `#od1805-boot-screen` e não adiciona mais `od1805-booting`.

**Por que foi limpo:**  
Várias partes antigas chamavam `showBoot()` em login, logout, restauração e troca de tela. Isso podia fazer o site voltar a carregar infinitamente mesmo depois de uma limpeza anterior.

**Como foi substituído:**  
As chamadas antigas ainda podem acontecer, mas agora só executam uma limpeza segura em vez de abrir um overlay.

### 5. Proteção dupla contra regressão

**O que foi adicionado:**  
Foram adicionadas duas proteções:

- uma inline no `index.html`;
- uma no começo do `client/script.js`.

**Por que foi adicionado:**  
Se qualquer camada antiga tentar recriar o loader, adicionar classes de boot ou esconder as telas, a proteção remove isso imediatamente durante os primeiros segundos de carregamento.

**Como foi substituído:**  
Não depende mais de um único failsafe no final. A limpeza roda antes, durante e depois da inicialização.

### 6. CSS de segurança final

**O que foi adicionado:**  
Foi adicionado CSS no fim do `style.css` para esconder permanentemente loaders antigos.

**Por que foi adicionado:**  
Mesmo se algum JavaScript antigo recriar o elemento visual, ele não aparece e não bloqueia clique.

**Como foi substituído:**  
O CSS força `display:none`, `visibility:hidden`, `opacity:0` e `pointer-events:none` em todos os loaders antigos conhecidos.

## Como testar

1. Rodar `npm run check`.
2. Abrir o site em navegador com cache limpo.
3. Confirmar que o login aparece sem tela “Carregando One Dice”.
4. Recarregar a página algumas vezes.
5. Testar em aba anônima.
6. Testar com sessão antiga salva no navegador.
7. Fazer login e confirmar que a tela inicial aparece.
8. Testar senha errada e confirmar que o site não fica preso em loading.
9. Abrir **Seus Personagens**.
10. Criar personagem novo e confirmar que o design moderno continua fixo.
11. Abrir uma ficha e confirmar que o menu de três traços e os atributos continuam como na versão anterior.

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

1.95.14

# One Dice Site v1.95.15

## Foco

Correção direta no código-fonte para resolver o carregamento infinito que começou depois da versão **1.95.10**.

A busca foi feita de forma geral, mas a diferença principal encontrada foi que a v1.95.10 adicionou um bloco de exclusão de personagens que rodava durante o boot da aplicação. Esse bloco tinha observador global, manipulação direta de funções antigas e reaplicação de renderizações logo na abertura. Mesmo sendo feito para corrigir o botão **EXCLUIR**, ele ficou perigoso para a inicialização do site porque passou a executar código de personagens enquanto o login/boot ainda estava montando a interface.

Nesta versão, a correção não tenta apenas esconder o loading. O bloco problemático da v1.95.10 foi removido e a exclusão foi refeita de forma segura, sem interferir no carregamento inicial.

Esta versão mantém as correções anteriores:

- login centralizado;
- remoção da Fonte Manga;
- botão **EXCLUIR** funcionando em personagens;
- aba **Seus Personagens** travada no design moderno após criar personagem;
- menu de três traços da ficha sem botão **X**;
- background antigo removido;
- atributos resumidos em coluna.

## Corrigido

- removi fisicamente do `client/script.js` o bloco **V195.10 - Exclusão real de personagens no código-fonte**;
- refiz a exclusão de personagem no bloco novo **V195.15**, sem observador global rodando durante o boot;
- mantive o botão **EXCLUIR** funcionando por delegação de evento segura;
- removi a dependência de `MutationObserver` para decorar botões de exclusão durante todo carregamento;
- removi a necessidade de alterar botões de exclusão assim que a página abre;
- adicionei failsafe final para remover qualquer loader/restauração presa;
- adicionei proteção contra o pseudo-loader da v177.5, que podia mostrar “Carregando ficha...” se a classe `od1775-restoring-route` ficasse presa;
- mantive a limpeza de loaders antigos `od180`, `od1805` e `od1776`;
- atualizei todas as referências de versão para **1.95.15**.

## Arquivos alterados

- `client/index.html`
- `client/script.js`
- `client/style.css`
- `package.json`
- `README.md`

## Limpezas realizadas e motivo

### 1. Remoção do bloco V195.10

**O que foi removido:**  
Foi removido do `client/script.js` o bloco inteiro **V195.10 - Exclusão real de personagens no código-fonte**.

**Por que foi removido:**  
O problema de carregamento começou após essa versão. Esse bloco corrigia o botão **EXCLUIR**, mas fazia isso instalando um observador global, decorando botões durante a montagem do DOM e substituindo funções antigas diretamente. Isso era arriscado porque a área de personagens passava a interferir na abertura do site, mesmo antes do usuário chegar na tela de personagens.

**Como foi substituído:**  
Foi criado o bloco **V195.15 - Correção raiz do carregamento após v1.95.10**, que só age quando o usuário realmente clica em um botão de exclusão. Ele não observa o DOM inteiro e não força renderizações durante o boot.

### 2. Exclusão de personagem refeita sem quebrar o boot

**O que foi refeito:**  
A função de exclusão foi recriada com delegação de clique segura para:

- `[data-od71-delete-character]`;
- `[data-delete-account-character]`;
- `[data-od19515-delete-character]`.

**Por que foi refeito:**  
O botão **EXCLUIR** precisava continuar funcionando, mas a solução anterior era pesada demais para ficar ativa durante o carregamento inicial.

**Como funciona agora:**  
A exclusão só roda quando o botão é clicado. Ela confirma a ação, marca a ficha como excluída, remove localmente, limpa vínculos com mesas, remove backups locais, tenta excluir no servidor e atualiza a interface.

### 3. Remoção do observador global de exclusão

**O que foi removido:**  
Foi removido o `MutationObserver` do bloco de exclusão da v1.95.10.

**Por que foi removido:**  
Esse observador ficava monitorando mudanças no corpo inteiro do site. Em um projeto com muitas camadas antigas e renderizações sucessivas, isso aumenta o risco de loops, renderização repetida e travamento visual.

**Como foi substituído:**  
A v1.95.15 usa apenas um listener de clique em captura. Isso é suficiente para pegar botões novos e antigos sem observar o DOM continuamente.

### 4. Failsafe contra qualquer loading/restauração presa

**O que foi adicionado:**  
Foi adicionado um failsafe final que remove:

- `#od180-boot-screen`;
- `#od1805-boot-screen`;
- `#od1776-solid-loader`;
- `.od1776-solid-loader`;
- `.od180-loader-stuck`;
- classes `od180-booting`, `od1805-booting` e `od1775-restoring-route`.

**Por que foi adicionado:**  
Mesmo depois de remover o bloco da v1.95.10, ainda existem camadas antigas de boot no projeto. O failsafe impede que qualquer uma delas deixe a tela presa.

**Como foi substituído:**  
A tela real aparece sem depender de um overlay de loading. Se nenhuma tela ativa for encontrada, o login é exibido como recuperação segura.

### 5. Bloqueio do pseudo-loader da v177.5

**O que foi corrigido:**  
Foi adicionado CSS para esconder `html.od1775-restoring-route body::before` e `body.od1775-restoring-route::before`.

**Por que foi corrigido:**  
Esse pseudo-elemento mostrava uma tela “Carregando ficha...”. Se uma classe de restauração ficasse presa, o usuário via carregamento infinito mesmo sem existir um elemento de loader no HTML.

**Como foi substituído:**  
Agora esse pseudo-loader é desativado por CSS final e por limpeza em JavaScript.

## Como testar

1. Rodar `npm run check`.
2. Abrir o site em navegador com cache limpo.
3. Confirmar que o login aparece sem tela “Carregando One Dice”.
4. Testar em aba anônima.
5. Testar com sessão antiga salva no navegador.
6. Fazer login e confirmar que a tela inicial aparece.
7. Entrar em **Seus Personagens**.
8. Criar um personagem e confirmar que a aba não volta ao design antigo.
9. Excluir um personagem e confirmar que ele não volta por cache.
10. Abrir uma ficha e confirmar que o menu de três traços e os atributos continuam corretos.

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

1.95.15

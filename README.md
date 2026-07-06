# One Dice Site v1.95.13

## Foco

Patch direto no código-fonte para corrigir o problema em que o site ficava **carregando/rodando infinitamente** e não iniciava. O problema mais provável estava na área de boot/login, mas a revisão também limpou a camada final criada na v1.95.12 para impedir loop visual em ficha, menu e atributos.

Esta versão mantém as correções anteriores:

- login centralizado;
- remoção da Fonte Manga;
- botão **EXCLUIR** funcionando em personagens;
- aba **Seus Personagens** travada no design moderno após criar personagem;
- menu de três traços da ficha sem botão **X**;
- background antigo removido;
- atributos resumidos em coluna.

## Corrigido

- removido o carregamento infinito causado por conflito entre loaders antigos `od180`, `od1805` e camadas finais de shell;
- o login limpo não fica mais coberto por tela de carregamento antes do formulário aparecer;
- a tela de boot inicial agora só aparece automaticamente quando existe sessão para restaurar;
- o fechamento de loaders agora remove também `#od1805-boot-screen`, que antes podia ficar preso mesmo quando `#od180-boot-screen` era fechado;
- adicionada limpeza forte de classes antigas de boot:
  - `od180-booting`;
  - `od1805-booting`;
  - `od1775-restoring-route`;
  - `od180-booting-body`;
  - `od1805-booting-body`;
- adicionados failsafes para garantir que nenhuma tela de loading fique infinita após erro de login, erro de API ou falha de restauração;
- removido o `MutationObserver` global da v1.95.12 que observava atributos/classes/estilos e podia reagir às próprias alterações;
- removido o intervalo contínuo que ficava sincronizando menu/atributos a cada poucos milissegundos;
- mantido o design do botão de três traços no modelo vermelho com três linhas brancas;
- mantido o fechamento do menu no próprio botão de três traços;
- mantida a remoção do **X** desnecessário;
- mantido o layout de atributos resumidos em ordem:
  - nome centralizado;
  - valor centralizado;
  - bônus centralizado abaixo.

## Arquivos alterados

- `client/script.js`
- `client/index.html`
- `package.json`
- `README.md`

## Limpezas realizadas e motivo

### 1. Loop de carregamento do boot/login

**O que foi limpo:**  
Foi removida a dependência do fluxo antigo que fechava apenas parte dos loaders. A função de limpeza agora remove tanto `#od180-boot-screen` quanto `#od1805-boot-screen`.

**Por que foi limpo:**  
Existiam duas telas de carregamento de versões diferentes. Em alguns fluxos, uma era removida e a outra ficava ativa, deixando o site aparentemente rodando para sempre e impedindo o login/início de aparecer.

**Como foi substituído:**  
A v1.95.13 usa uma limpeza única de boot, removendo os dois loaders e as classes antigas no `html` e no `body`.

### 2. Boot automático em login limpo

**O que foi limpo:**  
Foi alterado o trecho que chamava `showBoot()` automaticamente ao abrir o site.

**Por que foi limpo:**  
Esse boot era chamado mesmo quando não havia sessão para restaurar. Em navegador limpo ou conta nova, isso podia cobrir a tela de login sem necessidade.

**Como foi substituído:**  
Agora o boot inicial só aparece se existir sessão salva para restaurar. Se não houver sessão, o sistema fecha o loader e mostra o login.

### 3. Observador global da v1.95.12

**O que foi limpo:**  
Foi removido o `MutationObserver` que observava `class`, `style`, `data-od1957-menu-open`, `data-od195-layer` e `data-od1945-layer` no corpo inteiro da página.

**Por que foi limpo:**  
Esse observador reagia às próprias mudanças feitas pela correção do menu. Isso podia gerar um ciclo permanente de sincronização, deixando a página pesada e com comportamento de carregamento infinito.

**Como foi substituído:**  
A v1.95.13 mantém apenas um observador leve de criação/remoção de elementos (`childList`), sem observar atributos, classes ou estilos.

### 4. Intervalo contínuo do menu/atributos

**O que foi limpo:**  
Foi removido o `setInterval` que chamava sincronização de menu e atributos continuamente.

**Por que foi limpo:**  
Esse intervalo não era necessário e mantinha a página trabalhando o tempo todo, mesmo sem interação do usuário.

**Como foi substituído:**  
Agora a sincronização acontece apenas em momentos necessários: abertura da página, mudança real no DOM, clique no menu, abertura de ficha e failsafes espaçados.

### 5. Proteção de tela ativa

**O que foi limpo:**  
Foi adicionada uma proteção para quando nenhuma tela fica marcada como ativa após erro de boot.

**Por que foi limpo:**  
Se uma camada antiga removesse a classe `active` ou travasse durante a restauração, o usuário podia ficar em tela preta/carregando sem login nem início.

**Como foi substituído:**  
Se nenhuma tela estiver ativa, o sistema mostra o login em navegador limpo ou a tela inicial quando houver sessão salva.

## Como testar

1. Rodar `npm run check`.
2. Abrir o site em navegador com cache limpo.
3. Confirmar que o login aparece sem carregar infinitamente.
4. Fazer login e confirmar que a tela inicial aparece.
5. Recarregar o site logado e confirmar que a restauração não fica presa no loading.
6. Testar login com senha errada e confirmar que o loader fecha após o erro.
7. Abrir **Seus Personagens** e confirmar que o design moderno continua fixo.
8. Criar novo personagem e confirmar que o layout não volta ao modelo antigo.
9. Abrir uma ficha e confirmar que o menu de três traços continua funcionando sem **X**.
10. Conferir a área **Atributos** no resumo:
    - nome centralizado;
    - valor centralizado;
    - bônus centralizado abaixo.

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

1.95.13

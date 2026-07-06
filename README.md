# One Dice Online — Correções da versão 1.95.17

## Resumo

Esta versão corrige o problema de **carregamento infinito que continuou aparecendo depois da v1.95.10**.  
A correção foi feita voltando a base do código para a **v1.95.9**, que era a última base estável antes do problema, e reaplicando somente as correções necessárias de forma limpa.

O foco desta versão foi remover a causa do travamento fora do login: scripts globais, carregamento bloqueante e correções visuais que continuavam rodando durante a abertura do site.

---

## Bugs corrigidos

- O site podia ficar carregando infinitamente mesmo com a tela de login visível.
- O carregamento bloqueante do Socket.IO podia prender a abertura da página antes do `script.js` principal terminar de assumir a interface.
- A correção da v1.95.10 tinha introduzido uma camada global de exclusão de personagem com observação da página inteira.
- As versões posteriores adicionaram guardiões de boot/login, `fetch` global, observadores e timers que continuavam tentando corrigir a tela mesmo quando o problema estava em outra área.
- O botão **EXCLUIR** continua funcionando, mas agora sem rodar nada durante a abertura do site.
- A aba **Seus Personagens** mantém o design moderno ao criar personagem novo.
- O menu de três traços da ficha mantém o visual novo, sem o **X** desnecessário.
- A ficha mantém o fundo limpo, sem vazamento de textura/imagem antiga.
- Os atributos resumidos continuam organizados como: nome, valor e bônus centralizados.

---

## Arquivos alterados

- `package.json`
- `client/index.html`
- `client/script.js`
- `client/style.css`
- `README.md`

---

## Limpezas realizadas e motivo

### 1. Remoção da base problemática pós-v1.95.10

**O que foi removido:**  
A versão foi reconstruída a partir da base **v1.95.9**, sem manter os blocos adicionados depois da v1.95.10 que mexiam em boot, login, loader, `fetch` global e observação contínua da interface.

**Por que foi removido:**  
O bug começou depois da v1.95.10 e continuou mesmo depois das tentativas de corrigir o login. Isso indicou que o problema não estava somente no formulário de login, mas em camadas do site que rodavam durante a abertura.

**Como foi substituído:**  
As correções úteis foram reaplicadas em um bloco novo da **v1.95.17**, sem `MutationObserver` permanente, sem `setInterval` visual contínuo e sem alterar `window.fetch` globalmente.

---

### 2. Socket.IO deixou de bloquear a abertura do site

**O que foi removido:**  
O carregamento direto e bloqueante deste script foi removido do fluxo inicial:

```html
<script src="/socket.io/socket.io.js"></script>
```

**Por que foi removido:**  
Esse script era carregado antes do `script.js` principal. Se `/socket.io/socket.io.js` demorasse, travasse ou ficasse pendente no servidor/proxy, o navegador podia continuar carregando infinitamente e o restante da interface ficava dependente dele.

**Como foi substituído:**  
O Socket.IO agora é carregado de forma assíncrona depois que a página já abriu. Se ele falhar, o site continua funcionando sem travar a tela inicial; apenas o tempo real fica desativado até o socket carregar corretamente.

---

### 3. Exclusão de personagens refeita sem camada global

**O que foi removido:**  
Foi descartado o modelo da v1.95.10 que dependia de observação global da página para decorar botões de exclusão.

**Por que foi removido:**  
Esse tipo de correção roda durante a montagem inteira do site e pode reagir a qualquer renderização, mesmo quando o usuário ainda está apenas abrindo o site.

**Como foi substituído:**  
A exclusão agora funciona por um fluxo único e direto:

1. O clique no botão **EXCLUIR** é capturado.
2. A exclusão é confirmada.
3. A ficha é apagada no servidor quando há sessão online.
4. O vínculo local com mesa/campanha é limpo.
5. Backups e caches locais da ficha são removidos.
6. A lista de personagens é atualizada.

Nada disso roda durante a abertura do site; só roda ao clicar em **EXCLUIR**.

---

### 4. Correção da aba Seus Personagens sem observação infinita

**O que foi removido:**  
Não foi mantido o observador permanente da v1.95.11.

**Por que foi removido:**  
O observador verificava mudanças no documento inteiro e podia continuar reagindo a renders que não tinham relação com a aba de personagens.

**Como foi substituído:**  
A normalização do design moderno agora roda apenas em momentos controlados:

- ao renderizar a lista de personagens;
- ao clicar na aba de personagens;
- ao criar personagem novo;
- em poucos `setTimeouts` finitos de segurança.

---

### 5. Correção do menu da ficha sem intervalo contínuo

**O que foi removido:**  
Foi removida a lógica que ficava sincronizando menu/atributos continuamente.

**Por que foi removido:**  
Um intervalo visual permanente não deve existir para corrigir layout, porque ele continua rodando mesmo fora da área afetada.

**Como foi substituído:**  
O menu da ficha agora é ajustado somente quando a ficha abre, quando o botão de três traços é clicado ou quando a tela termina de carregar.

---

## Como testar

1. Abrir o site em aba anônima ou navegador limpo.
2. Confirmar que o site não fica carregando infinitamente.
3. Entrar com a conta normalmente.
4. Abrir **Seus Personagens**.
5. Criar um novo personagem e conferir se o design moderno não volta para o modelo antigo.
6. Excluir uma ficha e conferir se ela não volta depois de recarregar.
7. Abrir uma ficha e conferir:
   - botão de três traços no modelo novo;
   - sem botão **X** no menu;
   - fundo antigo removido;
   - atributos resumidos em ordem: nome, valor, bônus.
8. Abrir uma campanha e conferir se o site continua carregando normalmente.

---

## Observação importante

Esta versão é uma correção de estabilidade.  
Ela evita continuar empilhando patch por cima de patch e volta para a última base estável antes do bug, reaplicando somente o que precisava continuar existindo.

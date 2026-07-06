# One Dice Site v1.95.20 — ficha/menu e Firefox corrigidos sem mexer no boot

## Resumo

Esta versão continua usando a **v1.95.19**, baseada na última base estável confirmada pelo usuário, e aplica apenas correções visuais/funcionais isoladas na ficha e na aba **Seus Personagens**.

Não foram feitas alterações em login, boot, loader, Socket.IO ou carregamento inicial do site.

## O que foi corrigido

- O botão de **três traços** dentro da ficha não deve mais sumir.
- O botão de três traços recebeu o design vermelho recente com três linhas brancas.
- O **X** desnecessário do menu da ficha foi removido visualmente.
- A função de fechar/abrir ficou concentrada no botão de três traços.
- O background antigo com imagem/textura de folha foi bloqueado, inclusive no Firefox.
- A aba **Seus Personagens** foi travada no layout moderno horizontal.
- Ao criar personagem no Firefox, a lista de fichas não deve voltar ao design antigo.
- Atualizada a versão para **1.95.20**.
- Atualizado cache busting do `index.html` para `style.css?v=1.95.20` e `script.js?v=1.95.20`.

## Arquivos alterados

- `client/style.css`
- `client/script.js`
- `client/index.html`
- `package.json`
- `README.md`

## Limpezas realizadas e motivo

### 1. Menu antigo da ficha com X/fallback visual

**O que foi limpo:**  
Foram ocultados os botões antigos/fallbacks dentro do menu da ficha, incluindo o X e botões dock que apareciam como fechamento visual duplicado.

**Por que foi limpo:**  
O menu tinha mais de um controle visual competindo. Isso fazia o botão de três traços sumir, o X aparecer sem necessidade e o painel ficar com comportamento diferente dependendo de navegador/conta.

**Como foi substituído:**  
Foi criado um botão oficial e fixo da ficha: `#od19520-sheet-menu-toggle`. Ele fica fora do painel, tem design vermelho recente e é o único responsável por abrir/fechar o menu.

### 2. Background antigo com imagem de folha

**O que foi limpo:**  
A imagem/textura antiga ligada a `.paper-bg` e backgrounds herdados foi bloqueada por CSS final.

**Por que foi limpo:**  
No Firefox, partes do fundo antigo ainda podiam aparecer por diferença de renderização, cache ou herança de background-image.

**Como foi substituído:**  
A ficha e as telas principais usam fundo escuro sólido. Também foi adicionada regra específica com `@-moz-document url-prefix()` para Firefox.

### 3. Cards de personagens voltando ao modelo antigo no Firefox

**O que foi limpo:**  
Foi neutralizada a volta visual para grid/card antigo após criação de personagem no hub.

**Por que foi limpo:**  
O fluxo de criar personagem ainda podia chamar renderização antiga e o Firefox respeitava medidas/grade conflitantes de outro bloco CSS.

**Como foi substituído:**  
Foi adicionada uma trava de normalização para `#od71-character-list`, aplicando classes modernas e grid horizontal estável após renderização, criação de personagem, mudança de aba e mutações do DOM.

## Observação sobre cookies

O site **não precisa obrigatoriamente de cookies** para funcionar melhor. Ele pode funcionar bem usando `localStorage` e token salvo no navegador, como já parece fazer hoje.

Cookies podem ajudar principalmente quando:

- o login precisa ser mais estável entre navegadores;
- o servidor precisa reconhecer sessão sem depender tanto do JavaScript;
- você quer um controle mais seguro de autenticação com cookie `HttpOnly`;
- quer reduzir diferenças entre conta/navegador causadas por cache local antigo.

Mas cookies não corrigem por si só bugs de CSS, layout, renderização ou estado duplicado. O ideal para o One Dice seria uma etapa futura separada: revisar autenticação/sessão e decidir entre token no `localStorage`, cookie seguro `HttpOnly`, ou os dois em combinação.

## Como testar

1. Subir a versão no servidor.
2. Fazer hard refresh no Chrome/Brave.
3. Fazer hard refresh no Firefox.
4. Entrar em uma ficha.
5. Verificar se o botão de três traços fica sempre visível.
6. Abrir e fechar o menu usando apenas o botão de três traços.
7. Confirmar que o X não aparece mais no menu da ficha.
8. Confirmar que o fundo antigo não aparece no Firefox.
9. Ir em **Seus Personagens**.
10. Criar um novo personagem no Firefox.
11. Confirmar que a lista continua no layout moderno horizontal.

## Próxima regra de trabalho

Continuar fazendo correções pequenas em cima da base estável. Não mexer em boot, login, socket ou loader sem uma evidência direta de que o bug está ali.

## Versão

1.95.20

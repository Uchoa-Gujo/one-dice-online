# One Dice Site v1.95.23 — menu da ficha persistente e atributos resumidos centralizados

## Resumo

Esta versão continua em cima da base estável recuperada. Não mexe em login, boot, loader, Socket.IO, cookies, banco ou rotas principais.

O foco foi corrigir dois pontos visuais dentro da ficha:

- o botão de três traços que aparecia rapidamente e depois sumia;
- o desenho dos atributos resumidos, que ainda estava no modelo antigo.

## O que foi feito

- Criei um botão final e único para o menu da ficha: `#od19523-sheet-menu-toggle`.
- O novo botão fica fora do `main-topbar`, para não ser removido ou escondido pelos scripts antigos do menu.
- O botão agora aparece em páginas `/ficha/...` e `/personagem/...` de forma persistente.
- Mantive a função de abrir/fechar o menu no próprio botão de três traços.
- Reforcei o botão com tamanho menor: **42x42px**.
- Removi visualmente os botões antigos de menu da ficha:
  - `#topbar-menu-toggle`;
  - `.topbar-menu-toggle`;
  - `#od1954-sheet-menu-toggle`;
  - `#od19520-sheet-menu-toggle`;
  - `#od19521-sheet-menu-toggle`.
- Removi o X/fechar antigo do menu da ficha.
- Recriei a renderização final dos atributos resumidos.
- A ordem dos atributos resumidos agora é:
  1. nome do atributo centralizado;
  2. valor cheio do atributo centralizado;
  3. bônus do atributo centralizado dentro do design.
- Atualizei a versão para **1.95.23**.
- Atualizei o cache busting do `index.html` para `style.css?v=1.95.23` e `script.js?v=1.95.23`.

## Arquivos alterados

- `client/script.js`
- `client/style.css`
- `client/index.html`
- `package.json`
- `README.md`

## Limpezas realizadas e motivo

### 1. Botão de menu dependente do topbar antigo

**O que foi limpo:**  
O novo botão não depende mais do `#topbar-menu-toggle` nem do fallback antigo `#od1954-sheet-menu-toggle`.

**Por que foi limpo:**  
Esses botões antigos ainda eram controlados por blocos anteriores com intervalos próprios. Por isso o botão podia aparecer no começo e sumir depois, mesmo quando a ficha já estava aberta.

**Como foi substituído:**  
Foi criado um botão final independente, `#od19523-sheet-menu-toggle`, anexado diretamente ao `body`. Ele controla o `main-topbar`, mas não fica dentro dele.

### 2. X antigo dentro do menu

**O que foi limpo:**  
Botões com texto `×`/`✕` e botões antigos marcados como fechar/dock dentro do menu da ficha.

**Por que foi limpo:**  
O menu já deve abrir e fechar pelo botão de três traços. O X era redundante, confundia o design e podia aparecer por cima do layout.

**Como foi substituído:**  
O fechamento fica centralizado no botão vermelho de três traços.

### 3. Render antigo dos atributos resumidos

**O que foi limpo:**  
A estrutura antiga dos atributos com nome e bônus na mesma linha, além dos controles e botão de rolagem dentro do resumo.

**Por que foi limpo:**  
O usuário pediu o painel resumido na ordem visual: nome, valor cheio e bônus, todos centralizados.

**Como foi substituído:**  
Foi criada uma renderização final `renderAttributesV19523`, mantendo a compatibilidade com a classe antiga `od17814-attr-card` para impedir que o observador antigo recoloque o layout quebrado.

## Como testar

1. Subir a versão no servidor.
2. Fazer hard refresh no Chrome/Brave.
3. Fazer hard refresh no Firefox.
4. Abrir uma ficha por `/personagem/nome`.
5. Confirmar que o botão vermelho de três traços aparece e não some depois de alguns segundos.
6. Clicar no botão e confirmar que o menu abre.
7. Clicar novamente e confirmar que o menu fecha.
8. Confirmar que não existe X no menu.
9. Ir na aba **Resumo**.
10. Conferir os atributos na ordem: nome, valor cheio e bônus.
11. Confirmar que o valor e o bônus ficam centralizados no card.

## Importante

Esta versão não altera login, cookies, exclusão de ficha, campanhas, socket ou carregamento inicial. A correção foi isolada no menu visual da ficha e no painel de atributos resumidos.

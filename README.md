# One Dice Site v1.95.31 — atributos refeitos do zero

## Resumo
Esta versão refaz a parte de **Atributos** do zero para acabar com a confusão entre modo expandido e modo reduzido.

A regra nova é simples:

- **Expandido** = editor real dos atributos, com campo editável, botões de +/− e botão de rolagem.
- **Reduzido** = resumo visual, sem campo de edição, mostrando somente nome, valor e bônus.

## O que foi corrigido
- Removi a camada antiga que ficava por cima do editor depois de reduzir e expandir.
- Removi o render de atributos da v1.95.24 que ainda recriava cards resumidos dentro do `#attributes-grid`.
- Removi as intervenções de atributos da v1.95.29 e v1.95.30.
- Criei um render novo e único para o editor expandido.
- Criei um render novo e separado para o resumo reduzido.
- O modo reduzido agora mostra na ordem correta:
  1. Nome do atributo;
  2. Valor do atributo;
  3. Bônus do atributo.
- O modo expandido agora fica livre/editável e não recebe card resumido por cima.
- Removi o botão **Modo confortável / Modo denso**.
- Mantive o modo denso sempre ativo.

## Limpezas realizadas e motivo

### 1. Remoção do render de atributos da v1.95.24
**O que foi removido:**
O bloco da v1.95.24 deixou de renderizar atributos e agora cuida apenas do menu da ficha.

**Por que foi removido:**
Esse bloco era uma das causas do bug: ele recriava os cards resumidos dentro do `#attributes-grid`, que é a área do editor. Por isso, ao expandir, a camada visual voltava por cima dos inputs.

**Como foi substituído:**
A renderização de atributos foi movida para um controlador novo da v1.95.31.

### 2. Remoção das camadas v1.95.29/v1.95.30
**O que foi removido:**
As tentativas anteriores de esconder/mostrar resumo por cima do editor.

**Por que foi removido:**
Elas ainda dependiam de esconder camadas antigas, o que causava corte, glitch e editor inacessível.

**Como foi substituído:**
Agora o modo reduzido usa um container próprio (`.od19531-attr-summary`) fora do editor. O editor usa somente `#attributes-grid`.

### 3. Separação real entre expandido e reduzido
**Expandido:**
Usa `#attributes-grid` com cards editáveis próprios.

**Reduzido:**
Oculta o corpo do editor e mostra apenas o resumo visual.

## Arquivos alterados
- `client/script.js`
- `client/style.css`
- `client/index.html`
- `package.json`
- `README.md`

## Como testar
1. Abrir uma ficha.
2. Ir em **Atributos**.
3. No modo expandido, confirmar que aparecem campos editáveis, botões −/+, e botão D20.
4. Clicar em **Reduzir**.
5. Confirmar que aparece somente o resumo visual com nome, valor e bônus.
6. Clicar em **Expandir**.
7. Confirmar que o editor volta, sem nenhuma camada cobrindo os inputs.
8. Repetir reduzir/expandir várias vezes.

## Observação
Esta versão mexe somente na parte de atributos e no botão de modo denso/confortável.
Não altera login, cookies, socket, menu da ficha, criação/exclusão de ficha, campanhas ou outras áreas.

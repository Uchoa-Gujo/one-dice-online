# One Dice Site v1.95.29 — atributos reduzidos sem camada sobre o editor

## Resumo
Esta versão corrige o erro das versões anteriores nos atributos: o design novo estava sendo aplicado como uma camada por cima do editor expandido.
A correção agora parte da base estável **v1.95.25** e aplica o visual novo somente no modo reduzido.

## Bugs corrigidos
- O editor expandido dos atributos volta a ficar limpo e editável.
- A camada visual estática que ficava por cima do editor foi removida.
- O modo reduzido dos atributos agora segue a ordem correta:
  1. nome do atributo;
  2. valor do atributo;
  3. bônus do atributo.

## O que foi limpo/removido

### 1. Camadas das versões v1.95.26, v1.95.27 e v1.95.28
**O que foi removido:**
As tentativas que mexiam no `#attributes-grid` ou tentavam restaurar o editor por cima depois.

**Por que foi removido:**
Porque o `#attributes-grid` é o editor real dos atributos. Ao reescrever esse grid com cards visuais, o editor ficava atrás e não dava para editar corretamente.

**Como foi substituído:**
A versão foi refeita a partir da base v1.95.25 e a mudança visual foi aplicada somente no resumo reduzido `.od1715-attr-summary`.

### 2. Interferência no editor expandido
**O que foi removido:**
Qualquer render novo que substituía os cards editáveis do editor expandido.

**Por que foi removido:**
Porque o pedido era só mudar o visual reduzido, não o design do editor.

**Como foi substituído:**
O editor expandido fica com o render original. A camada reduzida fica escondida quando o módulo está expandido.

## Arquivos alterados
- `client/script.js`
- `client/style.css`
- `client/index.html`
- `package.json`
- `README.md`

## Como testar
1. Abrir uma ficha.
2. Ir em **Atributos**.
3. Com o bloco expandido, confirmar que os atributos estão editáveis normalmente.
4. Clicar em **Reduzir**.
5. Confirmar que os cards reduzidos aparecem em ordem: nome, valor e bônus.
6. Clicar em **Expandir** novamente e confirmar que o editor volta sem camada por cima.

## Observação
Esta atualização não mexe em login, boot, cookies, socket, criação/exclusão de ficha ou menu da ficha.

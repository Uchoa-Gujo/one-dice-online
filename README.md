# One Dice Site v1.95.28 — atributos expandido/reduzido corrigidos

## Resumo
Esta atualização corrige o erro da v1.95.26/v1.95.27 nos atributos.

O design vertical deve existir **somente no modo reduzido**.  
O modo expandido precisa voltar a ser editável, com campo de valor, bônus e controles normais.

## Bugs corrigidos

- O design novo dos atributos foi removido da forma **expandida**.
- A forma expandida volta a permitir editar os atributos.
- A forma reduzida agora força a ordem correta:
  1. **Nome do atributo**
  2. **Valor do atributo**
  3. **Bônus do atributo**
- Corrigido o conflito onde uma regra antiga de `span` empurrava o nome para baixo, deixando a ordem como valor → nome → bônus.

## Limpezas realizadas e motivo

### 1. Render estático da v1.95.24 no grid expandido
**O que foi limpo:**  
O bloco da v1.95.24 não registra mais `renderSummaryAttributes` como render principal de `#attributes-grid`.

**Por que foi limpo:**  
Esse bloco trocava o grid editável de atributos por cards estáticos. Por isso, quando o módulo estava expandido, não dava mais para editar os atributos.

**Como foi substituído:**  
O modo expandido volta a usar o render clássico/editável dos atributos, preservando inputs e controles.

### 2. Design reduzido com ordem errada
**O que foi corrigido:**  
A ordem visual dos elementos no resumo reduzido.

**Por que foi corrigido:**  
Uma regra antiga muito específica aplicava `order` em todo `span`, então o nome do atributo, que também era um `span`, era jogado para baixo.

**Como foi substituído:**  
Foram adicionadas regras específicas para:
- `od19527-attr-name`
- `od19527-attr-value`
- `od19527-attr-bonus`

Agora o reduzido fica: nome → valor → bônus.

## Arquivos alterados
- `client/script.js`
- `client/style.css`
- `client/index.html`
- `package.json`
- `README.md`

## Como testar

1. Abrir uma ficha.
2. Ir em **Atributos** com o bloco expandido.
3. Confirmar que os atributos estão editáveis novamente.
4. Clicar em **Reduzir**.
5. Confirmar que cada atributo reduzido aparece em ordem:
   - nome;
   - valor;
   - bônus.
6. Clicar em **Expandir** de novo e confirmar que a edição volta.

## Observação
Esta atualização mexe somente nos atributos expandido/reduzido.  
Não altera login, boot, cookies, socket, menu da ficha, criação de ficha ou exclusão.

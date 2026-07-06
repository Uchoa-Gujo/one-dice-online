# One Dice Site v1.95.12

## Foco

Patch direto no código-fonte para corrigir problemas dentro da ficha, principalmente o menu de três traços fechando sozinho, o botão **X** desnecessário, o fundo antigo aparecendo e o visual dos atributos resumidos.

Esta versão mantém as correções anteriores da v1.95.11: aba **Seus Personagens** travada no design moderno após criar ficha, exclusão real de personagem, login centralizado e remoção da Fonte Manga.

## Corrigido

- o menu de três traços da ficha não fecha mais automaticamente depois de alguns segundos;
- removido o **X** visual/desnecessário do menu aberto;
- o fechamento do menu continua sendo feito pelo próprio botão de três traços;
- o botão de três traços foi redesenhado no modelo mais recente: botão vermelho arredondado com três linhas brancas;
- o botão flutuante só aparece quando o menu está fechado;
- quando o menu está aberto, o botão interno de três traços fica visível e funciona como fechar;
- removido o fundo antigo com textura/imagem que ainda vazava atrás da ficha;
- removida a textura antiga dos painéis `manga-panel::before`, que ainda podia mostrar pedaços do background antigo;
- a área de atributos resumidos foi reorganizada em coluna:
  - nome do atributo centralizado;
  - valor cheio do atributo centralizado;
  - bônus do atributo centralizado dentro do badge;
- os botões de rolagem/controles antigos dentro dos atributos resumidos foram escondidos nessa visualização;
- mantidas as correções anteriores de personagens e exclusão.

## Arquivos alterados

- `client/script.js`
- `client/style.css`
- `client/index.html`
- `package.json`
- `README.md`

## Limpezas realizadas e motivo

### 1. Fechamento automático do menu da ficha

**O que foi limpo:**  
Foi adicionada uma camada final de sincronização para impedir que timers antigos do menu voltem a aplicar `collapsed` quando o usuário deixou o menu aberto.

**Por que foi limpo:**  
Existiam rotinas antigas que rodavam por intervalo e restauravam o estado do menu. Em alguns casos, elas interpretavam o menu como fechado e recolhiam a topbar depois de alguns segundos, mesmo sem o usuário clicar.

**Como foi substituído:**  
A versão v1.95.12 grava o estado manual do menu e reabre automaticamente se um timer antigo tentar fechar o painel sozinho. Se o usuário clicar no botão de três traços para fechar, o fechamento é respeitado.

### 2. Botão X desnecessário

**O que foi limpo:**  
Foram neutralizados botões visuais antigos de fechamento dentro do menu da ficha e o botão flutuante antigo deixa de aparecer quando o painel está aberto.

**Por que foi limpo:**  
O menu já tinha o botão de três traços para abrir e fechar. O **X** criava poluição visual e deixava a interface com dois fechamentos diferentes para a mesma ação.

**Como foi substituído:**  
Agora o próprio botão de três traços abre e fecha o menu. Quando o painel está aberto, o botão flutuante é ocultado e o botão interno permanece ativo.

### 3. Design antigo do botão de menu

**O que foi limpo:**  
Foi removida a dependência visual do caractere `☰` simples como desenho final do botão.

**Por que foi limpo:**  
O caractere podia variar por fonte/navegador e não seguia o modelo visual mais recente aprovado.

**Como foi substituído:**  
O botão agora recebe três linhas reais em HTML/CSS, com fundo vermelho em degradê, borda arredondada, sombra e alinhamento fixo.

### 4. Background antigo vazando

**O que foi limpo:**  
Foram sobrescritas as regras que usavam `assets/folha.jpg` como fundo geral e como textura interna dos painéis.

**Por que foi limpo:**  
A imagem antiga ainda aparecia em partes do background, principalmente em áreas laterais e painéis, mesmo com o tema escuro ativo.

**Como foi substituído:**  
O fundo agora é escuro limpo com gradiente discreto, sem textura antiga. Os pseudo-elementos dos painéis foram removidos para impedir vazamento visual.

### 5. Atributos resumidos com layout horizontal antigo

**O que foi limpo:**  
Foram sobrescritas as regras antigas que deixavam nome, valor e bônus disputando a mesma linha dentro do card.

**Por que foi limpo:**  
Esse modelo deixava os textos apertados e não seguia a ordem desejada para a visualização resumida.

**Como foi substituído:**  
Cada card de atributo agora organiza o conteúdo em três níveis centralizados: nome, valor cheio e bônus.

## Como testar

1. Rodar `npm run check`.
2. Abrir uma ficha pelo menu **Personagens > Acessar Ficha**.
3. Clicar no botão de três traços.
4. Esperar alguns segundos e confirmar que o menu não fecha sozinho.
5. Clicar novamente no botão de três traços e confirmar que ele fecha o menu.
6. Conferir que não existe mais botão **X** no painel aberto.
7. Conferir que o botão de três traços está no modelo vermelho com três linhas brancas.
8. Verificar a ficha em tela cheia e confirmar que o background antigo não aparece nas laterais.
9. Conferir a área **Atributos** no resumo:
   - nome centralizado;
   - valor centralizado;
   - bônus centralizado abaixo.
10. Voltar para **Seus Personagens**, criar um novo personagem e confirmar que a correção da v1.95.11 continua funcionando.
11. Excluir um personagem de teste e confirmar que a correção da v1.95.10 continua funcionando.

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

1.95.12

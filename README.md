# One Dice Online — Correções da versão 1.95.18

## Resumo

Esta versão corta pela raiz o problema do site ficar **girando/carregando infinitamente** mesmo quando a tela de login já aparece.

A correção não ficou focada no formulário de login. Foi feita uma limpeza geral nos pontos que ainda podiam manter o navegador preso em carregamento: loaders antigos, boot visual, Socket.IO, script do inventário carregado fora da área correta e carregamentos secundários bloqueando a entrada.

---

## Bugs corrigidos

- O navegador podia continuar carregando infinitamente mesmo com o login visível.
- Loaders antigos `od180`, `od1805` e `od1776` ainda podiam ser criados por camadas antigas do site.
- O boot visual podia esconder telas ou manter classes de carregamento no HTML/body.
- O Socket.IO podia abrir requisição pendente e manter o navegador girando.
- O script do inventário em módulo estava sendo carregado na tela principal mesmo sem a página do inventário estar aberta.
- Login/restauração de sessão podia esperar fichas e mesas antes de liberar a interface.
- Fichas e mesas agora carregam em segundo plano, sem prender a entrada no site.

---

## Arquivos alterados

- `package.json`
- `client/index.html`
- `client/script.js`
- `client/style.css`
- `README.md`

---

## Limpezas realizadas e motivo

### 1. Remoção dos loaders antigos do HTML inicial

**O que foi removido:**  
Foram removidos do `client/index.html` os blocos iniciais de loader/boot:

- `#od180-boot-screen`
- `#od1805-boot-screen`
- `od180-critical-style`
- `od1805-preboot-script`
- `od1805-preboot-style`
- `od1805-boot-failsafe`

**Por que foi removido:**  
Esses loaders eram criados antes do `script.js` principal assumir a interface. Mesmo quando a tela de login aparecia, classes como `od180-booting` e `od1805-booting` ainda podiam manter o navegador ou a página em estado de carregamento.

**Como foi substituído:**  
A página agora abre direto no HTML real do site. Foi adicionado um guardião simples que apenas remove qualquer loader antigo caso alguma camada tente recriá-lo.

---

### 2. Socket.IO desligado no carregamento inicial

**O que foi removido:**  
O carregamento automático do Socket.IO foi removido do `index.html` e neutralizado no `script.js`.

**Por que foi removido:**  
O Socket.IO pode manter requisições pendentes, principalmente com polling ou proxy de produção. Isso pode deixar a aba do navegador girando infinitamente mesmo com a interface visível.

**Como foi substituído:**  
Nesta versão, o tempo real fica desligado no boot para garantir estabilidade. O site, login, fichas, personagens e mesas não dependem mais do socket para abrir.

---

### 3. Remoção do script do inventário da tela principal

**O que foi removido:**  
Foi removido do `client/index.html` este carregamento global:

```html
<script type="module" src="/block-inventory/script.js"></script>
```

**Por que foi removido:**  
Esse script pertence à página própria do inventário em bloco. Ele não precisa rodar na tela principal/login e podia adicionar erro ou trabalho extra durante a abertura do site.

**Como foi substituído:**  
O inventário em bloco continua com seus arquivos na pasta `client/block-inventory/`, mas não é mais carregado junto da página principal.

---

### 4. Login e boot sem carregamentos secundários bloqueantes

**O que foi alterado:**  
O fluxo final da v1.95.18 agora faz:

1. autentica o usuário;
2. abre a tela inicial imediatamente;
3. carrega fichas e mesas depois, em segundo plano;
4. usa timeout nas chamadas principais;
5. remove loaders presos em vários pontos do ciclo.

**Por que foi alterado:**  
Antes, mesmo com login correto, o site podia aguardar `/api/characters`, `/api/tables`, restauração de rota profunda ou outras camadas antes de liberar a interface. Se uma dessas partes demorasse, parecia que o site inteiro estava travado.

**Como foi substituído:**  
A entrada no site não depende mais desses carregamentos secundários. Se ficha/mesa demorar, o usuário entra mesmo assim e os dados atualizam depois.

---

### 5. CSS final contra loader preso

**O que foi adicionado:**  
Uma trava no fim do `client/style.css` para impedir que loaders antigos voltem visualmente:

- `#od180-boot-screen`
- `#od1805-boot-screen`
- `#od1776-solid-loader`
- `.od1776-solid-loader`
- `.od180-loader-stuck`
- `[data-od-loader]`

**Por que foi adicionado:**  
O projeto tem muitas camadas antigas. Mesmo removendo os blocos principais, uma função antiga ainda poderia tentar recriar loading. A trava visual garante que isso não bloqueie o uso do site.

---

## Mantido das versões anteriores

- Botão **EXCLUIR** de personagem continua funcionando.
- Aba **Seus Personagens** não deve voltar para o modelo antigo após criar personagem.
- Menu de três traços da ficha permanece sem o **X**.
- Design novo do botão de três traços mantido.
- Fundo antigo da ficha continua bloqueado.
- Atributos resumidos continuam na ordem:
  - nome centralizado;
  - valor centralizado;
  - bônus centralizado.

---

## Como testar

1. Subir a versão nova no servidor.
2. Abrir em aba anônima ou navegador limpo.
3. Conferir se a tela de login aparece sem loader por cima.
4. Observar se a aba do navegador para de girar depois de poucos segundos.
5. Fazer login.
6. Conferir se entra na tela inicial mesmo que fichas/mesas demorem.
7. Abrir **Seus Personagens**.
8. Criar personagem novo e confirmar que o design moderno não volta para o modelo antigo.
9. Excluir personagem e confirmar que ele não volta por cache.
10. Abrir ficha e conferir menu/atributos/background.

---

## Observação importante

Nesta versão, o Socket.IO foi desligado no carregamento inicial para eliminar o giro infinito. Depois que o site estiver estável, o tempo real pode ser reativado com carregamento sob demanda apenas dentro da mesa, usando WebSocket direto e sem polling.

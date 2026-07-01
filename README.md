# One Dice Site v1.90.2

## Objetivo

Patch corretivo da v1.90.1, focado nos bugs visuais e de fluxo do menu inicial, personagens, campanhas e gerenciador interno de campanha.

## Correções feitas

### 1. Menu principal centralizado

A barra com:

- Início;
- Personagens;
- Campanhas;

foi forçada a ficar centralizada dentro da topbar.

### 2. Blocos da página inicial levantados

Os quatro blocos da página inicial foram reposicionados para cima, evitando corte e melhorando a área clicável.

### 3. Atributos da ficha

Corrigido o clique nos cards de atributos:

- clicar no quadrado do atributo rola o teste;
- D20 usa `1D20 + bônus`;
- Pool Dice rola pool de D20 e pega o maior resultado.

### 4. Scroll da aba Personagens

A área de personagens ganhou espaçamento lateral para a barra de scroll não ficar colada.

### 5. Cards de personagens em retângulo horizontal

A aba Personagens foi ajustada para cards horizontais:

- imagem à esquerda;
- informações no centro;
- botões em uma linha.

### 6. Menu Minhas Campanhas

O menu de campanhas foi reorganizado para usar 1 campanha por linha, em formato horizontal, removendo o visual alto demais e desorganizado.

### 7. Campanha sem ficha vinculada

Se a campanha não tiver personagem vinculado, o gerenciador mostra:

- nenhuma ficha vinculada à mesa.

Não cria mais uma informação falsa como se existisse ficha.

### 8. Aba Jogadores com foto

A aba Jogadores agora mostra imagem da conta/ficha quando disponível.

### 9. Acesso à ficha pela campanha

A abertura de ficha pelo gerenciador foi protegida para reduzir flicker e evitar sobreposição com o gerenciador.

### 10. Desvincular ficha

Adicionado botão para desvincular a ficha da campanha sem remover o jogador.

### 11. Voltar para campanha

Quando uma ficha é aberta a partir da campanha, aparece o botão:

- Voltar para Campanha.

### 12. Menu da ficha menor

O menu aberto pelas três linhas foi compactado para não ficar com um retângulo enorme vazio.

## Observação importante

Os dados existentes não foram apagados. A correção atua nas camadas visuais e no fluxo de renderização para evitar sobreposição e bugs, sem destruir campanhas, contas ou fichas já criadas.

## Versão

1.90.2

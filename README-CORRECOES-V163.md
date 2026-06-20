# One Dice Site v1.63 — Redesign visual e URLs por nome

Base: v1.62.

## Objetivo
Reformular visualmente o site sem trocar o motor principal da ficha/campanha, para evitar repetir a quebra causada pela reescrita completa anterior.

## Mudanças principais

- Nova camada visual final (`V163`) com interface mais limpa, harmônica e compacta.
- Painéis com visual glass/dark, bordas mais suaves, sombras consistentes e melhor espaçamento.
- Melhorias em telas de login, hub, campanhas, personagens, ficha, mesa, chats, rolagens e cards.
- Redução de aparência antiga/intermitente por CSS final, sem apagar funções vitais do cliente.
- Barra de ações continua oculta quando não ativada.
- Breadcrumb dentro da ficha/mesa para orientar onde o usuário está.
- Título da aba do navegador atualizado conforme contexto.
- URLs mais legíveis:
  - `/inicio`
  - `/personagens`
  - `/campanhas`
  - `/personagem/nome-do-personagem--ID?aba=resumo`
  - `/mesa/nome-da-mesa--ID`
  - `/mesa/nome-da-mesa--ID/personagem/nome-do-personagem--ID?aba=resumo`

## Observação técnica
A limpeza foi feita de forma segura: arquivos de README antigos foram removidos, mas a lógica principal antiga não foi apagada em massa porque isso já quebrou o layout em versões anteriores. A nova camada `V163` isola e sobrepõe visualmente o legado sem remover regras de ficha, mesa, salvamento, perícias, habilidades, equipamentos, imagem ou banco.

## Versão
- package.json: 1.63.0
- client/style.css?v=1.63.0
- client/script.js?v=1.63.0

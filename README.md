# One Dice Online v0.41

Esta versão é a primeira base preparada para servidor.

Ela ainda mantém o visual do site atual em `client/`, mas adiciona:

- Node.js/Express
- PostgreSQL
- Socket.IO
- Docker Compose
- Estrutura de banco para usuários, fichas, mesas, membros, chat, iniciativa, loja, drop, inventário e transformações

## Arquivos principais

```txt
client/       visual atual do site
server/       servidor Node.js
database/     schema do PostgreSQL
uploads/      imagens futuras
docker-compose.yml
Dockerfile
.env.example
```

## Como será usado na VPS

1. Criar um arquivo `.env` baseado no `.env.example`.
2. Subir com Docker Compose.
3. Acessar o site pela porta 3000 ou por domínio configurado no Nginx.

## Importante

A v0.41 é uma fundação. Ela não migra automaticamente todo o sistema antigo do `localStorage` para o banco ainda.
As próximas versões conectam a interface aos endpoints online por etapas.

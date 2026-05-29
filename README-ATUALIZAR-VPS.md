# Atualizar One Dice na VPS para v0.42

Na VPS, dentro da pasta do projeto:

```bash
cd /opt/one-dice-online
git pull
docker compose up -d --build
docker compose ps
```

Depois abra o site e use Ctrl+F5 no navegador.

## O que esta versão corrige

- Login e cadastro agora usam o servidor/API.
- Fichas passam a ser salvas no PostgreSQL.
- Mesas passam a ser criadas no PostgreSQL.
- Entrar por código de mesa passa a consultar o banco.
- Vincular ficha à mesa passa a salvar no banco.
- Adicionado ajuste leve de layout para celular.

## Verificação rápida no banco

```bash
docker compose exec db psql -U onedice -d onedice
select id, nick, real_name from users;
select id, name, invite_code from tables;
select table_id, user_id, role, character_id from table_members;
\q
```

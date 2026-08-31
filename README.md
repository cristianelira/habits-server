# Habits — Server

API do projeto Habits (Fastify + Prisma).

## Rodando localmente

```bash
npm install
npx prisma generate
npm run dev
```

Crie um arquivo `.env` na raiz com:

```
DATABASE_URL="file:./dev.db"
PORT=3333
```

## Build / produção

```bash
npm run build   # roda "prisma generate"
npm start       # sobe o servidor com tsx
```

Em produção, `DATABASE_URL` deve apontar para um banco libSQL hospedado (ex. [Turso](https://turso.tech)) — o disco local não é persistente em provedores como o Render. A porta é lida de `process.env.PORT`, com fallback para `3333`.

## Rotas

- `POST /habits`
- `GET /day`
- `PATCH /habits/:id/toggle`
- `GET /summary`

# Habits — Server

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Database](https://img.shields.io/badge/DB-SQLite%20%2F%20libSQL-07405E?logo=sqlite&logoColor=white)

## Visão geral

API do projeto **Habits**: mantém os hábitos recorrentes cadastrados, o registro de conclusão dia a dia e o resumo agregado de progresso usado para colorir os calendários/heatmaps dos clientes.

Ela existe para centralizar numa única fonte de verdade a regra de "quais hábitos valem para qual dia da semana" e o cálculo de progresso (`completed`/`amount`) — sem ela, os dois front-ends do projeto ([`habits/mobile`](../mobile), Expo/React Native, e [`habits/web`](../web), React/Vite) teriam que duplicar essa lógica e o acesso a dados cada um do seu lado.

Este repositório é **só a API** — não tem interface própria; é consumida via HTTP/JSON pelos clientes mobile e web.

> 🎬 *Diagrama de entidade-relacionamento gerado automaticamente em [`prisma/ERD.svg`](prisma/ERD.svg).*

## Sumário

- [Tecnologias e stack](#tecnologias-e-stack)
- [Arquitetura](#arquitetura)
- [Funcionalidades (rotas)](#funcionalidades-rotas)
- [Como rodar o projeto](#como-rodar-o-projeto)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Observações](#observações)

## Tecnologias e stack

| Camada | Tecnologias |
|---|---|
| **Core** | [Node.js ≥ 20](https://nodejs.org/), [TypeScript ^7](https://www.typescriptlang.org/) (ESM puro, `"type": "module"`), [Fastify 5](https://fastify.dev/) como framework HTTP. |
| **Validação** | [Zod 4](https://zod.dev/) — todo body/params/query de rota é parseado por um schema Zod antes de ser usado; nada chega ao Prisma sem passar por uma validação explícita. |
| **Banco de dados / ORM** | [Prisma ORM 7](https://www.prisma.io/) com [`@prisma/adapter-libsql`](https://www.prisma.io/docs/orm/overview/databases/turso) — SQLite em arquivo (`dev.db`) em desenvolvimento, e libSQL remoto (ex. [Turso](https://turso.tech)) em produção, trocando apenas `DATABASE_URL`/`TURSO_AUTH_TOKEN`. `prisma-erd-generator` + `@mermaid-js/mermaid-cli` geram automaticamente o diagrama `prisma/ERD.svg` a cada `prisma generate`. |
| **HTTP/CORS** | `@fastify/cors`, liberado para os métodos usados pelas rotas (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), já que a API é consumida por origens diferentes (app mobile e SPA web). |
| **Datas** | `dayjs` + plugin `utc`, para normalizar toda data recebida/gravada em UTC e evitar bugs de fuso horário nas comparações por dia. |
| **Execução/Build** | [`tsx`](https://tsx.is/) roda o TypeScript diretamente em dev (`tsx watch`) e produção (`tsx`, sem etapa de transpilação para `dist/`); o script `build` só roda `prisma generate` (gera o Prisma Client, não compila a aplicação). |

## Arquitetura

Ao contrário de `mobile` e `web` (que seguem Clean Architecture em camadas), o `server` é deliberadamente simples: **não há separação em domain/use-cases** — cada rota Fastify já contém validação, regra de negócio e acesso a dados. Faz sentido para o tamanho atual da API (4 rotas); se ela crescer, extrair casos de uso (como já feito nos dois clientes) passa a valer a pena.

### Fluxo

```
Cliente (mobile ou web)
        │  HTTP (JSON)
        ▼
server.ts        — cria a instância do Fastify, registra CORS e as rotas, sobe o servidor
        │
        ▼
routes.ts         — por rota: valida entrada (Zod) → lê/escreve via Prisma → devolve JSON
        │
        ▼
lib/prisma.ts      — instancia o PrismaClient com o adapter libSQL
        │
        ▼
SQLite local (dev.db)  ── DATABASE_URL ──  ou  libSQL remoto (Turso, produção)
```

`src/generated/prisma/` (código do Prisma Client, gerado por `prisma generate` a partir de `prisma/schema.prisma`) fica no meio entre `lib/prisma.ts` e o banco — é gerado, não editado à mão, e por isso é ignorado pelo Git.

### Modelo de dados

Quatro tabelas (ver [`prisma/schema.prisma`](prisma/schema.prisma)):

- **`habits`** — o hábito em si (`title`, `created_At`).
- **`habit_week_days`** — em quais dias da semana (0=domingo…6=sábado) um hábito se repete (N:1 com `habits`).
- **`days`** — um registro por data que teve pelo menos uma interação (`date`, única).
- **`day_habits`** — tabela de junção: qual hábito foi marcado como concluído em qual `day`.

Um hábito é considerado "previsto" para uma data se `created_At` for anterior/igual a ela **e** o dia da semana da data bater com algum `habit_week_days` do hábito — histórico de hábitos criados no meio do mês não é retroativo.

### Convenções de nomenclatura

- **Rotas**: registradas inline em `appRoutes` (`app.get`, `app.post`, `app.patch`), uma por bloco, com o schema Zod de validação declarado logo no início do handler.
- **Schemas Zod**: `<ação><Entidade>{Body,Params,Query}`, ex. `createHabitBody`, `getDayParams`, `toggleHabitParams`/`toggleHabitQuery`.
- **Colunas do banco**: majoritariamente `snake_case` (`week_day`, `habit_id`, `day_id`) — com uma inconsistência observada em `created_At` (mistura `snake_case` e `camelCase`; não é nem `created_at` nem `createdAt`). Vale padronizar numa próxima migration.
- **Models Prisma**: `PascalCase` no schema (`Habit`, `DayHabit`), mapeados para tabelas em `snake_case` plural via `@@map` (`habits`, `day_habits`).

### Decisões arquiteturais e o porquê

- **Sem camadas de domínio/use-case** — para 4 rotas, a indireção extra (repository, use case) adicionaria arquivos sem reduzir complexidade real; a lógica já é curta o suficiente para caber no próprio handler da rota.
- **Zod em toda rota** — garante que `request.body`/`params`/`query` nunca são usados sem forma conhecida, com erro automático (400) se o formato não bater, sem `if` manual de validação espalhado pelo código.
- **Prisma + adapter libSQL** — permite rodar em SQLite local (arquivo, zero setup) em desenvolvimento e em libSQL hospedado (Turso) em produção, sem mudar nenhuma query — só a `DATABASE_URL`. Importante em plataformas como o Render, onde o disco local não é persistente entre deploys.
- **`$queryRaw` no `/summary`** — a agregação (quantos hábitos eram possíveis vs. quantos foram completados por dia, considerando o dia da semana e a data de criação do hábito) é mais direta em SQL puro (usando `strftime` do SQLite) do que via Prisma Client. Troca portabilidade (SQL específico de SQLite/libSQL) por uma única query simples em vez de múltiplas idas ao banco + agregação em memória.
- **CORS aberto a todos os métodos usados** — a API tem dois clientes (mobile e web), de origens diferentes; travar CORS por origem específica não traria benefício de segurança real aqui, já que a API não tem autenticação nem dados sensíveis.
- **Sem autenticação/multiusuário** — os hábitos são globais à instância da API (não há conceito de usuário/login). Adequado ao escopo atual (projeto pessoal/de estudo), não a um produto multiusuário.
- **`tsx` em vez de compilar para `dist/`** — roda TypeScript diretamente tanto em dev quanto em produção (`tsx src/server.ts`), evitando uma etapa de build separada; o único "build" real do projeto é gerar o Prisma Client.

## Funcionalidades (rotas)

| Rota | Descrição |
|---|---|
| `POST /habits` | Cria um hábito novo, com `title` e `weekDays` (dias da semana em que se repete). |
| `GET /day?date=` | Retorna os hábitos previstos para a data (`possibleHabits`) e os ids já concluídos nela (`completedHabits`). |
| `PATCH /habits/:id/toggle?date=` | Marca ou desmarca (alterna) a conclusão de um hábito numa data; cria o registro do dia se ainda não existir. `date` é opcional — sem ela, usa o dia atual. |
| `GET /summary` | Resumo por dia (`id`, `date`, `completed`, `amount`) de todo o histórico com pelo menos uma interação — usado para colorir os calendários/heatmaps dos clientes. |

## Como rodar o projeto

### Pré-requisitos

- Node.js 20+ e npm.

### Instalação e banco local

```bash
npm install
```

Crie um arquivo `.env` na raiz (veja [`.env.example`](.env.example)):

```
DATABASE_URL="file:./dev.db"
PORT=3333
```

Aplique as migrations e gere o Prisma Client — necessário mesmo em uma máquina nova, já que `dev.db` **não** é versionado:

```bash
npx prisma migrate dev
```

Isso cria `dev.db` a partir das migrations em [`prisma/migrations`](prisma/migrations) e roda `prisma generate` automaticamente. Opcionalmente, popule com dados de exemplo (usa [`prisma/seed.ts`](prisma/seed.ts), configurado em [`prisma7.config.ts`](prisma7.config.ts)):

```bash
npx prisma db seed
```

### Desenvolvimento

```bash
npm run dev
```

Sobe o servidor com `tsx watch` (reinicia sozinho a cada alteração), ouvindo em `http://localhost:3333` (ou a `PORT` definida).

### Inspecionar o banco

```bash
npm run studio
```

Abre o [Prisma Studio](https://www.prisma.io/studio) apontado para o `dev.db` local.

### Build / produção

```bash
npm run build   # roda "prisma generate"
npm start       # sobe o servidor com tsx
```

Em produção, `DATABASE_URL` deve apontar para um banco libSQL hospedado (ex. Turso — defina também `TURSO_AUTH_TOKEN`), já que o disco local não é persistente em provedores como o Render. Antes de subir a aplicação, rode as migrations contra esse banco remoto:

```bash
npx prisma migrate deploy
```

A porta é lida de `process.env.PORT` (definida automaticamente por provedores como o Render), com fallback para `3333`.

## Estrutura de pastas

```
server/
├── prisma/
│   ├── schema.prisma           # models (Habit, HabitWeekDays, Day, DayHabit) e datasource
│   ├── seed.ts                 # popula o banco com hábitos/dias de exemplo
│   ├── ERD.svg                 # diagrama entidade-relacionamento (gerado)
│   └── migrations/             # histórico de migrations do Prisma
├── src/
│   ├── generated/prisma/       # Prisma Client gerado (não versionado, não editar à mão)
│   ├── lib/
│   │   └── prisma.ts           # instancia o PrismaClient com o adapter libSQL
│   ├── routes.ts               # as 4 rotas da API: validação (Zod) + Prisma + resposta
│   └── server.ts               # bootstrap: Fastify, CORS, registro de rotas, listen
├── .env.example
├── prisma7.config.ts           # configuração do Prisma (schema, migrations, seed)
└── tsconfig.json
```

## Observações

- `server.ts` importa `dotenv/config` para carregar o `.env`, mas `dotenv` **não** está listado em `dependencies` no `package.json` — hoje funciona por ser instalado transitivamente por outro pacote (ex. Prisma/tsx). Vale adicioná-lo explicitamente para não depender dessa transitividade, que pode mudar em uma atualização futura.

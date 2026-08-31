/**
 * Ponto de entrada da aplicação.
 *
 * Responsável por criar a instância do Fastify, registrar os
 * middlewares/plugins globais (CORS) e as rotas da API, e por fim
 * subir o servidor HTTP.
 */

import 'dotenv/config'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { appRoutes } from './routes.js'


const app = Fastify()

/**
 * Habilita CORS para a API, liberando os métodos HTTP utilizados
 * pelas rotas de hábitos (criação, consulta, atualização e remoção).
 */
app.register(cors, {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
})

/** Registra todas as rotas da aplicação definidas em `routes.ts`. */
app.register(appRoutes)



/**
 * Inicia o servidor HTTP, ouvindo em todas as interfaces de rede
 * (`0.0.0.0`), e loga no console quando estiver pronto para receber
 * requisições.
 *
 * A porta é lida de `process.env.PORT` (definida automaticamente por
 * provedores como o Render) e cai para `3333` em desenvolvimento local.
 */
app.listen({
    port: Number(process.env.PORT) || 3333,
    host: '0.0.0.0'
}).then(() => {
    console.log('HTTP Server running')
})

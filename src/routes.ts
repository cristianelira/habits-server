import type { FastifyInstance } from "fastify"
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)
import { z } from 'zod'
import { prisma } from "./lib/prisma.js"


/**
 * Registra as rotas da API de hábitos na instância do Fastify.
 *
 * @param app - Instância do Fastify na qual as rotas serão registradas.
 */
export async function appRoutes(app: FastifyInstance) {
    /**
     * Cria um novo hábito.
     *
     * Body esperado:
     * - `title` - Nome do hábito.
     * - `weekDays` - Dias da semana em que o hábito deve ser praticado
     *   (0 a 6, sendo 0 = domingo e 6 = sábado).
     */
    app.post('/habits', async (request) => {
        const createHabitBody = z.object({
            title: z.string(),
            weekDays: z.array(
                z.number().min(0).max(6)
            )
        })

        const { title, weekDays } = createHabitBody.parse(request.body)

        const today = dayjs().startOf('day').toDate()

        await prisma.habit.create({
            data: {
                title,
                created_At: new Date(),
                weekDays: {
                    create: weekDays.map(weekDay => {
                        return {
                            week_day: weekDay
                        }
                    })
                }
            }
        })
    })

    /**
     * Lista os hábitos possíveis e os já completados para um dia específico.
     *
     * Query esperada:
     * - `date` - Data de referência a ser consultada.
     *
     * @returns `possibleHabits` (hábitos disponíveis para o dia da semana)
     * e `completedHabits` (ids dos hábitos já marcados como concluídos).
     */
    app.get('/day', async (request) => {
        const getDayParams = z.object({
            date: z.coerce.date()
        })

        const { date } = getDayParams.parse(request.query)

        const parsedDate = dayjs.utc(date).startOf('day')
        const weekDay = parsedDate.get('day')

        const possibleHabits = await prisma.habit.findMany({
            where: {
                created_At: {
                    lte: parsedDate.endOf('day').toDate(),
                },
                weekDays: {
                    some: {
                        week_day: weekDay,
                    }
                }
            }
        })

        const day = await prisma.day.findUnique({
            where: {
                date: parsedDate.toDate(),
            },
            include:{
                dayHabits: true
            }
        })

        const completedHabits = day?.dayHabits.map(dayHabit => {
            return dayHabit.habit_id
        }) ?? []

        return {
            possibleHabits,
            completedHabits
        }
    })

    /**
     * Alterna (marca/desmarca) a conclusão de um hábito em uma data.
     *
     * Params esperados:
     * - `id` - Identificador (UUID) do hábito.
     *
     * Query opcional:
     * - `date` - Data de referência; quando omitida, usa o dia atual.
     *
     * Cria o registro do dia (`Day`) caso ainda não exista e, em
     * seguida, remove o vínculo `DayHabit` se já estiver marcado como
     * concluído ou o cria caso contrário.
     */
    app.patch('/habits/:id/toggle', async (request) => {
        const toggleHabitParams = z.object({
            id: z.string().uuid()
        })
        const toggleHabitQuery = z.object({
            date: z.coerce.date().optional()
        })

        const { id } = toggleHabitParams.parse(request.params)
        const { date } = toggleHabitQuery.parse(request.query)

        const referenceDate = date ? dayjs.utc(date) : dayjs.utc(dayjs().format('YYYY-MM-DD'))
        const targetDate = referenceDate.startOf('day').toDate()

        let day = await prisma.day.findUnique({
            where: {
                date: targetDate
            }
        })

        if (!day) {
            day = await prisma.day.create({
                data: {
                    date: targetDate
                }
            })
        }

        const dayHabit = await prisma.dayHabit.findUnique({
            where: {
                day_id_habit_id: {
                    day_id: day.id,
                    habit_id: id
                }
            }
        })

        if (dayHabit) {
            await prisma.dayHabit.delete({
                where: {
                    id: dayHabit.id
                }
            })
        } else {
            await prisma.dayHabit.create({
                data: {
                    day_id: day.id,
                    habit_id: id
                }
            })
        }
    })

    /**
     * Retorna o resumo geral de progresso: para cada dia, quantos
     * hábitos foram completados (`completed`) em relação ao total de
     * hábitos previstos para aquele dia da semana (`amount`).
     *
     * Consulta feita via SQL bruto (compatível com SQLite).
     */
    app.get('/summary', async () => {
        const summary = await prisma.$queryRaw`
        SELECT
            D.id,
            D.date,
            (
                SELECT
                    cast(count(*) as float)
                FROM day_habits DH
                WHERE DH.day_id = D.id
            ) as completed,
            (
                SELECT
                    cast(count(*) as float)
                FROM habit_week_days HWD
                JOIN habits H
                    ON H.id = HWD.habit_id
                WHERE
                    HWD.week_day = cast(strftime('%w', D.date) as int)
                    AND date(H.created_At) <= date(D.date)
            ) as amount
        FROM days D
        `

        return summary
    })
}
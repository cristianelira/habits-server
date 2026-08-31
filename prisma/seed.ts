import { PrismaLibSql } from '@prisma/adapter-libsql'

import { PrismaClient } from '../src/generated/prisma/client.js'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
    await prisma.dayHabit.deleteMany()
    await prisma.habitWeekDays.deleteMany()
    await prisma.day.deleteMany()
    await prisma.habit.deleteMany()

    await Promise.all([
        prisma.habit.create({
        data: {
            id: '1',
            title: 'Beber Água',
            created_At: new Date('2026-08-20T00:00:00.000z'),
            weekDays:{
                create:[
                    {week_day: 1},
                    {week_day: 2},
                    {week_day: 3}
                ]
            }
        }
        }),

        prisma.habit.create({
        data: {
            id: '2',
            title: 'Exercicios',
            created_At: new Date('2026-08-15T00:00:00.000z'),
            weekDays:{
                create:[
                    {week_day: 3},
                    {week_day: 2},
                    {week_day: 4}
                ]
            }
        }
        }),

        prisma.habit.create({
        data: {
            id: '3',
            title: 'Dormir 8h',
            created_At: new Date('2026-08-22T00:00:00.000z'),
            weekDays:{
                create:[
                    {week_day: 1},
                    {week_day: 2},
                    {week_day: 3},
                    {week_day: 4},
                    {week_day: 5}
                ]
            }
        }
        })
    ])

    await Promise.all([
        prisma.day.create({
            data: {
                date: new Date('2026-08-20T00:00:00.000z'),
                dayHabits:{
                    create:[
                        { habit_id: '1' }
                    ]
                }
            }
        }),

        prisma.day.create({
            data: {
                date: new Date('2026-08-21T00:00:00.000z'),
                                dayHabits:{
                    create:[
                        { habit_id: '1' }
                    ]
                }
            }
        }),

        prisma.day.create({
            data: {
                date: new Date('2026-08-22T00:00:00.000z'),
                                dayHabits:{
                    create:[
                        { habit_id: '1' },
                        { habit_id: '2' }
                    ]
                }
            }
        })
    ])

}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect
        process.exit(1)
    })
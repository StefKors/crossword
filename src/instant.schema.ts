// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react"

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
      isAdmin: i.boolean().optional(),
    }),
    crosswords: i.entity({
      title: i.string(),
      date: i.string().unique().indexed(),
      grid: i.json(),
      words: i.json(),
      width: i.number(),
      height: i.number(),
      status: i.string().indexed(),
      createdAt: i.date().indexed(),
    }),
    userSettings: i.entity({
      showTimer: i.boolean(),
    }),
    userProgress: i.entity({
      date: i.string().indexed(),
      cellState: i.json().optional(),
      completedAt: i.date().optional(),
      timeSpent: i.number(),
      correctCells: i.number().optional(),
      totalCells: i.number().optional(),
      mode: i.string(),
    }),
  },
  links: {
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    crosswordCreator: {
      forward: { on: "crosswords", has: "one", label: "creator" },
      reverse: { on: "$users", has: "many", label: "createdCrosswords" },
    },
    settingsUser: {
      forward: {
        on: "userSettings",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
      reverse: { on: "$users", has: "one", label: "settings" },
    },
    progressUser: {
      forward: {
        on: "userProgress",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
      reverse: { on: "$users", has: "many", label: "progress" },
    },
    progressCrossword: {
      forward: {
        on: "userProgress",
        has: "one",
        label: "crossword",
        onDelete: "cascade",
      },
      reverse: { on: "crosswords", has: "many", label: "progress" },
    },
  },
  rooms: {},
})

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema

export type { AppSchema }
export default schema

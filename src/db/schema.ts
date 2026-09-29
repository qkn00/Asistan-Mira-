import { pgTable, serial, text, timestamp, integer, real, boolean, jsonb } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  emotion: text("emotion").notNull().default("happy"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  userName: text("user_name").notNull().default("Gökhan"),
  outfit: text("outfit").notNull().default("sweater"),
  voiceRate: real("voice_rate").notNull().default(1),
  voicePitch: real("voice_pitch").notNull().default(1.15),
  persona: text("persona").notNull().default("flirty"),
  glamour: boolean("glamour").notNull().default(true),
});

export const customOutfits = pgTable("custom_outfits", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  mime: text("mime").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const operations = pgTable("operations", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  status: text("status").notNull().default("success"),
  summary: text("summary").notNull(),
  platform: text("platform"),
  externalId: text("external_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  recurrence: text("recurrence"),
  source: text("source").default("mira"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("draft"),
  topic: text("topic"),
  externalId: text("external_id"),
  url: text("url"),
  views: integer("views").default(0).notNull(),
  likes: integer("likes").default(0).notNull(),
  comments: integer("comments").default(0).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trends = pgTable("trends", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  platform: text("platform"),
  sourceUrl: text("source_url"),
  score: real("score"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  foundAt: timestamp("found_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  category: text("category").notNull().default("general"),
  importance: integer("importance").notNull().default(3),
  source: text("source").default("mira"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

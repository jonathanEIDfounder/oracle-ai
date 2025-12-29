/**
 * ORACLE AI - Database Schema
 * 
 * COPYRIGHT (C) 2024-2025 JONATHAN SHERMAN
 * ALL RIGHTS RESERVED WORLDWIDE
 * 
 * All database tables are under OWP protection.
 * Sovereign owner: Jonathan Sherman (ID: 1)
 */

import { pgTable, serial, integer, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  isAdmin: boolean("is_admin").notNull().default(false),
  permissions: jsonb("permissions").default({}),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  aiProvider: text("ai_provider").default("claude"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model: text("model"),
  provider: text("provider"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const securityLogs = pgTable("security_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  details: jsonb("details").default({}),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const aiConfigs = pgTable("ai_configs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  isActive: boolean("is_active").default(true),
  config: jsonb("config").default({}),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const accessKeys = pgTable("access_keys", {
  id: serial("id").primaryKey(),
  keyHash: text("key_hash").notNull().unique(),
  ownerEmail: text("owner_email").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  usedAt: timestamp("used_at"),
  usedBy: text("used_by"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sovereignDevices = pgTable("sovereign_devices", {
  id: serial("id").primaryKey(),
  fingerprint: text("fingerprint").notNull().unique(),
  deviceModel: text("device_model").notNull(),
  platform: text("platform").notNull(),
  ownerEmail: text("owner_email").notNull(),
  isAuthorized: boolean("is_authorized").notNull().default(true),
  lastAccess: timestamp("last_access").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const owpViolations = pgTable("owp_violations", {
  id: serial("id").primaryKey(),
  deviceFingerprint: text("device_fingerprint"),
  ipAddress: text("ip_address"),
  violationType: text("violation_type").notNull(),
  details: jsonb("details").default({}),
  isLocked: boolean("is_locked").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertSecurityLogSchema = createInsertSchema(securityLogs).omit({ id: true, createdAt: true });
export const insertAiConfigSchema = createInsertSchema(aiConfigs).omit({ id: true, createdAt: true });
export const insertAccessKeySchema = createInsertSchema(accessKeys).omit({ id: true, createdAt: true });
export const insertSovereignDeviceSchema = createInsertSchema(sovereignDevices).omit({ id: true, createdAt: true });
export const insertOwpViolationSchema = createInsertSchema(owpViolations).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type SecurityLog = typeof securityLogs.$inferSelect;
export type InsertSecurityLog = z.infer<typeof insertSecurityLogSchema>;
export type AiConfig = typeof aiConfigs.$inferSelect;
export type InsertAiConfig = z.infer<typeof insertAiConfigSchema>;
export type AccessKey = typeof accessKeys.$inferSelect;
export type InsertAccessKey = z.infer<typeof insertAccessKeySchema>;
export type SovereignDevice = typeof sovereignDevices.$inferSelect;
export type InsertSovereignDevice = z.infer<typeof insertSovereignDeviceSchema>;
export type OwpViolation = typeof owpViolations.$inferSelect;
export type InsertOwpViolation = z.infer<typeof insertOwpViolationSchema>;

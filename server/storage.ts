import { db } from "./db";
import { users, conversations, messages, securityLogs, aiConfigs } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcrypt";

export const storage = {
  async createUser(username: string, email: string, password: string, isAdmin: boolean = false) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await db.insert(users).values({
      username,
      email,
      password: hashedPassword,
      isAdmin,
      role: isAdmin ? "admin" : "user",
    }).returning();
    return user;
  },

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  async getUserById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async validatePassword(user: typeof users.$inferSelect, password: string) {
    return bcrypt.compare(password, user.password);
  },

  async getAllUsers() {
    return db.select().from(users).orderBy(desc(users.createdAt));
  },

  async updateUserPermissions(userId: number, permissions: object) {
    const [user] = await db.update(users)
      .set({ permissions })
      .where(eq(users.id, userId))
      .returning();
    return user;
  },

  async setUserAdmin(userId: number, isAdmin: boolean) {
    const [user] = await db.update(users)
      .set({ isAdmin, role: isAdmin ? "admin" : "user" })
      .where(eq(users.id, userId))
      .returning();
    return user;
  },

  async createConversation(title: string, userId?: number, aiProvider: string = "claude") {
    const [conversation] = await db.insert(conversations).values({ title, userId, aiProvider }).returning();
    return conversation;
  },

  async getConversation(id: number) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  },

  async getAllConversations(userId?: number) {
    if (userId) {
      return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.createdAt));
    }
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  },

  async deleteConversation(id: number) {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string, model?: string, provider?: string) {
    const [message] = await db.insert(messages).values({ conversationId, role, content, model, provider }).returning();
    return message;
  },

  async logSecurityEvent(userId: number | null, action: string, details: object = {}, ipAddress?: string) {
    const [log] = await db.insert(securityLogs).values({ userId, action, details, ipAddress }).returning();
    return log;
  },

  async getSecurityLogs(limit: number = 100) {
    return db.select().from(securityLogs).orderBy(desc(securityLogs.createdAt)).limit(limit);
  },

  async getAiConfigs() {
    return db.select().from(aiConfigs).orderBy(aiConfigs.name);
  },

  async createAiConfig(name: string, provider: string, model: string, config: object = {}) {
    const [aiConfig] = await db.insert(aiConfigs).values({ name, provider, model, config }).returning();
    return aiConfig;
  },
};

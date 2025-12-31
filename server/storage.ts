/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * STORAGE MODULE
 * Database operations and user management
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { db } from "./db";
import { users, conversations, messages, securityLogs, aiConfigs, accessKeys, keywordRules, accessControl, platformLockdown } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from "crypto";

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

  async generateAccessKey(ownerEmail: string, expiresInHours: number = 24) {
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    
    await db.insert(accessKeys).values({
      keyHash,
      ownerEmail,
      isUsed: false,
      expiresAt,
    });
    
    return { key: rawKey, expiresAt };
  },

  async validateAccessKey(key: string, email: string) {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const [accessKey] = await db.select().from(accessKeys)
      .where(and(eq(accessKeys.keyHash, keyHash), eq(accessKeys.ownerEmail, email)));
    
    if (!accessKey) return { valid: false, reason: 'Invalid key' };
    if (accessKey.isUsed) return { valid: false, reason: 'Key already used' };
    if (accessKey.expiresAt && accessKey.expiresAt < new Date()) return { valid: false, reason: 'Key expired' };
    
    await db.update(accessKeys)
      .set({ isUsed: true, usedAt: new Date(), usedBy: email })
      .where(eq(accessKeys.id, accessKey.id));
    
    return { valid: true, accessKey };
  },

  async getAccessKeyStatus(ownerEmail: string) {
    return db.select().from(accessKeys)
      .where(eq(accessKeys.ownerEmail, ownerEmail))
      .orderBy(desc(accessKeys.createdAt));
  },

  async lockKeyword(keyword: string, reason?: string, action: string = "block", severity: string = "warning", matchType: string = "exact", caseSensitive: boolean = false) {
    const [rule] = await db.insert(keywordRules).values({
      keyword,
      isLocked: true,
      lockReason: reason,
      action,
      severity,
      matchType,
      caseSensitive,
    }).onConflictDoUpdate({
      target: keywordRules.keyword,
      set: {
        isLocked: true,
        lockReason: reason,
        action,
        severity,
        matchType,
        caseSensitive,
        updatedAt: new Date(),
      }
    }).returning();
    return rule;
  },

  async unlockKeyword(keyword: string) {
    const [rule] = await db.update(keywordRules)
      .set({ isLocked: false, lockReason: null, updatedAt: new Date() })
      .where(eq(keywordRules.keyword, keyword))
      .returning();
    return rule;
  },

  async getAllKeywordRules() {
    return db.select().from(keywordRules).orderBy(desc(keywordRules.createdAt));
  },

  async getLockedKeywords() {
    return db.select().from(keywordRules).where(eq(keywordRules.isLocked, true));
  },

  async checkKeywordViolation(content: string): Promise<any | null> {
    const rules = await this.getLockedKeywords();
    if (!rules.length) return null;

    for (const rule of rules) {
      const text = rule.caseSensitive ? content : content.toLowerCase();
      const keyword = rule.caseSensitive ? rule.keyword : rule.keyword.toLowerCase();

      let matched = false;
      if (rule.matchType === "exact") {
        const regex = new RegExp(`\\b${keyword}\\b`, rule.caseSensitive ? "g" : "gi");
        matched = regex.test(text);
      } else if (rule.matchType === "partial") {
        matched = text.includes(keyword);
      } else if (rule.matchType === "regex") {
        try {
          const regex = new RegExp(rule.keyword, rule.caseSensitive ? "g" : "gi");
          matched = regex.test(content);
        } catch {
          continue;
        }
      }

      if (matched) {
        return {
          keyword: rule.keyword,
          action: rule.action,
          severity: rule.severity,
          reason: rule.lockReason,
          matchType: rule.matchType,
        };
      }
    }
    return null;
  },

  async deleteKeywordRule(keyword: string) {
    await db.delete(keywordRules).where(eq(keywordRules.keyword, keyword));
  },

  async setUserAccess(userId: number, endpoint: string, allowed: boolean, requiresAdmin: boolean = false, requiresSovereign: boolean = false) {
    const [rule] = await db.insert(accessControl).values({
      userId,
      endpoint,
      allowed,
      requiresAdmin,
      requiresSovereign,
    }).onConflictDoUpdate({
      target: accessControl.userId,
      set: { allowed, requiresAdmin, requiresSovereign }
    }).returning();
    return rule;
  },

  async lockAllUserAccess() {
    const allUsers = await this.getAllUsers();
    for (const user of allUsers) {
      if (user.email !== "EID_Founder@outlook.com") {
        await db.delete(accessControl).where(eq(accessControl.userId, user.id));
        await db.insert(accessControl).values({
          userId: user.id,
          endpoint: "/api/*",
          allowed: false,
          requiresAdmin: false,
          requiresSovereign: true,
        });
      }
    }
    return { locked: true, usersLocked: allUsers.length - 1 };
  },

  async unlockAllUserAccess() {
    await db.delete(accessControl);
    return { unlocked: true };
  },

  async getPlatformLockdown() {
    const [lockdown] = await db.select().from(platformLockdown).limit(1);
    return lockdown;
  },

  async setPlatformLockdown(isActive: boolean, maintenanceMode: boolean = false, allowedIpAddresses?: string, allowedDevices?: string, restrictedPaths?: string) {
    const existing = await this.getPlatformLockdown();
    if (existing) {
      const [updated] = await db.update(platformLockdown)
        .set({ isActive, maintenanceMode, allowedIpAddresses, allowedDevices, restrictedPaths, updatedAt: new Date() })
        .where(eq(platformLockdown.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(platformLockdown).values({
        isActive,
        maintenanceMode,
        allowedIpAddresses,
        allowedDevices,
        restrictedPaths,
      }).returning();
      return created;
    }
  },

  async checkUserAccess(userId: number, endpoint: string): Promise<boolean> {
    const [rule] = await db.select().from(accessControl)
      .where(and(eq(accessControl.userId, userId), eq(accessControl.endpoint, endpoint)));
    return rule ? rule.allowed : true;
  },

  async enforceSingleSovereign(sovereignEmail: string) {
    const allUsers = await this.getAllUsers();
    for (const user of allUsers) {
      if (user.email !== sovereignEmail && user.isAdmin) {
        await this.setUserAdmin(user.id, false);
      }
    }
    const sovereignUser = allUsers.find(u => u.email === sovereignEmail);
    if (sovereignUser && !sovereignUser.isAdmin) {
      await this.setUserAdmin(sovereignUser.id, true);
    }
    return { enforced: true, sovereign: sovereignEmail };
  },

  async getSovereignStatus() {
    const admins = await db.select().from(users).where(eq(users.isAdmin, true));
    return {
      sovereignCount: admins.length,
      sovereigns: admins.map(u => ({ id: u.id, email: u.email, username: u.username })),
      isSingleSovereign: admins.length === 1,
    };
  },

  async blockAllNonSovereignAccess(sovereignEmail: string) {
    const allUsers = await this.getAllUsers();
    let blockedCount = 0;
    
    for (const user of allUsers) {
      if (user.email !== sovereignEmail) {
        await db.delete(accessControl).where(eq(accessControl.userId, user.id));
        await db.insert(accessControl).values({
          userId: user.id,
          endpoint: "/api/*",
          allowed: false,
          requiresAdmin: false,
          requiresSovereign: true,
        });
        
        await db.update(users)
          .set({ isAdmin: false, role: "user", permissions: {} })
          .where(eq(users.id, user.id));
        
        blockedCount++;
      }
    }
    
    return { 
      blocked: true, 
      blockedCount, 
      sovereign: sovereignEmail,
      message: `Blocked ${blockedCount} user(s) from all access`
    };
  },

  async enforceAbsoluteSovereignty(sovereignEmail: string, sovereignId: number) {
    const allUsers = await this.getAllUsers();
    let enforcedCount = 0;
    
    for (const user of allUsers) {
      if (user.email !== sovereignEmail) {
        await db.update(users)
          .set({ isAdmin: false, role: "blocked", permissions: { blocked: true } })
          .where(eq(users.id, user.id));
        enforcedCount++;
      } else {
        await db.update(users)
          .set({ isAdmin: true, role: "admin", permissions: { sovereign: true, admin: true } })
          .where(eq(users.id, user.id));
      }
    }
    
    return {
      enforced: true,
      sovereignEmail,
      sovereignId,
      blockedCount: enforcedCount,
      message: `Absolute sovereignty enforced for ${sovereignEmail} (ID: ${sovereignId}). All others blocked.`
    };
  },
};

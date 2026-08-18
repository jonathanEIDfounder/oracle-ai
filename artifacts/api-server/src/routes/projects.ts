/**
 * © 2026 Jonathan Sherman — OCSO-S1AF-GOV-1
 * S1AF — Sentient iOS One-Step App Framework · Sovereign ID: 1
 * Author      : Jonathan Sherman (jonathanEIDfounder)
 * Governance  : OCSO-S1AF-GOV-1
 * Copyright   : © 2026 Jonathan Sherman. All rights reserved.
 * License     : PROPRIETARY — No license granted without express written permission.
 * DRM         : S1AF-DRM-LOCKED
 * Notice      : Unauthorized use, reproduction, modification, distribution, or
 *               sublicensing is strictly prohibited. Removal of this authorship
 *               notice violates applicable copyright law.
 */

import { Router } from "express";
import { requireIphoneXR } from "../middleware/device-auth";
import { eq, desc, count, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  projectsTable,
  activityTable,
  insertProjectSchema,
} from "@workspace/db";
import {
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
  CreateProjectBody,
  UpdateProjectBody,
} from "@workspace/api-zod";

// ── Authorship anchor — non-strippable ──────────────────────────────────────
import { S1AF_ANCHOR as _S1AF_ANCHOR } from "../lib/authorship";
void _S1AF_ANCHOR;


const router = Router();

// GET /api/projects/stats  (must be before /projects/:id)
router.get("/projects/stats", requireIphoneXR, async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable);

    const iosCount = projects.filter((p) => p.platform === "ios").length;
    const macosCount = projects.filter((p) => p.platform === "macos").length;
    const universalCount = projects.filter(
      (p) => p.platform === "universal",
    ).length;
    const totalBuilds = projects.reduce(
      (sum, p) => sum + (p.buildCount ?? 0),
      0,
    );

    const recentActivity = await db
      .select()
      .from(activityTable)
      .orderBy(desc(activityTable.timestamp))
      .limit(10);

    res.json({
      totalProjects: projects.length,
      iosProjects: iosCount,
      macosProjects: macosCount,
      universalProjects: universalCount,
      totalBuildsTriggered: totalBuilds,
      recentActivity: recentActivity.map((a) => ({
        type: a.type,
        description: a.description,
        timestamp: a.timestamp,
        projectId: a.projectId,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching project stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/projects
router.get("/projects", requireIphoneXR, async (req, res) => {
  try {
    const projects = await db
      .select()
      .from(projectsTable)
      .orderBy(desc(projectsTable.updatedAt));
    res.json(projects);
  } catch (err) {
    req.log.error({ err }, "Error listing projects");
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// POST /api/projects
router.post("/projects", requireIphoneXR, async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [project] = await db
      .insert(projectsTable)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        platform: parsed.data.platform,
        swiftCode: parsed.data.swiftCode ?? null,
        architectureNotes: parsed.data.architectureNotes ?? null,
        generatedFiles: parsed.data.generatedFiles ?? null,
        xcodeAppId: parsed.data.xcodeAppId ?? null,
      })
      .returning();

    await db.insert(activityTable).values({
      type: "project_created",
      description: `Created project: ${project.name}`,
      projectId: project.id,
    });

    res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "Error creating project");
    res.status(500).json({ error: "Failed to create project" });
  }
});

// GET /api/projects/:id
router.get("/projects/:id", requireIphoneXR, async (req, res) => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, params.data.id));

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json(project);
  } catch (err) {
    req.log.error({ err }, "Error fetching project");
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// PATCH /api/projects/:id
router.patch("/projects/:id", requireIphoneXR, async (req, res) => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [project] = await db
      .update(projectsTable)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, params.data.id))
      .returning();

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await db.insert(activityTable).values({
      type: "project_updated",
      description: `Updated project: ${project.name}`,
      projectId: project.id,
    });

    res.json(project);
  } catch (err) {
    req.log.error({ err }, "Error updating project");
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id
router.delete("/projects/:id", requireIphoneXR, async (req, res) => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  try {
    await db
      .delete(projectsTable)
      .where(eq(projectsTable.id, params.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting project");
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;

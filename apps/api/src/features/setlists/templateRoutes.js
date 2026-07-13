/**
 * Set list template routes (mounted at /setlists/templates, BEFORE the main
 * setlist router so "/templates" never matches the "/:id" route).
 *
 *   GET    /api/setlists/templates          — org templates
 *   POST   /api/setlists/templates          — create (setlists:edit)
 *   PUT    /api/setlists/templates/:id      — update (setlists:edit)
 *   DELETE /api/setlists/templates/:id      — delete (setlists:edit)
 *   POST   /api/setlists/templates/:id/apply — create a set list with labelled empty slots
 */
import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../../db.js";
import { setlistTemplates, setlists, setlistSongs } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { logActivity } from "../activity/service.js";

export const setlistTemplateRoutes = Router();

setlistTemplateRoutes.use(auth, orgContext, requireOrg);

/** structure: ordered array of { label } — anything else is rejected. */
function sanitizeStructure(structure) {
  if (!Array.isArray(structure)) return null;
  const slots = structure
    .filter((slot) => slot && typeof slot === "object" && typeof slot.label === "string" && slot.label.trim())
    .map((slot) => ({ label: slot.label.trim() }));
  return slots.length > 0 ? slots : null;
}

async function loadTemplateInOrg(id, orgId) {
  const [template] = await db
    .select()
    .from(setlistTemplates)
    .where(and(eq(setlistTemplates.id, id), eq(setlistTemplates.organizationId, orgId)))
    .limit(1);
  return template ?? null;
}

// ── GET / — list templates ───────────────────────────────────
setlistTemplateRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const templates = await db
      .select()
      .from(setlistTemplates)
      .where(eq(setlistTemplates.organizationId, req.org.id))
      .orderBy(asc(setlistTemplates.title));

    res.json({ templates });
  }),
);

// ── POST / — create template ─────────────────────────────────
setlistTemplateRoutes.post(
  "/",
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title || "").trim();
    if (!title) throw createError(400, "Template title is required");

    const structure = sanitizeStructure(req.body?.structure);
    if (!structure) throw createError(400, "structure must be a non-empty array of { label } slots");

    const [template] = await db
      .insert(setlistTemplates)
      .values({
        title,
        description: req.body?.description || null,
        structure,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    await logActivity(req, "template.created", { type: "template", id: template.id, label: template.title });
    res.status(201).json({ template });
  }),
);

// ── PUT /:id — update template ───────────────────────────────
setlistTemplateRoutes.put(
  "/:id",
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadTemplateInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Template not found");

    const { title, description, structure } = req.body ?? {};
    if (title !== undefined && !String(title).trim()) {
      throw createError(400, "Template title cannot be empty");
    }
    const sanitized = structure !== undefined ? sanitizeStructure(structure) : undefined;
    if (structure !== undefined && !sanitized) {
      throw createError(400, "structure must be a non-empty array of { label } slots");
    }

    const [template] = await db
      .update(setlistTemplates)
      .set({
        ...(title !== undefined && { title: String(title).trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(sanitized !== undefined && { structure: sanitized }),
        updatedAt: new Date(),
      })
      .where(eq(setlistTemplates.id, req.params.id))
      .returning();

    res.json({ template });
  }),
);

// ── DELETE /:id — delete template ────────────────────────────
setlistTemplateRoutes.delete(
  "/:id",
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const existing = await loadTemplateInOrg(req.params.id, req.org.id);
    if (!existing) throw createError(404, "Template not found");

    await db.delete(setlistTemplates).where(eq(setlistTemplates.id, req.params.id));
    res.json({ message: "Template deleted" });
  }),
);

// ── POST /:id/apply — create a set list from the template ────
setlistTemplateRoutes.post(
  "/:id/apply",
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const template = await loadTemplateInOrg(req.params.id, req.org.id);
    if (!template) throw createError(404, "Template not found");

    const name = String(req.body?.name || "").trim() || template.title;
    const slots = Array.isArray(template.structure) ? template.structure : [];

    // Both inserts must land together — a partial failure would otherwise
    // leave an orphaned, slot-less setlist behind.
    const setlist = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(setlists)
        .values({
          name,
          notes: template.description || null,
          organizationId: req.org.id,
          createdBy: req.user.id,
        })
        .returning();

      if (slots.length > 0) {
        await tx.insert(setlistSongs).values(
          slots.map((slot, index) => ({
            setlistId: created.id,
            songId: null,
            slotLabel: slot.label,
            position: index + 1,
          })),
        );
      }

      return created;
    });

    await logActivity(req, "setlist.created_from_template", { type: "setlist", id: setlist.id, label: name });
    res.status(201).json({ setlist, slotCount: slots.length });
  }),
);

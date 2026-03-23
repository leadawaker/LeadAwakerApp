import type { Express } from "express";
import { storage } from "../storage";
import { requireAgency } from "../auth";
import {
  tasks,
  insertTaskSchema,
  insertTaskSubtaskSchema,
  insertTaskCategorySchema,
} from "@shared/schema";
import { db } from "../db";
import { createAndDispatchNotification } from "../notification-dispatcher";
import { handleZodError, wrapAsync } from "./_helpers";
import { eq, count, and, gte, lte, lt, ne, isNotNull, desc, sql, type SQL } from "drizzle-orm";
import { ilike } from "drizzle-orm";

export function registerTasksRoutes(app: Express): void {
  // ─── Tasks ─────────────────────────────────────────────────────────

  app.get("/api/tasks", requireAgency, wrapAsync(async (req, res) => {
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const categoryIdParam = req.query.categoryId as string | undefined;
    const parentTaskIdParam = req.query.parentTaskId as string | undefined;
    const searchParam = req.query.search as string | undefined;

    if (searchParam) {
      const rows = await db.select().from(tasks).where(
        ilike(tasks.title, `%${searchParam}%`)
      ).orderBy(desc(tasks.createdAt));
      return res.json(rows);
    }

    const hasFilters = accountId !== undefined || categoryIdParam !== undefined || parentTaskIdParam !== undefined;

    if (hasFilters) {
      const filters: { accountId?: number; categoryId?: number | null; parentTaskId?: number | null } = {};
      if (accountId !== undefined) filters.accountId = accountId;
      if (categoryIdParam !== undefined) {
        filters.categoryId = categoryIdParam === "null" ? null : Number(categoryIdParam);
      }
      if (parentTaskIdParam !== undefined) {
        filters.parentTaskId = parentTaskIdParam === "null" ? null : Number(parentTaskIdParam);
      }
      const data = await storage.getTasksFiltered(filters);
      return res.json(data);
    }

    const data = await storage.getTasks();
    res.json(data);
  }));

  // ─── Task Stats (completion over time) ───────────────────────────
  app.get("/api/tasks/stats", requireAgency, wrapAsync(async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const conditions: SQL[] = [
      isNotNull(tasks.completedAt),
      eq(tasks.status, "done"),
    ];

    if (categoryId !== undefined) {
      conditions.push(eq(tasks.categoryId, categoryId));
    }
    if (startDate !== undefined) {
      conditions.push(gte(tasks.completedAt, startDate));
    }
    if (endDate !== undefined) {
      conditions.push(lte(tasks.completedAt, endDate));
    }

    const dateCol = sql<string>`DATE(${tasks.completedAt})`.as("date");
    const rows = await db
      .select({
        date: dateCol,
        completedCount: count(),
      })
      .from(tasks)
      .where(and(...conditions))
      .groupBy(dateCol)
      .orderBy(dateCol);

    res.json(rows);
  }));

  app.post("/api/tasks", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const task = await storage.createTask(parsed.data);

    // Notification: task_assigned — when a task is created with an assignee
    if (task.assignedToUserId) {
      try {
        await createAndDispatchNotification({
          type: "task_assigned",
          title: `Task assigned: ${task.title}`,
          body: task.dueDate
            ? `Due ${new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : null,
          userId: task.assignedToUserId,
          accountId: task.accountsId ?? null,
          read: false,
          link: "/tasks",
          leadId: null,
        });
      } catch (notifErr) {
        console.error("[notifications] Failed to dispatch task_assigned:", notifErr);
      }
    }

    res.status(201).json(task);
  }));

  app.patch("/api/tasks/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const existingTask = await storage.getTaskById(id);
    const parsed = insertTaskSchema.partial().safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const updated = await storage.updateTask(id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Task not found" });

    // Notification: task_assigned — when assignee changes to a new user
    if (
      updated.assignedToUserId &&
      updated.assignedToUserId !== existingTask?.assignedToUserId
    ) {
      try {
        await createAndDispatchNotification({
          type: "task_assigned",
          title: `Task assigned: ${updated.title}`,
          body: updated.dueDate
            ? `Due ${new Date(updated.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : null,
          userId: updated.assignedToUserId,
          accountId: updated.accountsId ?? null,
          read: false,
          link: "/tasks",
          leadId: null,
        });
      } catch (notifErr) {
        console.error("[notifications] Failed to dispatch task_assigned:", notifErr);
      }
    }

    res.json(updated);
  }));

  app.delete("/api/tasks/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await storage.deleteTask(id);
    if (!deleted) return res.status(404).json({ error: "Task not found" });
    res.json({ success: true });
  }));

  // ─── Task Subtasks ──────────────────────────────────────────────────

  app.get("/api/tasks/:id/subtasks", requireAgency, wrapAsync(async (req, res) => {
    const taskId = Number(req.params.id);
    const task = await storage.getTaskById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    const subtasks = await storage.getSubtasksByTaskId(taskId);
    res.json(subtasks);
  }));

  app.post("/api/tasks/:id/subtasks", requireAgency, wrapAsync(async (req, res) => {
    const taskId = Number(req.params.id);
    const task = await storage.getTaskById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    let sortOrder = req.body.sortOrder;
    if (sortOrder == null) {
      const existing = await storage.getSubtasksByTaskId(taskId);
      const maxSort = existing.reduce((max, s) => Math.max(max, s.sortOrder ?? 0), 0);
      sortOrder = maxSort + 1;
    }
    const parsed = insertTaskSubtaskSchema.safeParse({ ...req.body, taskId, sortOrder });
    if (!parsed.success) return handleZodError(res, parsed.error);
    const subtask = await storage.createSubtask(parsed.data);
    res.status(201).json(subtask);
  }));

  app.patch("/api/tasks/:id/subtasks/reorder", requireAgency, wrapAsync(async (req, res) => {
    const taskId = Number(req.params.id);
    const task = await storage.getTaskById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    const { subtaskIds } = req.body;
    if (!Array.isArray(subtaskIds) || subtaskIds.length === 0) {
      return res.status(422).json({ error: "subtaskIds must be a non-empty array of subtask IDs" });
    }
    if (!subtaskIds.every((id: any) => typeof id === "number" && Number.isInteger(id))) {
      return res.status(422).json({ error: "subtaskIds must contain only integer IDs" });
    }
    const updated = await storage.reorderSubtasks(taskId, subtaskIds);
    res.json(updated);
  }));

  app.patch("/api/subtasks/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = insertTaskSubtaskSchema.partial().safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const updated = await storage.updateSubtask(id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Subtask not found" });
    res.json(updated);
  }));

  app.delete("/api/subtasks/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await storage.deleteSubtask(id);
    if (!deleted) return res.status(404).json({ error: "Subtask not found" });
    res.json({ success: true });
  }));

  app.get("/api/subtask-counts", requireAgency, wrapAsync(async (_req, res) => {
    const counts = await storage.getSubtaskCounts();
    res.json(counts);
  }));

  // ─── Task Categories ────────────────────────────────────────────────

  app.get("/api/task-categories", requireAgency, wrapAsync(async (_req, res) => {
    const data = await storage.getTaskCategories();
    res.json(data);
  }));

  app.post("/api/task-categories", requireAgency, wrapAsync(async (req, res) => {
    const { name, icon, color } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(422).json({ message: "Validation error", errors: [{ path: "name", message: "Name is required" }] });
    }
    const existing = await storage.getTaskCategories();
    const maxSort = existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), 0);
    const category = await storage.createTaskCategory({
      name: name.trim(),
      icon: icon || null,
      color: color || null,
      sortOrder: maxSort + 1,
    });
    res.status(201).json(category);
  }));

  app.patch("/api/task-categories/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const parsed = insertTaskCategorySchema.partial().safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const updated = await storage.updateTaskCategory(id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Category not found" });
    res.json(updated);
  }));

  app.delete("/api/task-categories/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const category = await storage.getTaskCategoryById(id);
    if (!category) return res.status(404).json({ error: "Category not found" });
    await db.update(tasks).set({ categoryId: null }).where(eq(tasks.categoryId, id));
    await storage.deleteTaskCategory(id);
    res.json({ success: true });
  }));
}

// Background task notification timers — called once at startup from routes/index.ts
export function startTaskNotifiers(): void {
  const dbInstance = db;
  const notify = createAndDispatchNotification;
  const stor = storage;

  // ── Task due soon notifier (every 30 min) ──────────────────────────────
  const taskDueSoonNotified = new Set<number>();

  async function checkTasksDueSoon() {
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const dueSoonTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            gte(tasks.dueDate, now),
            lte(tasks.dueDate, in24h),
            ne(tasks.status, "done"),
            ne(tasks.status, "cancelled"),
            isNotNull(tasks.assignedToUserId),
          ),
        );

      for (const task of dueSoonTasks) {
        if (taskDueSoonNotified.has(task.id)) continue;
        taskDueSoonNotified.add(task.id);

        await createAndDispatchNotification({
          type: "task_due_soon",
          title: `Task due soon: ${task.title}`,
          body: task.dueDate
            ? `Due ${new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
            : null,
          userId: task.assignedToUserId!,
          accountId: task.accountsId ?? null,
          read: false,
          link: "/tasks",
          leadId: task.leadsId ?? null,
        });
      }
    } catch (err) {
      console.error("[TaskDueSoonNotifier]", err);
    }
  }

  setInterval(checkTasksDueSoon, 30 * 60 * 1000);

  // ── Task overdue notifier (every 30 min, max 1 notification per task per day) ─
  const taskOverdueLastNotified = new Map<number, number>();

  async function checkTasksOverdue() {
    try {
      const now = new Date();
      const oneDayMs = 24 * 60 * 60 * 1000;

      const overdueTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            lt(tasks.dueDate, now),
            ne(tasks.status, "done"),
            ne(tasks.status, "cancelled"),
            isNotNull(tasks.assignedToUserId),
          ),
        );

      for (const task of overdueTasks) {
        const lastNotified = taskOverdueLastNotified.get(task.id);
        if (lastNotified && now.getTime() - lastNotified < oneDayMs) continue;
        taskOverdueLastNotified.set(task.id, now.getTime());

        await createAndDispatchNotification({
          type: "task_overdue",
          title: `Task overdue: ${task.title}`,
          body: task.dueDate
            ? `Was due ${new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : null,
          userId: task.assignedToUserId!,
          accountId: task.accountsId ?? null,
          read: false,
          link: "/tasks",
          leadId: task.leadsId ?? null,
        });
      }
    } catch (err) {
      console.error("[TaskOverdueNotifier]", err);
    }
  }

  setInterval(checkTasksOverdue, 30 * 60 * 1000);
}

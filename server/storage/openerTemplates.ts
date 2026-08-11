import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { openerTemplates, type OpenerTemplateRow } from "@shared/schema";

export interface OpenerTemplateEdit {
  titleEn?: string;
  titleNl?: string;
  bodyEn?: string;
  bodyNl?: string;
  type?: OpenerTemplateType;
}

/** Which conversation type an archetype is written for. Same tokens the engine
 *  branches on; "both" means the copy commits to neither. */
export const OPENER_TEMPLATE_TYPES = ["scoping", "decision", "both"] as const;
export type OpenerTemplateType = (typeof OPENER_TEMPLATE_TYPES)[number];

export function isOpenerTemplateType(v: unknown): v is OpenerTemplateType {
  return typeof v === "string" && (OPENER_TEMPLATE_TYPES as readonly string[]).includes(v);
}

export const openerTemplatesStorage = {
  async listOpenerTemplates(): Promise<OpenerTemplateRow[]> {
    return db.select().from(openerTemplates).orderBy(asc(openerTemplates.sortOrder));
  },

  async updateOpenerTemplate(id: string, data: OpenerTemplateEdit): Promise<OpenerTemplateRow | undefined> {
    const [row] = await db
      .update(openerTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(openerTemplates.id, id))
      .returning();
    return row;
  },
};

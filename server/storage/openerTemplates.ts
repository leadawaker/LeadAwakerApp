import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { openerTemplates, type OpenerTemplateRow } from "@shared/schema";

export interface OpenerTemplateEdit {
  titleEn?: string;
  titleNl?: string;
  bodyEn?: string;
  bodyNl?: string;
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

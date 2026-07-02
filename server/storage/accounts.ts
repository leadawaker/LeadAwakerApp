import { eq, ne, desc, asc, count, sum, SQL, inArray, and, or, ilike, gte, lt, isNotNull, isNull, getTableColumns, sql } from "drizzle-orm";
import { PgTableWithColumns } from "drizzle-orm/pg-core";
import { db, pool } from "../db";
import {
  accounts,
  prospects,
  campaigns,
  leads,
  interactions,
  tags,
  leadsTags,
  automationLogs,
  users,
  promptLibrary,
  promptVersions,
  leadScoreHistory,
  campaignMetricsHistory,
  invoices,
  contracts,
  expenses,
  notifications,
  accountCommunicationProfile,
  type AccountCommunicationProfile,
  type InsertAccountCommunicationProfile,
  type Accounts,
  type InsertAccounts,
  type Prospects,
  type InsertProspects,
  insertProspectsSchema,
  type Campaigns,
  type InsertCampaigns,
  type Leads,
  type InsertLeads,
  type Interactions,
  type InsertInteractions,
  type Tags,
  type InsertTags,
  type Leads_Tags,
  type InsertLeads_Tags,
  type Automation_Logs,
  type Users,
  type InsertUsers,
  type Prompt_Library,
  type InsertPrompt_Library,
  type Prompt_Version,
  type InsertPrompt_Version,
  type Lead_Score_History,
  type Campaign_Metrics_History,
  type Invoices,
  type InsertInvoices,
  type Contracts,
  type InsertContracts,
  type Expenses,
  type InsertExpenses,
  type Notifications,
  type InsertNotifications,
  supportSessions,
  supportMessages,
  type SupportSession,
  type InsertSupportSession,
  type SupportMessage,
  type InsertSupportMessage,
  tasks,
  type Task,
  type InsertTask,
  insertTaskSchema,
  aiAgents,
  aiSessions,
  aiMessages,
  aiFiles,
  type AiAgent,
  type InsertAiAgent,
  type AiSession,
  type InsertAiSession,
  type AiMessage,
  type InsertAiMessage,
  type AiFile,
  type InsertAiFile,
  notificationPreferences,
  pushSubscriptions,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type PushSubscriptionRow,
  type InsertPushSubscription,
  taskSubtasks,
  type TaskSubtask,
  type InsertTaskSubtask,
  taskCategories,
  type TaskCategory,
  type InsertTaskCategory,
  taskComments,
  taskAttachments,
  taskActivity,
  type TaskComment,
  type InsertTaskComment,
  type TaskAttachment,
  type InsertTaskAttachment,
  type TaskActivity,
  type InsertTaskActivity,
  outreachTemplates,
  type OutreachTemplate,
  type InsertOutreachTemplate,
  gmailSyncState,
  type GmailSyncState,
  type InsertGmailSyncState,
  nicheVocabulary,
  type NicheVocabulary,
  type NicheWordGroup,
  type NicheWordGroups,
  EMPTY_NICHE_GROUPS,
} from "@shared/schema";

import type { NotificationItem, ProspectsListParams } from "./types";

// ─── Niche vocabulary language helpers ───────────────────────────────────────
type NicheLang = "en" | "nl";
type NicheTemplate = { nl: string; en: string };
type NicheRowBoth = {
  niche: string;
  nl: NicheWordGroups;
  en: NicheWordGroups;
  companyNameTemplate: NicheTemplate;
  descriptionTemplate: NicheTemplate;
  kbTemplate: NicheTemplate;
  // Per-niche example packs for prompt 93 v8.7+ (question bank, bad examples,
  // objection phrasings, scenario playbook). Same {nl,en} shape + persistence
  // path as the templates above.
  questionBank: NicheTemplate;
  badExamples: NicheTemplate;
  objectionExamples: NicheTemplate;
  scenarioExamples: NicheTemplate;
};

const EMPTY_TEMPLATE: NicheTemplate = { nl: "", en: "" };

function rowToBoth(r: NicheVocabulary): Omit<NicheRowBoth, "niche"> {
  return {
    nl: {
      projectTerm: r.projectTerms ?? [],
      proposalTerm: r.proposalTerms ?? [],
      decisionTerm: r.decisionTerms ?? [],
      advisorTerm: r.advisorTerms ?? [],
      visitTerm: r.visitTerms ?? [],
    },
    en: {
      projectTerm: r.projectTermsEn ?? [],
      proposalTerm: r.proposalTermsEn ?? [],
      decisionTerm: r.decisionTermsEn ?? [],
      advisorTerm: r.advisorTermsEn ?? [],
      visitTerm: r.visitTermsEn ?? [],
    },
    companyNameTemplate: (r.companyNameTemplate as NicheTemplate | null) ?? EMPTY_TEMPLATE,
    descriptionTemplate: (r.descriptionTemplate as NicheTemplate | null) ?? EMPTY_TEMPLATE,
    kbTemplate: (r.kbTemplate as NicheTemplate | null) ?? EMPTY_TEMPLATE,
    questionBank: (r.questionBank as NicheTemplate | null) ?? EMPTY_TEMPLATE,
    badExamples: (r.badExamples as NicheTemplate | null) ?? EMPTY_TEMPLATE,
    objectionExamples: (r.objectionExamples as NicheTemplate | null) ?? EMPTY_TEMPLATE,
    scenarioExamples: (r.scenarioExamples as NicheTemplate | null) ?? EMPTY_TEMPLATE,
  };
}

export const accountsStorage = {
  // ─── Accounts ───────────────────────────────────────────────────────

  async getAccounts(): Promise<Accounts[]> {
    const { voiceFileData, ...cols } = getTableColumns(accounts);
    return db.select(cols).from(accounts) as any;
  },

  async getAccountById(id: number): Promise<Accounts | undefined> {
    const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
    return row;
  },

  async createAccount(data: InsertAccounts): Promise<Accounts> {
    const [row] = await db.insert(accounts).values(data as any).returning();
    return row;
  },

  async updateAccount(id: number, data: Partial<InsertAccounts>): Promise<Accounts | undefined> {
    const [row] = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning();
    return row;
  },

  async deleteAccount(id: number): Promise<boolean> {
    const result = await db.delete(accounts).where(eq(accounts.id, id)).returning();
    return result.length > 0;
  },

  // ─── Communication Profile (onboarding wizard) ──────────────────────

  async getCommunicationProfile(accountId: number): Promise<AccountCommunicationProfile | undefined> {
    const [row] = await db.select().from(accountCommunicationProfile)
      .where(eq(accountCommunicationProfile.accountsId, accountId));
    return row;
  },

  async upsertCommunicationProfile(
    accountId: number,
    data: Partial<InsertAccountCommunicationProfile>,
  ): Promise<AccountCommunicationProfile> {
    const existing = await this.getCommunicationProfile(accountId);
    const now = new Date();
    const completedAt = data.status === "completed" ? now : (data.completedAt ?? existing?.completedAt ?? null);
    const payload = { ...data, accountsId: accountId, updatedAt: now, completedAt } as any;
    if (existing) {
      const [row] = await db.update(accountCommunicationProfile)
        .set(payload).where(eq(accountCommunicationProfile.id, existing.id)).returning();
      return row;
    }
    const [row] = await db.insert(accountCommunicationProfile)
      .values({ ...payload, createdAt: now }).returning();
    return row;
  },

  // ─── Niche Vocabulary ───────────────────────────────────────────────

  // Resolve a single niche's terms for ONE language (used by the preview API and
  // for engine parity). English falls back to the Dutch list per-group when the
  // English list is empty, then the whole thing falls back to __default__.
  async getNicheVocabulary(niche: string, lang: NicheLang = "nl"): Promise<NicheWordGroups> {
    const [row] = await db.select().from(nicheVocabulary)
      .where(eq(nicheVocabulary.niche, niche));
    const [def] = row ? [row] : await db.select().from(nicheVocabulary)
      .where(eq(nicheVocabulary.niche, "__default__"));
    if (!def) return { ...EMPTY_NICHE_GROUPS };
    const both = rowToBoth(def);
    if (lang === "en") {
      const out = { ...EMPTY_NICHE_GROUPS };
      for (const g of Object.keys(out) as NicheWordGroup[]) {
        out[g] = both.en[g].length ? both.en[g] : both.nl[g];
      }
      return out;
    }
    return both.nl;
  },

  // Every saved niche row (for the vocabulary management table), with BOTH
  // languages so the UI can toggle EN/NL without refetching.
  async listNicheVocabularies(): Promise<Array<NicheRowBoth>> {
    const rows = await db.select().from(nicheVocabulary).orderBy(nicheVocabulary.niche);
    return rows.map((r) => ({ niche: r.niche, ...rowToBoth(r) }));
  },

  // Niche names only (no vocabulary payload) — powers the campaign settings
  // niche picker, which any campaign editor (not just agency) can load.
  // Excludes __default__ since it is a fallback row, not a selectable niche.
  async listNicheNames(): Promise<string[]> {
    const rows = await db.select({ niche: nicheVocabulary.niche }).from(nicheVocabulary)
      .where(ne(nicheVocabulary.niche, "__default__"))
      .orderBy(nicheVocabulary.niche);
    return rows.map((r) => r.niche);
  },

  // Upsert ALL groups for BOTH languages of a niche in one shot. De-dupes/trims.
  async setNicheVocabulary(niche: string, both: { nl: NicheWordGroups; en: NicheWordGroups }): Promise<{ nl: NicheWordGroups; en: NicheWordGroups }> {
    const norm = (arr: string[]) => Array.from(new Set((arr ?? []).map((w) => w.trim()).filter(Boolean)));
    const nl: NicheWordGroups = {
      projectTerm: norm(both.nl.projectTerm), proposalTerm: norm(both.nl.proposalTerm),
      decisionTerm: norm(both.nl.decisionTerm), advisorTerm: norm(both.nl.advisorTerm),
      visitTerm: norm(both.nl.visitTerm),
    };
    const en: NicheWordGroups = {
      projectTerm: norm(both.en.projectTerm), proposalTerm: norm(both.en.proposalTerm),
      decisionTerm: norm(both.en.decisionTerm), advisorTerm: norm(both.en.advisorTerm),
      visitTerm: norm(both.en.visitTerm),
    };
    const j = (v: string[]) => `${JSON.stringify(v)}`;
    await db.execute(sql`
      INSERT INTO "p2mxx34fvbf3ll6"."Niche_Vocabulary"
        (niche, project_terms, proposal_terms, decision_terms, advisor_terms, visit_terms,
         project_terms_en, proposal_terms_en, decision_terms_en, advisor_terms_en, visit_terms_en,
         created_at, updated_at)
      VALUES (
        ${niche},
        ${j(nl.projectTerm)}::jsonb, ${j(nl.proposalTerm)}::jsonb, ${j(nl.decisionTerm)}::jsonb, ${j(nl.advisorTerm)}::jsonb, ${j(nl.visitTerm)}::jsonb,
        ${j(en.projectTerm)}::jsonb, ${j(en.proposalTerm)}::jsonb, ${j(en.decisionTerm)}::jsonb, ${j(en.advisorTerm)}::jsonb, ${j(en.visitTerm)}::jsonb,
        NOW(), NOW()
      )
      ON CONFLICT (niche) DO UPDATE SET
        project_terms  = ${j(nl.projectTerm)}::jsonb,
        proposal_terms = ${j(nl.proposalTerm)}::jsonb,
        decision_terms = ${j(nl.decisionTerm)}::jsonb,
        advisor_terms  = ${j(nl.advisorTerm)}::jsonb,
        visit_terms    = ${j(nl.visitTerm)}::jsonb,
        project_terms_en  = ${j(en.projectTerm)}::jsonb,
        proposal_terms_en = ${j(en.proposalTerm)}::jsonb,
        decision_terms_en = ${j(en.decisionTerm)}::jsonb,
        advisor_terms_en  = ${j(en.advisorTerm)}::jsonb,
        visit_terms_en    = ${j(en.visitTerm)}::jsonb,
        updated_at = NOW()
    `);
    return { nl, en };
  },

  // Read both languages for a niche, seeding from __default__ when no row exists
  // yet, so a per-word edit never drops the fallback vocabulary the user saw.
  async getNicheVocabularyBoth(niche: string): Promise<Omit<NicheRowBoth, "niche">> {
    const [row] = await db.select().from(nicheVocabulary)
      .where(eq(nicheVocabulary.niche, niche));
    if (row) return rowToBoth(row);
    const [def] = await db.select().from(nicheVocabulary)
      .where(eq(nicheVocabulary.niche, "__default__"));
    return def ? rowToBoth(def) : {
      nl: { ...EMPTY_NICHE_GROUPS }, en: { ...EMPTY_NICHE_GROUPS },
      companyNameTemplate: EMPTY_TEMPLATE, descriptionTemplate: EMPTY_TEMPLATE, kbTemplate: EMPTY_TEMPLATE,
      questionBank: EMPTY_TEMPLATE, badExamples: EMPTY_TEMPLATE, objectionExamples: EMPTY_TEMPLATE, scenarioExamples: EMPTY_TEMPLATE,
    };
  },

  // Patch the business-profile text templates + example packs for a niche.
  async setNicheTemplate(
    niche: string,
    templates: {
      companyNameTemplate?: NicheTemplate; descriptionTemplate?: NicheTemplate; kbTemplate?: NicheTemplate;
      questionBank?: NicheTemplate; badExamples?: NicheTemplate; objectionExamples?: NicheTemplate; scenarioExamples?: NicheTemplate;
    },
  ): Promise<NicheTemplate[]> {
    const j = (v: NicheTemplate) => JSON.stringify(v);
    const cn = templates.companyNameTemplate;
    const desc = templates.descriptionTemplate;
    const kb = templates.kbTemplate;
    const qb = templates.questionBank;
    const be = templates.badExamples;
    const oe = templates.objectionExamples;
    const se = templates.scenarioExamples;
    await db.execute(sql`
      UPDATE "p2mxx34fvbf3ll6"."Niche_Vocabulary" SET
        company_name_template = COALESCE(${cn ? j(cn) : null}::jsonb, company_name_template),
        description_template  = COALESCE(${desc ? j(desc) : null}::jsonb, description_template),
        kb_template           = COALESCE(${kb ? j(kb) : null}::jsonb, kb_template),
        question_bank         = COALESCE(${qb ? j(qb) : null}::jsonb, question_bank),
        bad_examples          = COALESCE(${be ? j(be) : null}::jsonb, bad_examples),
        objection_examples    = COALESCE(${oe ? j(oe) : null}::jsonb, objection_examples),
        scenario_examples     = COALESCE(${se ? j(se) : null}::jsonb, scenario_examples),
        updated_at = NOW()
      WHERE niche = ${niche}
    `);
    return [cn ?? EMPTY_TEMPLATE, desc ?? EMPTY_TEMPLATE, kb ?? EMPTY_TEMPLATE, qb ?? EMPTY_TEMPLATE, be ?? EMPTY_TEMPLATE, oe ?? EMPTY_TEMPLATE, se ?? EMPTY_TEMPLATE];
  },

  async addNicheWord(niche: string, lang: NicheLang, group: NicheWordGroup, word: string): Promise<{ nl: NicheWordGroups; en: NicheWordGroups }> {
    const both = await this.getNicheVocabularyBoth(niche);
    both[lang] = { ...both[lang], [group]: [...both[lang][group], word] };
    return this.setNicheVocabulary(niche, both);
  },

  async deleteNicheWord(niche: string, lang: NicheLang, group: NicheWordGroup, word: string): Promise<{ nl: NicheWordGroups; en: NicheWordGroups }> {
    const both = await this.getNicheVocabularyBoth(niche);
    both[lang] = { ...both[lang], [group]: both[lang][group].filter((w) => w !== word) };
    return this.setNicheVocabulary(niche, both);
  },

  async deleteNicheVocabulary(niche: string): Promise<boolean> {
    if (niche === "__default__") return false; // never delete the fallback row
    const result = await db.delete(nicheVocabulary)
      .where(eq(nicheVocabulary.niche, niche)).returning();
    return result.length > 0;
  },

  // ─── Users ──────────────────────────────────────────────────────────

  async getAppUsers(): Promise<Users[]> {
    return db.select().from(users);
  },

  async getAppUserById(id: number): Promise<Users | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row;
  },

  async getAppUserByEmail(email: string): Promise<Users | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row;
  },

  async createAppUser(data: InsertUsers): Promise<Users> {
    const [row] = await db.insert(users).values(data as any).returning();
    return row;
  },

  async updateAppUser(id: number, data: Partial<Users>): Promise<Users | undefined> {
    const { id: _id, createdAt: _createdAt, createdBy: _createdBy, ...updateData } = data as any;
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return updated;
  },
};

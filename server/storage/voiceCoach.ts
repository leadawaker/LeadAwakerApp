/**
 * The prompt coach's chat history (Voice_Coach_Messages), per account. An assistant message lists the
 * change cards it proposed in `suggestionIds`.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { voiceCoachMessages, type VoiceCoachMessageRow } from "@shared/schema";
import type { CoachMessageDto } from "@shared/voiceReview";

function toDto(r: VoiceCoachMessageRow): CoachMessageDto {
  return {
    id: r.id,
    role: r.role as CoachMessageDto["role"],
    content: r.content,
    suggestionIds: r.suggestionIds ?? [],
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

/** The newest `limit` messages of the account, oldest first. */
async function listCoachMessages(accountId: number, limit = 50): Promise<CoachMessageDto[]> {
  const rows = await db.select().from(voiceCoachMessages)
    .where(eq(voiceCoachMessages.accountsId, accountId))
    .orderBy(desc(voiceCoachMessages.createdAt), desc(voiceCoachMessages.id))
    .limit(limit);
  return rows.reverse().map(toDto);
}

async function addCoachMessage(
  accountId: number,
  role: "user" | "assistant",
  content: string,
  by: string | null,
): Promise<CoachMessageDto> {
  const [row] = await db.insert(voiceCoachMessages)
    .values({ accountsId: accountId, role, content, createdBy: by })
    .returning();
  return toDto(row);
}

async function setCoachMessageSuggestions(messageId: number, ids: number[]): Promise<void> {
  await db.update(voiceCoachMessages).set({ suggestionIds: ids }).where(eq(voiceCoachMessages.id, messageId));
}

export const voiceCoachStorage = {
  listCoachMessages,
  addCoachMessage,
  setCoachMessageSuggestions,
};

import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MessageSquare, Paperclip, Send, Download, Trash2, Check, ChevronUp, ChevronDown, Plus } from "lucide-react";
import {
  useTaskComments, useCreateComment, useDeleteComment,
  useTaskAttachments, useUploadAttachment, useDeleteAttachment,
  useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useReorderSubtasks,
} from "../api/tasksApi";

// ── CommentsSection ───────────────────────────────────────────────────────────

export function CommentsSection({ taskId }: { taskId: number }) {
  const { data: comments = [] } = useTaskComments(taskId);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const [body, setBody] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    createComment.mutate({ taskId, data: { body: trimmed, authorName: "You" } });
    setBody("");
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[12px] font-medium text-foreground/70">Comments ({comments.length})</span>
      </div>
      <div className="flex flex-col gap-3 mb-3">
        {comments.map((c) => {
          const initials = (c.authorName ?? "?").split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
          return (
            <div key={c.id} className="group flex gap-2.5 text-[12px]">
              {/* Avatar */}
              <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20 mt-0.5">
                {initials}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground/80">{c.authorName}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
                <p className="mt-0.5 text-foreground/80 leading-relaxed">{c.body}</p>
              </div>
              <button
                onClick={() => deleteComment.mutate({ id: c.id, taskId })}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Add a comment..."
          rows={2}
          className="flex-1 resize-none text-[12px] rounded-md border-none bg-[var(--bg)] shadow-[var(--sh-inset-crisp)] px-3 py-2 text-[var(--ink)] placeholder:text-[var(--mute-2)] focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || createComment.isPending}
          className="self-end h-9 w-9 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-transform hover:-translate-y-px"
          style={{ background: "var(--wine-grad)" }}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── AttachmentsSection ────────────────────────────────────────────────────────

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({ taskId }: { taskId: number }) {
  const { data: attachments = [] } = useTaskAttachments(taskId);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAttachment.mutate({
        taskId,
        data: { fileName: file.name, fileData: base64, mimeType: file.type, uploadedBy: "You" },
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium text-foreground/70">Attachments ({attachments.length})</span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-[11px] text-brand-indigo hover:underline"
        >
          + Attach file
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>
      <div className="flex flex-col gap-1.5">
        {attachments.map((a) => (
          <div key={a.id} className="group flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] bg-background">
            <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate text-foreground/80">{a.fileName}</span>
            {a.fileSize != null && <span className="text-muted-foreground text-[11px] shrink-0">{formatSize(a.fileSize)}</span>}
            <a
              href={`/api/task-attachments/${a.id}/download`}
              download={a.fileName}
              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-brand-indigo"
            >
              <Download className="h-3 w-3" />
            </a>
            <button
              onClick={() => deleteAttachment.mutate({ id: a.id, taskId })}
              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SubtaskSection ────────────────────────────────────────────────────────────

export function SubtaskSection({ taskId }: { taskId: number }) {
  const { t } = useTranslation("tasks");
  const { data: subtasks = [] } = useSubtasks(taskId);
  const createSubtaskMutation = useCreateSubtask();
  const updateSubtaskMutation = useUpdateSubtask();
  const deleteSubtaskMutation = useDeleteSubtask();
  const reorderMutation = useReorderSubtasks();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const handleAddSubtask = useCallback(() => {
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    createSubtaskMutation.mutate({ taskId, data: { title: trimmed } });
    setNewSubtaskTitle("");
  }, [newSubtaskTitle, taskId, createSubtaskMutation]);

  const handleMoveSubtask = useCallback((index: number, direction: "up" | "down") => {
    const ids = subtasks.map((s) => s.id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate({ taskId, subtaskIds: ids });
  }, [subtasks, taskId, reorderMutation]);

  return (
    <div className="space-y-2">
      {subtasks.length > 0 && (
        <ul className="space-y-1" data-testid="subtask-list">
          {subtasks.map((sub, idx) => (
            <li
              key={sub.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03] transition-colors"
            >
              <button
                onClick={() => updateSubtaskMutation.mutate({ id: sub.id, taskId, data: { isCompleted: !sub.isCompleted } })}
                className={cn(
                  "h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors",
                  sub.isCompleted ? "bg-brand-indigo border-brand-indigo text-white" : "border-foreground/20 hover:border-brand-indigo/50"
                )}
              >
                {sub.isCompleted && <Check className="h-3 w-3" />}
              </button>
              <span className={cn("flex-1 text-[13px] min-w-0 truncate", sub.isCompleted && "line-through text-muted-foreground")}>
                {sub.title}
              </span>
              <button onClick={() => handleMoveSubtask(idx, "up")} disabled={idx === 0}
                className={cn("h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", idx === 0 ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]")}
              ><ChevronUp className="h-3.5 w-3.5" /></button>
              <button onClick={() => handleMoveSubtask(idx, "down")} disabled={idx === subtasks.length - 1}
                className={cn("h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", idx === subtasks.length - 1 ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]")}
              ><ChevronDown className="h-3.5 w-3.5" /></button>
              <button onClick={() => deleteSubtaskMutation.mutate({ id: sub.id, taskId })}
                className="h-6 w-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-red-50"
              ><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          className="flex-1 h-8 px-3 rounded-lg bg-card border border-border/30 text-[13px] outline-none focus:border-brand-indigo/50 transition-colors placeholder:text-foreground/30"
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); }}
          placeholder={t("subtask.addPlaceholder", "Add a sub-task...")}
        />
        <button
          onClick={handleAddSubtask}
          disabled={!newSubtaskTitle.trim()}
          className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
            newSubtaskTitle.trim() ? "bg-brand-indigo text-white hover:bg-brand-indigo/90" : "bg-foreground/[0.04] text-foreground/20 cursor-not-allowed")}
        ><Plus className="h-4 w-4" /></button>
      </div>
      {subtasks.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
            <div className="h-full bg-brand-indigo rounded-full transition-all duration-300"
              style={{ width: `${(subtasks.filter((s) => s.isCompleted).length / subtasks.length) * 100}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {subtasks.filter((s) => s.isCompleted).length}/{subtasks.length}
          </span>
        </div>
      )}
    </div>
  );
}

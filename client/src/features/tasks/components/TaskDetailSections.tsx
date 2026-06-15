import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MessageSquare, Paperclip, Send, Download, Trash2, Check, ChevronUp, ChevronDown, Plus, Pencil, X } from "lucide-react";
import {
  useTaskComments, useCreateComment, useUpdateComment, useDeleteComment,
  useTaskAttachments, useUploadAttachment, useDeleteAttachment,
  useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useReorderSubtasks,
} from "../api/tasksApi";

type CommentUser = { id: number; fullName1: string | null; email: string | null; avatarUrl: string | null };

// ── CommentsSection ───────────────────────────────────────────────────────────

export function CommentsSection({ taskId, currentUserName, users = [] }: { taskId: number; currentUserName?: string; users?: CommentUser[] }) {
  const { t } = useTranslation("tasks");
  const { data: comments = [] } = useTaskComments(taskId);
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const authorName = currentUserName?.trim() || localStorage.getItem("leadawaker_user_name") || t("comments.unknown");
  const currentUserAvatar = localStorage.getItem("leadawaker_user_avatar") || "";

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    createComment.mutate({ taskId, data: { body: trimmed, authorName } });
    setBody("");
  }

  function startEdit(id: number, currentBody: string) {
    setEditingId(id);
    setEditBody(currentBody);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody("");
  }

  function saveEdit(id: number) {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    updateComment.mutate({ id, taskId, body: trimmed }, { onSuccess: cancelEdit });
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[12px] font-medium text-foreground/70">{t("comments.title", { count: comments.length })}</span>
      </div>
      <div className="flex flex-col gap-3 mb-3">
        {comments.map((c) => {
          const name = c.authorName ?? "?";
          const initials = name.split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
          const matchedUser = users.find(u => u.fullName1 === name || u.email === name);
          const isOwnComment = name === authorName;
          const avatarUrl = matchedUser?.avatarUrl || (isOwnComment ? currentUserAvatar : "");
          const isEditing = editingId === c.id;
          return (
            <div key={c.id} className="group flex gap-2.5 text-[12px]">
              {/* Avatar */}
              <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20 mt-0.5 overflow-hidden">
                {avatarUrl
                  ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground/80">{c.authorName}</span>
                  <span className="text-muted-foreground text-[11px]">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
                {isEditing ? (
                  <div style={{ position: 'relative', marginTop: 4 }}>
                    <textarea
                      autoFocus
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(c.id); }
                        if (e.key === "Escape") cancelEdit();
                      }}
                      rows={2}
                      className="w-full resize-none text-[12px] rounded-[5px] border-none bg-[var(--bg)] shadow-[var(--sh-inset-crisp)] px-3 py-2 text-[var(--ink)] placeholder:text-[var(--mute-2)] focus:outline-none"
                      style={{ paddingBottom: 32 }}
                    />
                    <div style={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', gap: 4 }}>
                      <button onClick={cancelEdit} style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--mute-2)' }}>
                        <X className="h-3 w-3" />
                      </button>
                      <button onClick={() => saveEdit(c.id)} disabled={updateComment.isPending} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--wine-grad)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', boxShadow: 'var(--sh-raised-crisp)' }}>
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 text-foreground/80 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                )}
              </div>
              {!isEditing && isOwnComment && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 shrink-0">
                  <button
                    onClick={() => startEdit(c.id, c.body ?? "")}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-brand-indigo hover:bg-brand-indigo/10"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => deleteComment.mutate({ id: c.id, taskId })}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Textarea with send button appearing inside the box only after typing */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder={t("comments.placeholder")}
          rows={2}
          className="w-full resize-none text-[12px] rounded-[5px] border-none bg-[var(--bg)] shadow-[var(--sh-inset-crisp)] px-3 py-2 text-[var(--ink)] placeholder:text-[var(--mute-2)] focus:outline-none"
          style={{ paddingBottom: body.trim() ? 32 : undefined }}
        />
        {body.trim() && (
          <button
            onClick={handleSubmit}
            disabled={createComment.isPending}
            style={{
              position: 'absolute', bottom: 6, right: 6,
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--wine-grad)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
              boxShadow: 'var(--sh-raised-crisp)',
              transition: 'transform 120ms',
            }}
          >
            <Send className="h-3 w-3" />
          </button>
        )}
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
  const { t } = useTranslation("tasks");
  const { data: attachments = [] } = useTaskAttachments(taskId);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function uploadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAttachment.mutate({
        taskId,
        data: { fileName: file.name, fileData: base64, mimeType: file.type, uploadedBy: "You" },
      });
    };
    reader.readAsDataURL(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(uploadFile);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium text-foreground/70">{t("attachments.title", { count: attachments.length })}</span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-[11px] text-brand-indigo hover:underline"
        >
          {t("attachments.add")}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col gap-1.5 rounded-lg transition-colors",
          isDragging && "border border-dashed border-brand-indigo bg-brand-indigo/5 p-2"
        )}
      >
        {isDragging && (
          <div className="flex items-center justify-center gap-2 py-3 text-[12px] text-brand-indigo">
            <Paperclip className="h-3.5 w-3.5" />
            {t("attachments.dropHint")}
          </div>
        )}
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

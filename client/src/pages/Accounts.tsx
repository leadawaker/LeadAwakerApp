import { useEffect, useState, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RefreshCw, Save, X, Edit2, Trash2, AlertCircle, Eye, GripVertical, Building2, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Row {
  Id: number;
  [key: string]: any;
}

const TABLE_ID = "m8hflvkkfj25aio";
const NOCODB_BASE_URL = "https://api-leadawaker.netlify.app/.netlify/functions/api";

const SMALL_WIDTH_COLS = [
  'Id',
  'number of leads',
  'number of campaigns',
  'Leads',
  'Campaigns',
  'Interactions',
  'Automation Logs',
  'Users',
  'Prompt Libraries'
];

const NON_EDITABLE_FIELDS = [
  "Id",
  "Tags",
  "Leads",
  "Campaigns",
  "Interactions",
  "Automation Logs",
  "Users",
  "Prompt Libraries",
  "Created Time",
  "Last Modified Time",
  "created_at",
  "updated_at",
  "Account ID",
  "CreatedAt",
  "UpdatedAt",
  "account_id"
];

const DISPLAY_ONLY_FIELDS = [
  "Tags",
  "Leads",
  "Campaigns",
  "Interactions",
  "Automation Logs",
  "Users",
  "Prompt Libraries",
  "Created Time",
  "Last Modified Time",
  "Id",
  "Account ID",
  "account_id",
  "CreatedAt",
  "UpdatedAt",
  "created_at",
  "updated_at"
];

const HIDDEN_FIELDS = [
  "Account ID",
  "ID",
  "account_id",
  "account_ID",
  "Automation Logs",
  "Prompt Libraries",
  "CreatedAt",
  "UpdatedAt",
  "created_at",
  "updated_at",
  "Created Time",
  "Last Modified Time",
  "ACC"
];

const STATUS_OPTIONS = ["Active", "Inactive", "Trial", "Suspended", "Unknown"];
const TYPE_OPTIONS = ["Agency", "Client"];
const TIMEZONE_OPTIONS = ["UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "America/Sao_Paulo", "Asia/Tokyo", "Asia/Dubai"];

export default function Accounts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRowData, setNewRowData] = useState<Partial<Row>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [colWidths, setColWidths] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem("accounts_col_widths");
    return saved ? JSON.parse(saved) : {};
  });
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>(() => {
    const saved = localStorage.getItem("accounts_sort");
    return saved ? JSON.parse(saved) : { key: '', direction: null };
  });
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredRows = statusFilter === "All" ? rows : rows.filter(r => r.status === statusFilter);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc';
      else if (sortConfig.direction === 'desc') direction = null;
    }
    const newSort = { key, direction };
    setSortConfig(newSort);
    localStorage.setItem("accounts_sort", JSON.stringify(newSort));
  };

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.direction || !sortConfig.key) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal === bVal) return 0;
    let comparison = 0;
    const isDate = sortConfig.key.toLowerCase().includes('time') || sortConfig.key.toLowerCase().includes('at') || sortConfig.key === 'CreatedAt' || sortConfig.key === 'UpdatedAt';
    if (isDate) {
      comparison = new Date(aVal || 0).getTime() - new Date(bVal || 0).getTime();
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal || '').localeCompare(String(bVal || ''));
    }
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const finalRows = searchTerm 
    ? sortedRows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))) 
    : sortedRows;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsCreateOpen(true);
      }
      if (e.key === 'Delete' && selectedIds.length > 0 && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsDeleteDialogOpen(true);
      }
      if (['ArrowUp', 'ArrowDown'].includes(e.key) && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (finalRows.length === 0) return;
        const currentIdx = finalRows.findIndex(r => selectedIds.includes(r.Id));
        let nextIdx = 0;
        if (e.key === 'ArrowUp') nextIdx = Math.max(0, currentIdx - 1);
        else nextIdx = Math.min(finalRows.length - 1, currentIdx + 1);
        setSelectedIds([finalRows[nextIdx].Id]);
        const row = document.getElementById(`row-${finalRows[nextIdx].Id}`);
        row?.scrollIntoView({ block: 'nearest' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, finalRows]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      const list = data.list || [];
      setRows(list);
      
      if (list.length > 0) {
        const allKeys = Object.keys(list[0]); console.log("Keys found:", allKeys);
        // Remove HIDDEN_FIELDS check here to ensure we get everything first
        const keys = allKeys; 
        const savedOrder = null; null;
        let ordered: string[] = savedOrder ? JSON.parse(savedOrder) : ["Id", "ACC"];

        if (!savedOrder) {
          if (keys.includes("name")) ordered.push("name");
          const techCols = ["twilio_account_sid", "twilio_auth_token", "twilio_messaging_service_sid", "twilio_default_from_number", "webhook_url", "webhook_secret", "max_daily_sends"];
          if (keys.includes("status")) ordered.push("status");
          if (keys.includes("type")) ordered.push("type");
          if (keys.includes("owner_email")) ordered.push("owner_email");
          if (keys.includes("phone")) ordered.push("phone");
          if (keys.includes("business_niche")) ordered.push("business_niche");
          if (keys.includes("website")) ordered.push("website");
          if (keys.includes("notes")) ordered.push("notes");
          if (keys.includes("timezone")) ordered.push("timezone");
          keys.forEach(k => { if (!ordered.includes(k) && !techCols.includes(k) && !["created_at", "updated_at", "Created Time", "Last Modified Time", "Id", "Account ID"].includes(k)) ordered.push(k); });
          techCols.forEach(k => { if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k); });
          const middleCols = ["number of leads", "number of campaigns", "Leads", "Campaigns", "Interactions", "Users", "Prompt Libraries", "Tags", "Automation Logs"];
          middleCols.forEach(k => { if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k); });
          ["Created Time", "Last Modified Time"].forEach(k => { if (allKeys.includes(k)) ordered.push(k); });
        }
        
        // Ensure "Id" is always first and not filtered out
        const finalCols = ["Id", ...ordered.filter(c => c !== "Id" && !HIDDEN_FIELDS.includes(c))];
        setColumns(finalCols);
        
        // Always reset visible columns if "Id" is missing from current view
        setVisibleColumns(finalCols);
        localStorage.setItem("accounts_visible_columns", JSON.stringify(finalCols));
        
        const savedWidths = localStorage.getItem("accounts_col_widths");
        const initialWidths: { [key: string]: number } = savedWidths ? JSON.parse(savedWidths) : {};
        finalCols.forEach(col => {
          if (!initialWidths[col]) {
            if (col === 'Id' || col === 'Account ID') initialWidths[col] = 80;
            else if (col === 'ACC') initialWidths[col] = 60;
            else if (SMALL_WIDTH_COLS.includes(col)) initialWidths[col] = 100;
            else initialWidths[col] = 160; 
          }
        });
        setColWidths(initialWidths);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error fetching data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (visibleColumns.length > 0) localStorage.setItem("accounts_visible_columns", JSON.stringify(visibleColumns)); }, [visibleColumns]);
  useEffect(() => { if (columns.length > 0) localStorage.setItem("accounts_column_order", JSON.stringify(columns)); }, [columns]);

  const toggleColumnVisibility = (col: string) => {
    const colIdx = columns.indexOf(col);
    if (colIdx >= 0 && colIdx < 4) return;
    setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const handleColDragStart = (idx: number) => { setDraggedColIdx(idx); };
  const handleColDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedColIdx === null || draggedColIdx === idx) return;
    const newColumns = [...columns];
    const item = newColumns.splice(draggedColIdx, 1)[0];
    newColumns.splice(idx, 0, item);
    setColumns(newColumns);
    setDraggedColIdx(idx);
  };

  const handleInlineUpdate = async (rowId: number, col: string, value: any) => {
    if (NON_EDITABLE_FIELDS.includes(col)) return;
    const idsToUpdate = selectedIds.includes(rowId) ? selectedIds : [rowId];
    const cleanValue = value === null || value === undefined ? "" : value;
    
    // Optimistic UI update
    setRows(prev => prev.map(r => idsToUpdate.includes(r.Id) ? { ...r, [col]: cleanValue } : r));

    try {
      const payloads = idsToUpdate.map(id => ({ 
        id: id, 
        fields: { [col]: cleanValue } 
      }));

      // If the backend expects a list of updates
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payloads),
      });

      if (!res.ok) {
        // Try fallback if the above format is not accepted (some NocoDB versions expect single object or different array structure)
        const fallbackRes = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(idsToUpdate.map(id => ({ Id: id, [col]: cleanValue }))),
        });
        if (!fallbackRes.ok) throw new Error("Update failed");
      }

      toast({ title: "Updated", description: "Changes saved to database." });
    } catch (err) {
      console.error("Update error:", err);
      toast({ 
        variant: "destructive", 
        title: "Sync Error", 
        description: "Failed to save to database." 
      });
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const deletePromises = selectedIds.map(id => 
        fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Id: id }),
        })
      );
      await Promise.all(deletePromises);
      toast({ title: "Deleted", description: `Successfully deleted ${selectedIds.length} records.` });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      toast({ variant: "destructive", title: "Delete Failed" });
    } finally {
      setLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCreateRow = async () => {
    try {
      const cleanData: any = {};
      Object.keys(newRowData).forEach(key => { if (!NON_EDITABLE_FIELDS.includes(key) && !HIDDEN_FIELDS.includes(key)) cleanData[key] = newRowData[key]; });
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Creation failed");
      toast({ title: "Success", description: "New account created." });
      setIsCreateOpen(false);
      setNewRowData({});
      fetchData();
    } catch (err) {
      toast({ variant: "destructive", title: "Creation Failed" });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length) setSelectedIds([]);
    else setSelectedIds(rows.map(r => r.Id));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1] || "")).toUpperCase();
    return (name[0] + (name[1] || name[0])).toUpperCase().slice(0, 2);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: rows.length };
    rows.forEach(r => {
      const s = r.status || "Unknown";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [rows]);

  const initialsColors = [
    { text: "text-[#1a3a6f]", bg: "bg-[#1a3a6f]/10", dot: "bg-[#1a3a6f]" },
    { text: "text-[#2d5aa8]", bg: "bg-[#2d5aa8]/10", dot: "bg-[#2d5aa8]" },
    { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", dot: "bg-[#1E90FF]" },
    { text: "text-[#17A398]", bg: "bg-[#17A398]/10", dot: "bg-[#17A398]" },
    { text: "text-[#10b981]", bg: "bg-[#10b981]/10", dot: "bg-[#10b981]" },
    { text: "text-[#ca8a04]", bg: "bg-[#facc15]/20", dot: "bg-[#facc15]" },
  ];

  const statusColors: Record<string, { text: string, bg: string, border: string, dot: string }> = {
    "Active": { text: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", dot: "bg-[#10b981]" },
    "Inactive": { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", dot: "bg-[#ef4444]" },
    "Trial": { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", border: "border-[#1E90FF]/20", dot: "bg-[#1E90FF]" },
    "Suspended": { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", dot: "bg-[#ef4444]" },
    "Unknown": { text: "text-muted-foreground", bg: "bg-muted/10", border: "border-border", dot: "bg-slate-400" },
  };

  const getAccountColor = (id: number) => {
    return initialsColors[id % initialsColors.length];
  };

  const getStatusColor = (status: string) => {
    const info = statusColors[status] || statusColors["Unknown"];
    return `${info.bg} ${info.text} ${info.border}`;
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'agency': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'client': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const handleResize = (col: string, width: number) => { 
    setColWidths(prev => {
      const next = { ...prev, [col]: width };
      localStorage.setItem("accounts_col_widths", JSON.stringify(next));
      return next;
    }); 
  };

  const handleExportCSV = () => {
    const headers = columns.filter(c => visibleColumns.includes(c));
    const csvRows = filteredRows.map(row => headers.map(header => JSON.stringify(row[header] || "")).join(","));
    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "accounts_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      const headers = lines[0].split(",");
      const newRows = lines.slice(1).map((line, index) => {
        const values = line.split(",");
        const row: any = { Id: Date.now() + index };
        headers.forEach((header, i) => { row[header.trim().replace(/^"|"$/g, "")] = values[i]?.trim().replace(/^"|"$/g, ""); });
        return row;
      });
      setRows(prev => [...prev, ...newRows]);
      toast({ title: "Imported" });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatHeader = (col: string) => {
    let title = col;
    if (col === "name") title = "Company Name";
    else if (col === "Account ID") title = "ID";
    else title = col.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const iconMap: { [key: string]: any } = {
      "Account ID": <LayoutGrid className="h-3 w-3" />,
      "ACC": <GripVertical className="h-3 w-3" />,
      "name": <Building2 className="h-3 w-3" />,
      "owner_email": <Eye className="h-3 w-3" />,
      "phone": <Plus className="h-3 w-3" />,
      "status": <AlertCircle className="h-3 w-3" />,
      "type": <Building2 className="h-3 w-3" />,
      "CreatedAt": <RefreshCw className="h-3 w-3" />,
      "UpdatedAt": <RefreshCw className="h-3 w-3" />,
    };
    const icon = iconMap[col] || <LayoutGrid className="h-3 w-3" />;
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <span>{title}</span>
      </div>
    );
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = date.getDate().toString().padStart(2, '0');
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const month = months[date.getMonth()];
      const year = date.getFullYear().toString().slice(-2);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year}    ${hours}:${minutes}`;
    } catch (e) { return dateStr; }
  };

  return (
    <div className="w-full h-full bg-transparent pb-12 px-0 overflow-y-auto pt-4">
      <div className="w-full mx-auto space-y-6">
        <div className="flex items-center gap-3 px-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold gap-2 shadow-none border-none">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl h-[calc(100vh-80px)] p-0 gap-0 overflow-hidden flex flex-col">
              <DialogHeader className="p-6 border-b"><DialogTitle>Add New Account</DialogTitle></DialogHeader>
              <ScrollArea className="flex-1 p-6">
                <div className="grid grid-cols-2 gap-4 pb-4">
                  {columns.filter(c => !DISPLAY_ONLY_FIELDS.includes(c)).map(col => (
                    <div key={col} className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{formatHeader(col)}</label>
                      <Input value={newRowData[col] || ""} onChange={(e) => setNewRowData(prev => ({ ...prev, [col]: e.target.value }))} className="bg-slate-50 border-slate-200" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 border-t bg-slate-50/50">
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRow}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Input 
            ref={searchInputRef}
            placeholder="Search accounts (Ctrl+K)" 
            className="w-[240px] h-10 rounded-xl bg-white shadow-none border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="relative">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-10 rounded-xl bg-white shadow-none border-slate-200 pl-10 pr-4 font-bold appearance-none">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses ({rows.length})</SelectItem>
                {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200 pointer-events-none">
              {statusCounts[statusFilter] || 0}
            </div>
            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
              {statusFilter !== 'All' && (
                <div className={cn("w-2.5 h-2.5 rounded-full border border-black/10", statusColors[statusFilter]?.dot || "bg-slate-400")} />
              )}
            </div>
          </div>

          <div className="flex-1" />
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleImportCSV} />
          <Button variant="outline" className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none" onClick={() => fileInputRef.current?.click()}>Import CSV</Button>
          <Button variant="outline" className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none" onClick={handleExportCSV}>Export CSV</Button>
          {selectedIds.length > 0 && <Button variant="destructive" className="h-10 rounded-xl gap-2 font-bold" onClick={() => setIsDeleteDialogOpen(true)}><Trash2 className="h-4 w-4" /> Delete ({selectedIds.length})</Button>}
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none"><Eye className="h-4 w-4" /> Fields</Button></PopoverTrigger>
            <PopoverContent className="w-[320px] p-2"><ScrollArea className="h-80"><div className="space-y-1">{columns.map((col, idx) => (<div key={col} className={cn("flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 group", !visibleColumns.includes(col) && "opacity-50")}><Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", idx < 4 && "hidden")} onClick={() => toggleColumnVisibility(col)}><Eye className={cn("h-3 w-3", !visibleColumns.includes(col) && "text-slate-300")} /></Button><span className="text-sm font-medium truncate">{formatHeader(col)}</span></div>))}</div></ScrollArea></PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="h-10 w-10 rounded-xl bg-white border-slate-200 shadow-none"><RefreshCw className={cn("h-4 w-4 text-slate-400", loading && "animate-spin")} /></Button>
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-[32px] border border-slate-200 flex flex-col overflow-hidden shadow-none">
          <div className="shrink-0 flex items-center bg-white border-b border-border uppercase tracking-wider z-20 overflow-x-auto no-scrollbar" data-testid="row-contacts-head">
            <div className="w-[40px] flex justify-center border-r border-border/12 shrink-0 py-4">
              <Checkbox 
                checked={selectedIds.length === rows.length && rows.length > 0} 
                onCheckedChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 cursor-pointer"
              />
            </div>
            {columns.filter(c => visibleColumns.includes(c)).map((col, idx) => (
              <div 
                key={col}
                draggable={idx >= 4}
                onDragStart={() => handleColDragStart(columns.indexOf(col))}
                onDragOver={(e) => handleColDragOver(e, columns.indexOf(col))}
                className={cn(
                  "border-r border-border/20 h-full flex items-center px-4 relative group/col text-[11px] font-bold text-muted-foreground shrink-0 py-4",
                  idx < 4 && "sticky z-40 bg-white border-blue-100",
                  idx === 0 && "left-0",
                  idx === 1 && "left-[80px]",
                  idx === 2 && "left-[160px]",
                  idx === 3 && "left-[240px]",
                )}
                style={{ width: colWidths[col] || 160 }}
              >
                <div className="flex-1 truncate cursor-pointer" onClick={() => handleSort(col)}>
                  {formatHeader(col)}
                </div>
                <div 
                  className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 opacity-0 group-hover/col:opacity-100 transition-opacity"
                  onMouseDown={(e) => {
                    const startX = e.pageX;
                    const startWidth = colWidths[col] || 160;
                    const onMouseMove = (moveEvent: MouseEvent) => {
                      handleResize(col, Math.max(50, startWidth + (moveEvent.pageX - startX)));
                    };
                    const onMouseUp = () => {
                      window.removeEventListener('mousemove', onMouseMove);
                      window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-auto divide-y divide-border/12" data-testid="list-contacts">
            {loading && rows.length === 0 ? (
              <div className="h-96 text-center flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40" /></div>
            ) : (
              finalRows.map((row) => {
                const accountColor = getAccountColor(row.Id);
                const isSelected = selectedIds.includes(row.Id);
                return (
                  <div 
                    key={row.Id} 
                    id={`row-${row.Id}`}
                    className={cn(
                      "flex items-center group transition-all duration-200 border-b border-slate-200/12 h-12 bg-white hover:bg-slate-50/50",
                      isSelected && "bg-blue-50/80"
                    )}
                  >
                    <div className="w-[40px] flex justify-center border-r border-border/12 shrink-0">
                      <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={() => toggleSelect(row.Id)} 
                        className="h-4 w-4 rounded border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 cursor-pointer"
                      />
                    </div>
                    
                    {columns.filter(c => visibleColumns.includes(c)).map((col, idx) => (
                      <div 
                        key={col}
                        className={cn(
                          "px-4 border-r border-border/20 h-full flex items-center shrink-0",
                          idx < 4 && "sticky z-10",
                          idx === 0 && "left-0",
                          idx === 1 && "left-[80px]",
                          idx === 2 && "left-[160px]",
                          idx === 3 && "left-[240px]",
                          isSelected ? "bg-blue-50/80" : (idx < 4 ? "bg-white group-hover:bg-slate-50/50" : ""),
                          isSelected && col === "name" && "text-blue-700"
                        )}
                        style={{ width: colWidths[col] || 160 }}
                      >
                        {col === "Id" ? (
                          <span className="text-xs font-mono font-bold text-slate-400">#{row.Id}</span>
                        ) : col === "ACC" ? (
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm border border-slate-100", accountColor.bg, accountColor.text)}>
                            {getInitials(row.name || "")}
                          </div>
                        ) : col === "status" ? (
                          <select
                            value={row.status}
                            onChange={(e) => handleInlineUpdate(row.Id, "status", e.target.value)}
                            className={cn(
                              "h-7 w-full font-bold uppercase tracking-tighter text-[10px] px-2 py-0.5 rounded-full border shadow-none appearance-none cursor-pointer text-center",
                              statusColors[row.status]?.bg || "bg-muted/10",
                              statusColors[row.status]?.text || "text-muted-foreground",
                              statusColors[row.status]?.border || "border-border"
                            )}
                          >
                            {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : col === "type" ? (
                          <select
                            value={row.type}
                            onChange={(e) => handleInlineUpdate(row.Id, "type", e.target.value)}
                            className={cn(
                              "h-7 w-full font-bold uppercase tracking-tighter text-[10px] px-2 py-0.5 rounded-full border shadow-none appearance-none cursor-pointer text-center",
                              getTypeColor(row.type)
                            )}
                          >
                            {TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input 
                            type="text"
                            value={row[col] || ""}
                            readOnly={NON_EDITABLE_FIELDS.includes(col)}
                            onChange={(e) => setRows(prev => prev.map(r => r.Id === row.Id ? { ...r, [col]: e.target.value } : r))}
                            onBlur={(e) => handleInlineUpdate(row.Id, col, e.target.value)}
                            className={cn(
                              "bg-transparent border-none focus:ring-0 w-full text-[11px] p-0 h-auto focus:bg-white focus:px-2 focus:py-1 focus:rounded focus:shadow-sm transition-all truncate",
                              col === "name" ? "font-bold text-slate-900" : "font-medium text-slate-700",
                              isSelected && col === "name" && "text-blue-700"
                            )}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will delete {selectedIds.length} selected account(s). This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

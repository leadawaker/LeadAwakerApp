import { useEffect, useState, useRef } from "react";
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
  "Id",
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
const TIMEZONE_OPTIONS = ["UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Asia/Dubai"];

export default function Accounts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRowData, setNewRowData] = useState<Partial<Row>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("accounts_visible_columns");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [colWidths, setColWidths] = useState<{ [key: string]: number }>({});
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredRows = statusFilter === "All" ? rows : rows.filter(r => r.status === statusFilter);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc';
      else if (sortConfig.direction === 'desc') direction = null;
    }
    setSortConfig({ key, direction });
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
        const allKeys = Object.keys(list[0]);
        const keys = allKeys.filter(k => !HIDDEN_FIELDS.includes(k));
        const savedOrder = localStorage.getItem("accounts_column_order");
        let ordered: string[] = savedOrder ? JSON.parse(savedOrder) : ["Account ID", "ACC"];

        if (!savedOrder) {
          if (keys.includes("name")) ordered.push("name");
          if (allKeys.includes("Id")) ordered.push("Id");
          const techCols = ["twilio_account_sid", "twilio_auth_token", "twilio_messaging_service_sid", "twilio_default_from_number", "webhook_url", "webhook_secret", "max_daily_sends"];
          if (keys.includes("status")) ordered.push("status");
          if (keys.includes("type")) ordered.push("type");
          if (keys.includes("owner_email")) ordered.push("owner_email");
          if (keys.includes("phone")) ordered.push("phone");
          if (keys.includes("business_niche")) ordered.push("business_niche");
          if (keys.includes("website")) ordered.push("website");
          if (keys.includes("notes")) ordered.push("notes");
          if (keys.includes("timezone")) ordered.push("timezone");
          keys.forEach(k => { if (!ordered.includes(k) && !techCols.includes(k) && !["created_at", "updated_at", "Created Time", "Last Modified Time"].includes(k)) ordered.push(k); });
          techCols.forEach(k => { if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k); });
          const middleCols = ["number of leads", "number of campaigns", "Leads", "Campaigns", "Interactions", "Users", "Prompt Libraries", "Tags", "Automation Logs"];
          middleCols.forEach(k => { if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k); });
          ["Created Time", "Last Modified Time"].forEach(k => { if (allKeys.includes(k)) ordered.push(k); });
        }
        setColumns(ordered);
        if (visibleColumns.length === 0) setVisibleColumns(ordered);
        const initialWidths: { [key: string]: number } = {};
        ordered.forEach(col => {
          if (col === 'Id' || col === 'Account ID') initialWidths[col] = 60;
          else if (col === 'ACC') initialWidths[col] = 60;
          else if (SMALL_WIDTH_COLS.includes(col)) initialWidths[col] = 80;
          else initialWidths[col] = 160; 
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
    const payloads = idsToUpdate.map(id => ({ Id: id, [col]: value }));
    try {
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloads),
      });
      if (!res.ok) throw new Error("Update failed");
      setRows(prev => prev.map(r => idsToUpdate.includes(r.Id) ? { ...r, [col]: value } : r));
      toast({ title: "Updated", description: `Updated ${idsToUpdate.length} record(s).` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update Failed" });
      fetchData();
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'inactive': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'trial': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'suspended': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'agency': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'client': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const getAccountColor = (id: number) => {
    const initialsColors = [
      { text: "text-blue-600", bg: "bg-blue-50" },
      { text: "text-emerald-600", bg: "bg-emerald-50" },
      { text: "text-amber-600", bg: "bg-amber-50" },
      { text: "text-indigo-600", bg: "bg-indigo-50" },
      { text: "text-rose-600", bg: "bg-rose-50" },
      { text: "text-violet-600", bg: "bg-violet-50" },
    ];
    return initialsColors[id % initialsColors.length];
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name[0] + (name[1] || name[0])).toUpperCase().slice(0, 2);
  };

  const handleResize = (col: string, width: number) => { setColWidths(prev => ({ ...prev, [col]: width })); };

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

    const iconMap: { [key: string]: string } = {
      "Company Name": "🏢",
      "owner_email": "📧",
      "phone": "📞",
      "website": "🌍",
      "Tags": "🏷",
      "Created Time": "🕒",
      "Last Modified Time": "🕒",
      "CreatedAt": "🕒",
      "UpdatedAt": "🕒",
      "notes": "📝",
      "timezone": "🌐"
    };
    return iconMap[col] ? `${iconMap[col]} ${title}` : title;
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const year = date.getFullYear().toString().slice(-2);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day}.${month}.${year} - ${hours}:${minutes}`;
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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-white shadow-none border-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>

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
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed border-separate border-spacing-0">
              <TableHeader className="bg-slate-50 border-b border-slate-100 sticky top-0 z-20">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 px-0 border-r border-slate-100/50 sticky left-0 z-30 bg-slate-50">
                    <div className="flex justify-center"><Checkbox checked={selectedIds.length === rows.length && rows.length > 0} onCheckedChange={toggleSelectAll} /></div>
                  </TableHead>
                  {columns.filter(c => visibleColumns.includes(c)).map((col, idx) => (
                    <TableHead 
                      key={col} 
                      draggable
                      onDragStart={() => handleColDragStart(idx)}
                      onDragOver={(e) => handleColDragOver(e, idx)}
                      onClick={() => handleSort(col)}
                      style={{ width: colWidths[col] || 200, left: idx < 3 ? (40 + columns.filter(c => visibleColumns.includes(c)).slice(0, idx).reduce((acc, c) => acc + (colWidths[c] || 200), 0)) : undefined }}
                      className={cn("px-4 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap border-r border-slate-100/50 relative group table-fixed cursor-pointer select-none transition-colors hover:bg-slate-100/50", col === "Id" && "text-center", idx < 3 && "sticky z-30 bg-slate-50")}
                    >
                      <div className="flex items-center justify-between overflow-hidden gap-1">
                        <span className="truncate">{formatHeader(col)}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {sortConfig.key === col && sortConfig.direction && (<div className="text-blue-500">{sortConfig.direction === 'asc' ? (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>) : (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>)}</div>)}
                          <div className="w-1 cursor-col-resize hover:bg-primary/30 transition-colors h-4" onMouseDown={(e) => { e.stopPropagation(); const startX = e.pageX; const startWidth = colWidths[col] || 200; const onMouseMove = (me: MouseEvent) => handleResize(col, Math.max(50, startWidth + (me.pageX - startX))); const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); }} />
                        </div>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow><TableCell colSpan={columns.length + 1} className="h-96 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40" /></TableCell></TableRow>
                ) : (
                  finalRows.map((row) => (
                    <TableRow id={`row-${row.Id}`} key={row.Id} className={cn("group transition-colors border-b border-slate-100 last:border-0", selectedIds.includes(row.Id) ? "bg-blue-50" : "hover:bg-slate-50/50")}>
                      <TableCell className={cn("w-10 px-0 border-r border-slate-100/30 sticky left-0 z-10 transition-colors", selectedIds.includes(row.Id) ? "bg-blue-50" : "bg-white group-hover:bg-slate-50/50")}>
                        <div className="flex justify-center"><Checkbox checked={selectedIds.includes(row.Id)} onCheckedChange={() => toggleSelect(row.Id)} /></div>
                      </TableCell>
                      {columns.filter(c => visibleColumns.includes(c)).map((col, idx) => {
                        const val = row[col]; const isSticky = idx < 3;
                        const leftPos = isSticky ? (40 + columns.filter(c => visibleColumns.includes(c)).slice(0, idx).reduce((acc, c) => acc + (colWidths[c] || 200), 0)) : undefined;
                        const isDate = col.toLowerCase().includes('time') || col.toLowerCase().includes('at') || col === 'CreatedAt' || col === 'UpdatedAt';
                        return (
                          <TableCell key={col} style={{ width: colWidths[col] || 200, left: leftPos }} className={cn("px-4 py-3 text-sm border-r border-slate-100/30 truncate relative transition-colors", isSticky && (selectedIds.includes(row.Id) ? "sticky z-10 bg-blue-50" : "sticky z-10 bg-white group-hover:bg-slate-50/50"), selectedIds.includes(row.Id) && !isSticky && "bg-blue-50")}>
                            {col === 'status' ? (
                              <Select defaultValue={val} onValueChange={(v) => handleInlineUpdate(row.Id, col, v)}>
                                <SelectTrigger className={cn("h-7 w-auto min-w-[80px] font-bold uppercase tracking-tighter text-[10px] px-2 py-0.5 rounded-full border shadow-none", getStatusColor(val))}><SelectValue /></SelectTrigger>
                                <SelectContent>{STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : col === 'type' ? (
                              <Select defaultValue={val} onValueChange={(v) => handleInlineUpdate(row.Id, col, v)}>
                                <SelectTrigger className={cn("h-7 w-auto min-w-[80px] font-bold uppercase tracking-tighter text-[10px] px-2 py-0.5 rounded-full border shadow-none", getTypeColor(val))}><SelectValue /></SelectTrigger>
                                <SelectContent>{TYPE_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : col === 'timezone' ? (
                              <Select defaultValue={val} onValueChange={(v) => handleInlineUpdate(row.Id, col, v)}>
                                <SelectTrigger className="h-7 w-full text-[11px] px-2 rounded-lg border-slate-200 shadow-none bg-white/50"><SelectValue /></SelectTrigger>
                                <SelectContent>{TIMEZONE_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : col === 'ACC' ? (
                              <div className={cn("h-9 w-9 rounded-full font-bold grid place-items-center text-xs border border-transparent shadow-none", getAccountColor(row.Id).text, getAccountColor(row.Id).bg)}>{getInitials(row.name)}</div>
                            ) : isDate ? (
                              <span className="text-slate-600 font-medium truncate block">{formatDate(val)}</span>
                            ) : (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="truncate cursor-text hover:bg-slate-100/50 rounded transition-colors w-full group/cell relative">
                                    {val || <span className="text-slate-300 italic">empty</span>}
                                    <div className="absolute inset-0 z-50 opacity-0 group-hover/cell:opacity-100 transition-opacity bg-slate-900/90 text-white p-2 rounded text-xs pointer-events-none whitespace-normal break-words min-w-[200px] -top-1 left-full ml-2 shadow-xl border border-slate-700 hidden group-hover/cell:block">{val || "No content"}</div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto max-w-[500px] p-2 bg-white shadow-xl border border-slate-200">
                                  <div className="flex flex-col gap-2">
                                    <Textarea 
                                      className="border-none focus-visible:ring-0 shadow-none p-0 h-auto text-sm w-full bg-transparent resize-none min-h-[20px]"
                                      defaultValue={val}
                                      autoFocus
                                      onInput={(e) => { const target = e.target as HTMLTextAreaElement; target.style.height = 'auto'; target.style.height = target.scrollHeight + 'px'; }}
                                      onBlur={(e) => { const target = e.target as HTMLTextAreaElement; if(target.value !== val) handleInlineUpdate(row.Id, col, target.value); }}
                                      onKeyDown={(e) => { 
                                        if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
                                        if(e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                                      }}
                                    />
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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

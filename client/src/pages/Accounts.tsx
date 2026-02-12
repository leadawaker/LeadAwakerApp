import { useEffect, useState, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, RefreshCw, Save, Eye, 
  Building2, LayoutGrid, Filter, ChevronUp, ChevronDown,
  Globe, Phone, Mail, FileText, Clock, 
  Briefcase, Hash, Link as LinkIcon, User, Tag, Activity,
  Database, Zap, MoreHorizontal
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";

interface Row {
  Id: number;
  [key: string]: any;
}


const TruncatedCell = ({ value }: { value: any }) => {
  const text = value ? String(value) : "";

  return (
    <div
      className="truncate w-full"
      title={text}
    >
      {text}
    </div>
  );
};
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
const TIMEZONE_OPTIONS = [
  "UTC", 
  "Europe/London", 
  "Europe/Paris", 
  "Europe/Berlin", 
  "Europe/Amsterdam",
  "America/New_York", 
  "America/Los_Angeles", 
  "America/Sao_Paulo", 
  "Asia/Tokyo", 
  "Asia/Dubai"
];

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

  const [activeView, setActiveView] = useState("Default View");
  const VIEWS = ["Default View", "Sales Pipeline", "Customer Success", "Admin Dashboard"];

  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<string>("Type");
  const [rowSpacing, setRowSpacing] = useState<"tight" | "medium" | "spacious">("medium");
  const [showVerticalLines, setShowVerticalLines] = useState(true);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>(() => {
    const saved = localStorage.getItem("accounts_sort");
    return saved ? JSON.parse(saved) : { key: '', direction: null };
  });
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const finalFilteredRows = useMemo(() => {
    return rows.filter(row => {
      const matchesFilter = Object.entries(filterConfig).every(([col, val]) => {
        if (!val) return true;
        return String(row[col] || "").toLowerCase().includes(val.toLowerCase());
      });
      const matchesSearch = !searchTerm || Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [rows, filterConfig, searchTerm]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      let direction: 'asc' | 'desc' | null = 'asc';
      if (prev.key === key) {
        if (prev.direction === 'asc') direction = 'desc';
        else if (prev.direction === 'desc') direction = null;
      }
      const newSort = { key, direction };
      localStorage.setItem("accounts_sort", JSON.stringify(newSort));
      return newSort;
    });
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig.direction || !sortConfig.key) return [...finalFilteredRows];
    return [...finalFilteredRows].sort((a, b) => {
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
  }, [finalFilteredRows, sortConfig]);

  const groupedRows = useMemo(() => {
    if (groupBy === "None") return { "All": sortedRows };
    const groups: Record<string, Row[]> = {};
    const field = groupBy.toLowerCase();
    sortedRows.forEach(row => {
      const val = row[field] || "Unknown";
      if (!groups[val]) groups[val] = [];
      groups[val].push(row);
    });
    return groups;
  }, [sortedRows, groupBy]);

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds]);

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
        let ordered: string[] = ["Id", "Image"];

        if (allKeys.includes("name")) ordered.push("name");
        const techCols = ["twilio_account_sid", "twilio_auth_token", "twilio_messaging_service_sid", "twilio_default_from_number", "webhook_url", "webhook_secret", "max_daily_sends"];
        if (allKeys.includes("status")) ordered.push("status");
        if (allKeys.includes("type")) ordered.push("type");
        if (allKeys.includes("owner_email")) ordered.push("owner_email");
        if (allKeys.includes("phone")) ordered.push("phone");
        if (allKeys.includes("business_niche")) ordered.push("business_niche");
        if (allKeys.includes("website")) ordered.push("website");
        if (allKeys.includes("notes")) ordered.push("notes");
        if (allKeys.includes("timezone")) ordered.push("timezone");
        allKeys.forEach(k => { if (!ordered.includes(k) && !techCols.includes(k) && !["created_at", "updated_at", "Created Time", "Last Modified Time", "Id", "Account ID"].includes(k)) ordered.push(k); });
        techCols.forEach(k => { if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k); });
        const middleCols = ["Leads", "Campaigns", "Automation Logs", "Users", "Prompt Libraries", "Tags"];
        middleCols.forEach(k => { if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k); });
        ["Created Time", "Last Modified Time"].forEach(k => { if (allKeys.includes(k)) ordered.push(k); });
        
        const finalCols = ["Id", ...ordered.filter(c => c !== "Id" && !HIDDEN_FIELDS.includes(c))];
        setColumns(finalCols);
        setVisibleColumns(finalCols);
        
        const savedWidths = localStorage.getItem("accounts_col_widths");
        const initialWidths: { [key: string]: number } = savedWidths ? JSON.parse(savedWidths) : {};
        finalCols.forEach(col => {
          if (!initialWidths[col]) {
            if (col === 'Id' || col === 'Account ID') initialWidths[col] = 80;
            else if (col === 'Image') initialWidths[col] = 60;
            else if (SMALL_WIDTH_COLS.includes(col)) initialWidths[col] = 120;
            else initialWidths[col] = 180; 
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

  const handleInlineUpdate = async (rowId: number, col: string, value: any) => {
    if (NON_EDITABLE_FIELDS.includes(col)) return;
    const cleanValue = value === null || value === undefined ? "" : value;
    
    const idsToUpdate = selectedIds.includes(rowId) ? selectedIds : [rowId];
    
    setRows(prev => prev.map(r => idsToUpdate.includes(r.Id) ? { ...r, [col]: cleanValue } : r));
    if (detailRow && idsToUpdate.includes(detailRow.Id)) setDetailRow(prev => prev ? { ...prev, [col]: cleanValue } : null);

    try {
      const updatePromises = idsToUpdate.map(id => 
        fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [col]: cleanValue }),
        })
      );
      
      const results = await Promise.all(updatePromises);
      if (results.some(res => !res.ok)) {
        throw new Error("Some updates failed");
      }
      toast({ title: "Updated", description: `Saved changes for ${idsToUpdate.length} record(s).` });
    } catch (err) {
      toast({ variant: "destructive", title: "Sync Error", description: "Failed to save to database." });
      fetchData();
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const deletePromises = selectedIds.map(id => 
        fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, {
          method: "DELETE",
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
      const res = await fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}`, {
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
    if (selectedIds.length === sortedRows.length) setSelectedIds([]);
    else setSelectedIds(sortedRows.map(r => r.Id));
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

  const getAccountColor = (id: number) => initialsColors[id % initialsColors.length];

  const handleExportCSV = () => {
    const headers = columns.filter(c => visibleColumns.includes(c));
    const csvRows = sortedRows.map(row => headers.map(header => JSON.stringify(row[header] || "")).join(","));
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

  const getIconForField = (col: string) => {
    const c = col.toLowerCase();
    if (c === "name") return <Building2 className="h-3.5 w-3.5" />;
    if (c.includes("email")) return <Mail className="h-3.5 w-3.5" />;
    if (c.includes("phone")) return <Phone className="h-3.5 w-3.5" />;
    if (c.includes("status")) return <Activity className="h-3.5 w-3.5" />;
    if (c.includes("type")) return <Briefcase className="h-3.5 w-3.5" />;
    if (c.includes("website")) return <Globe className="h-3.5 w-3.5" />;
    if (c.includes("notes")) return <FileText className="h-3.5 w-3.5" />;
    if (c.includes("timezone")) return <Clock className="h-3.5 w-3.5" />;
    if (c.includes("twilio")) return <Zap className="h-3.5 w-3.5" />;
    if (c.includes("webhook")) return <LinkIcon className="h-3.5 w-3.5" />;
    if (c.includes("user")) return <User className="h-3.5 w-3.5" />;
    if (c.includes("tag")) return <Tag className="h-3.5 w-3.5" />;
    if (c.includes("id")) return <Hash className="h-3.5 w-3.5" />;
    if (c.includes("time") || c.includes("at")) return <Clock className="h-3.5 w-3.5" />;
    return <Database className="h-3.5 w-3.5" />;
  };

  const formatHeader = (col: string, idx: number) => {
    let title = col;
    if (col === "name") title = "Company Name";
    else if (col === "Account ID") title = "ID";
    else title = col.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    return (
      <div 
        className="flex items-center gap-2 group cursor-grab active:cursor-grabbing" 
        onClick={() => handleSort(col)}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("colIdx", idx.toString());
          setDraggedColIdx(idx);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const fromIdx = parseInt(e.dataTransfer.getData("colIdx"));
          const toIdx = idx;
          if (fromIdx === toIdx) return;
          const newCols = [...visibleColumns];
          const [moved] = newCols.splice(fromIdx, 1);
          newCols.splice(toIdx, 0, moved);
          setVisibleColumns(newCols);
          setDraggedColIdx(null);
        }}
      >
        <span className="text-slate-400 group-hover:text-blue-500 transition-colors">{getIconForField(col)}</span>
        <div className="truncate" title={title}>
          {title}
        </div>
        {sortConfig.key === col && (
          <span className="text-blue-500 ml-auto">
            {sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </div>
    );
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // Handle business hours format HH:mm:ss -> HH:mm
        if (typeof dateStr === 'string' && dateStr.includes(':')) {
          const parts = dateStr.split(':');
          if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
        }
        return dateStr;
      }

      // Check if it's a date or just time
      const isOnlyTime = typeof dateStr === 'string' && dateStr.length <= 8 && dateStr.includes(':');
      if (isOnlyTime) {
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
      }

      const day = date.getDate().toString().padStart(2, "0");
      const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
      const month = months[date.getMonth()];
      const year = date.getFullYear().toString().slice(-2);
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");

      const today = new Date();
      const isToday = date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear();

      return (
        <span className={isToday ? "text-blue-500 font-bold" : "text-slate-400"}>
          {day}/{month}/{year} {hours}:{minutes}
        </span>
      );
    } catch (e) {
      return dateStr;
    }
  };

  const rowPadding = {
    tight: "py-2",
    medium: "py-4",
    spacious: "py-8"
  }[rowSpacing];

  const timezoneColors: Record<string, { text: string, bg: string, border: string }> = {
    "UTC": { text: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
    "Europe/London": { text: "text-blue-700", bg: "bg-blue-100", border: "border-blue-200" },
    "Europe/Paris": { text: "text-indigo-700", bg: "bg-indigo-100", border: "border-indigo-200" },
    "Europe/Berlin": { text: "text-purple-700", bg: "bg-purple-100", border: "border-purple-200" },
    "Europe/Amsterdam": { text: "text-orange-700", bg: "bg-orange-100", border: "border-orange-200" },
    "America/New_York": { text: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-200" },
    "America/Los_Angeles": { text: "text-rose-700", bg: "bg-rose-100", border: "border-rose-200" },
    "America/Sao_Paulo": { text: "text-green-700", bg: "bg-green-100", border: "border-green-200" },
    "Asia/Tokyo": { text: "text-red-700", bg: "bg-red-100", border: "border-red-200" },
    "Asia/Dubai": { text: "text-amber-700", bg: "bg-amber-100", border: "border-amber-200" },
  };

  const getGroupColor = (name: string) => {
    if (groupBy.toLowerCase() === 'type') {
      return name.toLowerCase() === 'agency' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (groupBy.toLowerCase() === 'status') {
      const colors = statusColors[name] || statusColors["Unknown"];
      return `${colors.bg} ${colors.text} ${colors.border}`;
    }
    if (groupBy.toLowerCase() === 'timezone') {
      const colors = timezoneColors[name] || timezoneColors["UTC"];
      return `${colors.bg} ${colors.text} ${colors.border}`;
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const handleResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.pageX;
    const startWidth = colWidths[col] || 180;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.pageX - startX;
      const newWidth = Math.max(50, startWidth + delta);
      setColWidths(prev => {
        const updated = { ...prev, [col]: newWidth };
        localStorage.setItem("accounts_col_widths", JSON.stringify(updated));
        return updated;
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.body.style.cursor = 'col-resize';
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="w-full mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 w-10 p-0 rounded-xl bg-white border-slate-200 shadow-none" onClick={fetchData}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>

          <Dialog open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none" disabled={selectedIds.length !== 1}>
                <Eye className="h-4 w-4" /> View
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg w-[400px]">
               {/* Detail content would go here if needed, but keeping it simple as requested */}
            </DialogContent>
          </Dialog>

          <Input 
            ref={searchInputRef}
            placeholder="Search accounts (Ctrl+K)" 
            className="w-[240px] h-10 rounded-xl bg-white shadow-none border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none relative">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {Object.values(filterConfig).filter(Boolean).length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-blue-600">
                    {Object.values(filterConfig).filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Filters</h4>
                  <Button variant="ghost" size="sm" onClick={() => setFilterConfig({})} className="h-8 text-xs">Clear all</Button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {columns.map(col => (
                    <div key={col} className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">{col}</label>
                      <Input 
                        placeholder={`Filter ${col}...`}
                        className="h-8 text-sm"
                        value={filterConfig[col] || ""}
                        onChange={(e) => setFilterConfig(prev => ({ ...prev, [col]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={activeView} onValueChange={setActiveView}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-white shadow-none border-slate-200 font-bold">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span>{activeView}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {VIEWS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-white shadow-none border-slate-200 font-bold">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>Group: {groupBy}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="None">No Grouping</SelectItem>
              <SelectItem value="Type">By Type</SelectItem>
              <SelectItem value="Status">By Status</SelectItem>
              <SelectItem value="Timezone">By Time Zone</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none">
                Fields
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <ScrollArea className="h-72">
                <div className="space-y-1">
                  {columns.map(col => (
                    <div key={col} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer" onClick={() => {
                        setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
                    }}>
                      <Checkbox checked={visibleColumns.includes(col)} />
                      <span className="text-sm font-medium">{col}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

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
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{col}</label>
                      {col === "status" ? (
                        <Select value={newRowData[col] || ""} onValueChange={(v) => setNewRowData(prev => ({ ...prev, [col]: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : col === "type" ? (
                        <Select value={newRowData[col] || ""} onValueChange={(v) => setNewRowData(prev => ({ ...prev, [col]: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : col === "timezone" ? (
                        <Select value={newRowData[col] || ""} onValueChange={(v) => setNewRowData(prev => ({ ...prev, [col]: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{TIMEZONE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input value={newRowData[col] || ""} onChange={(e) => setNewRowData(prev => ({ ...prev, [col]: e.target.value }))} className="bg-slate-50 border-slate-200" />
                      )}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 w-10 p-0 rounded-xl bg-white border-slate-200 shadow-none">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Plus className="h-4 w-4 mr-2" /> Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <Save className="h-4 w-4 mr-2" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={showVerticalLines} onCheckedChange={setShowVerticalLines}>
                Show Vertical Lines
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Row Spacing</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={rowSpacing} onValueChange={(v: any) => setRowSpacing(v)}>
                <DropdownMenuRadioItem value="tight">Tight</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="medium">Medium</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="spacious">Spacious</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleImportCSV} />
        </div>

        <div className="space-y-8">
          {Object.entries(groupedRows).map(([groupName, groupRows]) => (
            <div key={groupName} className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                  {groupBy === "None" ? `ALL ACCOUNTS - ${groupRows.length}` : `${groupName.toUpperCase()} - ${groupRows.length}`}
                </h2>
                {groupBy !== "None" && (
                  <Badge variant="outline" className={cn("font-bold uppercase tracking-wider text-[10px] px-2 py-0.5", getGroupColor(groupName))}>
                    {groupName} ({groupRows.length})
                  </Badge>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table className="table-fixed w-full">
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-b border-slate-200">
                      <TableHead className="w-[40px] px-4"><Checkbox checked={selectedIds.length === sortedRows.length} onCheckedChange={toggleSelectAll} /></TableHead>
                      {columns.filter(c => visibleColumns.includes(c)).map((col, idx) => (
                          <TableHead
                            key={col}
                            style={{ width: colWidths[col] }}
                            className={cn(
                              "relative px-4 text-[11px] font-black uppercase text-slate-500 tracking-wider overflow-hidden whitespace-nowrap text-ellipsis",
                              showVerticalLines && idx < visibleColumns.length - 1 && "border-r border-slate-100"
                            )}
                          >
                          {formatHeader(col, idx)}
                          <div 
                            className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500 z-10"
                            onMouseDown={(e) => handleResize(col, e)}
                          />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupRows.map((row) => (
                      <TableRow key={row.Id} id={`row-${row.Id}`} className={cn(
                        "group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0",
                        selectedIds.includes(row.Id) && "bg-blue-50/30 hover:bg-blue-50/50"
                      )}>
                        <TableCell className="px-4"><Checkbox checked={selectedIds.includes(row.Id)} onCheckedChange={() => toggleSelect(row.Id)} /></TableCell>
                        {columns.filter(c => visibleColumns.includes(c)).map((col, idx) => (
                            <TableCell
                              key={col}
                              style={{ width: colWidths[col] }}
                              className={cn(
                                "px-4 font-medium text-slate-600 transition-all overflow-hidden whitespace-nowrap text-ellipsis",
                                rowPadding,
                                showVerticalLines && idx < visibleColumns.length - 1 && "border-r border-slate-50"
                              )}
                            >
                            {col === "Image" || col === "ACC" ? (
                              <Sheet>
                                <SheetTrigger asChild>
                                  <div 
                                    className={cn(
                                      "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110",
                                      getAccountColor(row.Id).bg,
                                      getAccountColor(row.Id).text
                                    )}
                                  >
                                    {getInitials(row.name)}
                                  </div>
                                </SheetTrigger>
                                <SheetContent className="sm:max-w-lg w-[400px]">
                                  <SheetHeader className="border-b pb-6">
                                    <div className="flex items-center gap-4">
                                      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold", getAccountColor(row.Id).bg, getAccountColor(row.Id).text)}>
                                        {getInitials(row.name)}
                                      </div>
                                      <div>
                                        <SheetTitle className="text-xl">{row.name || "Account Details"}</SheetTitle>
                                        <SheetDescription>View and edit account information</SheetDescription>
                                      </div>
                                    </div>
                                  </SheetHeader>
                                  <ScrollArea className="h-[calc(100vh-140px)] py-6 pr-4">
                                    <div className="space-y-6">
                                      {columns.filter(c => !HIDDEN_FIELDS.includes(c)).map(c => (
                                        <div key={c} className="space-y-1.5">
                                          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                            {getIconForField(c)}
                                            <span>{c.replace(/_/g, ' ')}</span>
                                          </div>
                                          {NON_EDITABLE_FIELDS.includes(c) ? (
                                            <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-500 border border-slate-100">
                                              {c.toLowerCase().includes('time') || c.toLowerCase().includes('at') ? formatDate(row[c]) : row[c] || "-"}
                                            </div>
                                          ) : c === "status" ? (
                                            <Select value={row[c] || ""} onValueChange={(v) => handleInlineUpdate(row.Id, c, v)}>
                                              <SelectTrigger className="w-full bg-white border-slate-200"><SelectValue /></SelectTrigger>
                                              <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                            </Select>
                                          ) : c === "type" ? (
                                            <Select value={row[c] || ""} onValueChange={(v) => handleInlineUpdate(row.Id, c, v)}>
                                              <SelectTrigger className="w-full bg-white border-slate-200"><SelectValue /></SelectTrigger>
                                              <SelectContent>{TYPE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                            </Select>
                                          ) : c === "timezone" ? (
                                            <Select value={row[c] || ""} onValueChange={(v) => handleInlineUpdate(row.Id, c, v)}>
                                              <SelectTrigger className="w-full bg-white border-slate-200"><SelectValue /></SelectTrigger>
                                              <SelectContent>{TIMEZONE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                            </Select>
                                          ) : (
                                            <Input 
                                              value={row[c] || ""} 
                                              onChange={(e) => handleInlineUpdate(row.Id, c, e.target.value)}
                                              className="bg-white border-slate-200 focus:ring-blue-500"
                                            />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </SheetContent>
                              </Sheet>
                            ) : col === "status" ? (
                              <Select value={row[col] || ""} onValueChange={(v) => handleInlineUpdate(row.Id, col, v)}>
                                <SelectTrigger className={cn("h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-fit min-w-[100px]", statusColors[row[col]]?.bg, statusColors[row[col]]?.text)}>
                                  <div className="flex items-center gap-1.5">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", statusColors[row[col]]?.dot)} />
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">{o}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : ["Leads", "Campaigns", "Automation Logs", "Users", "Prompt Libraries", "Tags"].includes(col) ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors w-full">
                                    <Badge variant="secondary" className="font-normal">
                                      {row[col] ? (Array.isArray(row[col]) ? row[col].length : 1) : 0} {col.toLowerCase()}
                                    </Badge>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-2">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm border-b pb-1">{col}</h4>
                                    <div className="text-xs text-muted-foreground">
                                      {row[col] ? (
                                        <ul className="list-disc list-inside">
                                          {Array.isArray(row[col]) ? (
                                            row[col].map((item: any, i: number) => (
                                              <li key={i}>{typeof item === 'object' ? (item.Name || item.title || JSON.stringify(item)) : String(item)}</li>
                                            ))
                                          ) : (
                                            <li>{String(row[col])}</li>
                                          )}
                                        </ul>
                                      ) : (
                                        <p>No {col.toLowerCase()} connected to this account ID</p>
                                      )}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : col === "type" ? (
                              <Badge variant="outline" className={cn("font-bold uppercase tracking-wider text-[9px] border-none shadow-none", row[col]?.toLowerCase() === 'agency' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700')}>
                                {row[col] || "Unknown"}
                              </Badge>
                            ) : col === "timezone" ? (
                              <Select value={row[col] || ""} onValueChange={(v) => handleInlineUpdate(row.Id, col, v)}>
                                <SelectTrigger className={cn("h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-fit min-w-[120px]", timezoneColors[row[col]]?.bg, timezoneColors[row[col]]?.text)}>
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" />
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>{TIMEZONE_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">{o}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : ["Created Time", "Last Modified Time", "CreatedAt", "UpdatedAt", "created_at", "updated_at"].includes(col) ? (
                              <TruncatedCell value={formatDate(row[col])} />
                            ) : (
                              <Input 
                                defaultValue={row[col] || ""} 
                                onBlur={(e) => handleInlineUpdate(row.Id, col, e.target.value)}
                                className="h-8 border-none bg-transparent shadow-none hover:bg-slate-100/50 transition-colors focus:bg-white focus:ring-1 focus:ring-blue-200 px-2 text-sm w-full truncate"
                              />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>Delete {selectedIds.length} records? This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
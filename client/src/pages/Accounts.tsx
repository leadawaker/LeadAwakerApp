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

const NOCODB_BASE_URL = "https://nocodb.leadawaker.com/api/v2";
const TABLE_ID = "m8hflvkkfj25aio";
const NOCODB_TOKEN = "2dHOteiGjwqUTj35QyZd932j-QwxJSlUeEXCTaLp";

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
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        headers: { "xc-token": NOCODB_TOKEN },
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      const list = data.list || [];
      setRows(list);
      
      if (list.length > 0) {
        const allKeys = Object.keys(list[0]);
        const keys = allKeys.filter(k => 
          !HIDDEN_FIELDS.includes(k) &&
          !["Id", "Automation Logs", "Prompt Libraries"].includes(k)
        );
        
        const savedOrder = localStorage.getItem("accounts_column_order");
        let ordered: string[] = savedOrder ? JSON.parse(savedOrder) : ["ACC"];

        if (!savedOrder) {
          if (keys.includes("name")) ordered.push("name");
          if (allKeys.includes("Account ID")) ordered.push("Account ID");
          if (allKeys.includes("Id")) ordered.push("Id");

          const techCols = [
            "twilio_account_sid", "twilio_auth_token", "twilio_messaging_service_sid", 
            "twilio_default_from_number", "webhook_url", "webhook_secret", "max_daily_sends"
          ];

          if (keys.includes("status")) ordered.push("status");
          if (keys.includes("type")) ordered.push("type");
          if (keys.includes("owner_email")) ordered.push("owner_email");
          if (keys.includes("phone")) ordered.push("phone");
          if (keys.includes("business_niche")) ordered.push("business_niche");
          if (keys.includes("website")) ordered.push("website");
          if (keys.includes("notes")) ordered.push("notes");
          if (keys.includes("timezone")) ordered.push("timezone");
          
          keys.forEach(k => {
            if (!ordered.includes(k) && !techCols.includes(k) && !["created_at", "updated_at", "Created Time", "Last Modified Time"].includes(k)) {
              ordered.push(k);
            }
          });

          techCols.forEach(k => {
            if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k);
          });
          
          const middleCols = [
            "number of leads", "number of campaigns", "Leads", "Campaigns", 
            "Interactions", "Users", "Prompt Libraries", "Tags", "Automation Logs"
          ];

          middleCols.forEach(k => {
            if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k);
          });

          ["Created Time", "Last Modified Time"].forEach(k => {
            if (allKeys.includes(k)) ordered.push(k);
          });
        }

        setColumns(ordered);
        if (visibleColumns.length === 0) {
          setVisibleColumns(ordered);
        }
        
        const initialWidths: { [key: string]: number } = {};
        ordered.forEach(col => {
          if (col === 'Id' || col === 'ACC' || col === 'Account ID') initialWidths[col] = 40;
          else if (SMALL_WIDTH_COLS.includes(col)) initialWidths[col] = 70;
          else initialWidths[col] = 140; 
        });
        setColWidths(initialWidths);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error fetching data", description: "Could not connect to NocoDB." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (visibleColumns.length > 0) {
      localStorage.setItem("accounts_visible_columns", JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);

  useEffect(() => {
    if (columns.length > 0) {
      localStorage.setItem("accounts_column_order", JSON.stringify(columns));
    }
  }, [columns]);

  const filteredRows = statusFilter === "All" ? rows : rows.filter(r => r.status === statusFilter);

  const toggleColumnVisibility = (col: string) => {
    const colIdx = columns.indexOf(col);
    if (colIdx >= 0 && colIdx < 4) return;
    setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const handleDragStart = (idx: number) => {
    if (idx < 4) return;
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || idx < 4 || draggedIdx === idx) return;
    
    const newColumns = [...columns];
    const item = newColumns.splice(draggedIdx, 1)[0];
    newColumns.splice(idx, 0, item);
    setColumns(newColumns);
    setDraggedIdx(idx);
  };

  const handleInlineUpdate = async (rowId: number, col: string, value: any) => {
    if (NON_EDITABLE_FIELDS.includes(col)) return;
    const payload = { Id: rowId, [col]: value };
    try {
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "xc-token": NOCODB_TOKEN },
        body: JSON.stringify([payload]),
      });
      if (!res.ok) throw new Error("Update failed");
      setRows(prev => prev.map(r => r.Id === rowId ? { ...r, [col]: value } : r));
      toast({ title: "Updated", description: "Changes saved to NocoDB." });
    } catch (err) {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not save changes to NocoDB." });
      fetchData();
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const deletePromises = selectedIds.map(id => 
        fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "xc-token": NOCODB_TOKEN },
          body: JSON.stringify({ Id: id }),
        })
      );
      await Promise.all(deletePromises);
      toast({ title: "Deleted", description: `Successfully deleted ${selectedIds.length} records.` });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      toast({ variant: "destructive", title: "Delete Failed", description: "Could not delete records." });
    } finally {
      setLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCreateRow = async () => {
    try {
      const cleanData: any = {};
      Object.keys(newRowData).forEach(key => {
        if (!NON_EDITABLE_FIELDS.includes(key) && !HIDDEN_FIELDS.includes(key)) {
          cleanData[key] = newRowData[key];
        }
      });
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "xc-token": NOCODB_TOKEN },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Creation failed");
      toast({ title: "Success", description: "New account created." });
      setIsCreateOpen(false);
      setNewRowData({});
      fetchData();
    } catch (err) {
      toast({ variant: "destructive", title: "Creation Failed", description: "Could not create the new record." });
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
    const bgColors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-orange-500'];
    return { bg: bgColors[id % bgColors.length] };
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name[0] + (name[1] || name[0])).toUpperCase();
  };

  const handleResize = (col: string, width: number) => {
    setColWidths(prev => ({ ...prev, [col]: width }));
  };

  return (
    <div className="w-full h-full bg-transparent pb-12 px-0 overflow-y-auto pt-4">
      <div className="w-full mx-auto space-y-6">
        <div className="flex items-center gap-3 px-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-white shadow-none border-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              {STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>

          {selectedIds.length > 0 && (
            <Button variant="destructive" className="h-10 rounded-xl gap-2 font-bold" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete Selected ({selectedIds.length})
            </Button>
          )}

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
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{col.replace(/_/g, ' ')}</label>
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

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none">
                <Eye className="h-4 w-4" /> Fields
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-2">
              <ScrollArea className="h-80">
                <div className="space-y-1">
                  {columns.map((col, idx) => {
                    const isProtected = idx < 4;
                    return (
                      <div 
                        key={col} 
                        className={cn("flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 group", !visibleColumns.includes(col) && "opacity-50")}
                        draggable={!isProtected}
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={() => setDraggedIdx(null)}
                      >
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                          {!isProtected && <GripVertical className="h-3 w-3 text-slate-400 cursor-grab shrink-0" />}
                          <span className="text-sm font-medium truncate">{col.replace(/_/g, ' ')}</span>
                        </div>
                        <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", isProtected && "hidden")} onClick={() => toggleColumnVisibility(col)}>
                          <Eye className={cn("h-3 w-3", !visibleColumns.includes(col) && "text-slate-300")} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="h-10 w-10 rounded-xl bg-white border-slate-200 shadow-none">
            <RefreshCw className={cn("h-4 w-4 text-slate-400", loading && "animate-spin")} />
          </Button>
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
                      style={{ 
                        width: colWidths[col] || 200,
                        left: idx < 3 ? (40 + columns.filter(c => visibleColumns.includes(c)).slice(0, idx).reduce((acc, c) => acc + (colWidths[c] || 200), 0)) : undefined
                      }}
                      className={cn("px-4 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap border-r border-slate-100/50 relative group table-fixed", col === "Id" && "text-center", idx < 3 && "sticky z-30 bg-slate-50")}
                    >
                      <div className="flex items-center justify-between overflow-hidden">
                        <span className="truncate">{col === "name" ? "Company Name" : col === "Account ID" ? "ID" : col.replace(/_/g, ' ')}</span>
                        <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10" onMouseDown={(e) => {
                          const startX = e.pageX; const startWidth = colWidths[col] || 200;
                          const onMouseMove = (me: MouseEvent) => handleResize(col, Math.max(50, startWidth + (me.pageX - startX)));
                          const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
                          document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
                        }} />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow><TableCell colSpan={columns.length + 1} className="h-96 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40" /></TableCell></TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.Id} className={cn("group transition-colors", selectedIds.includes(row.Id) ? "bg-blue-50/50" : "hover:bg-slate-50/50")}>
                      <TableCell className="w-10 px-0 border-r border-slate-100/30 sticky left-0 z-10 bg-inherit"><div className="flex justify-center"><Checkbox checked={selectedIds.includes(row.Id)} onCheckedChange={() => toggleSelect(row.Id)} /></div></TableCell>
                      {columns.filter(c => visibleColumns.includes(c)).map((col, idx) => {
                        const val = row[col]; const isSticky = idx < 3;
                        const leftPos = isSticky ? (40 + columns.filter(c => visibleColumns.includes(c)).slice(0, idx).reduce((acc, c) => acc + (colWidths[c] || 200), 0)) : undefined;
                        return (
                          <TableCell key={col} style={{ width: colWidths[col] || 200, left: leftPos }} className={cn("px-4 py-3 text-sm border-r border-slate-100/30 truncate", isSticky && "sticky z-10 bg-inherit")}>
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className="truncate cursor-pointer hover:bg-slate-100/50 rounded px-1 -mx-1 transition-colors">
                                  {col === 'status' ? <Badge className={cn("font-bold uppercase tracking-tighter text-[10px] px-2 py-0.5 rounded-full border shadow-none", getStatusColor(val))}>{val || "Unknown"}</Badge> : 
                                   col === 'type' ? <Badge className={cn("font-bold uppercase tracking-tighter text-[10px] px-2 py-0.5 rounded-full border shadow-none", getTypeColor(val))}>{val || "Client"}</Badge> : 
                                   col === 'ACC' ? <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-none", getAccountColor(row.Id).bg)}>{getInitials(row.name)}</div> : val}
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-4">
                                <div className="space-y-4">
                                  <h4 className="font-bold text-sm">Edit {col.replace(/_/g, ' ')}</h4>
                                  {!NON_EDITABLE_FIELDS.includes(col) ? (
                                    <div className="space-y-2">
                                      {col === 'status' ? (
                                        <Select defaultValue={val} onValueChange={(v) => handleInlineUpdate(row.Id, col, v)}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>{STATUS_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                        </Select>
                                      ) : col === 'type' ? (
                                        <Select defaultValue={val} onValueChange={(v) => handleInlineUpdate(row.Id, col, v)}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>{TYPE_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                                        </Select>
                                      ) : (
                                        <Input defaultValue={val} onBlur={(e) => { if(e.target.value !== val) handleInlineUpdate(row.Id, col, e.target.value); }} />
                                      )}
                                    </div>
                                  ) : <p className="text-xs text-muted-foreground">This field is read-only.</p>}
                                </div>
                              </PopoverContent>
                            </Popover>
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
      </div>
    </div>
  );
}

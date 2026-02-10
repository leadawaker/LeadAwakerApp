import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RefreshCw, Save, X, Edit2, Trash2, AlertCircle } from "lucide-react";
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

// SYSTEM_FIELDS stays as-is or can be simplified to just labels used in your table
const SYSTEM_FIELDS = ["created_at", "updated_at", "Created Time", "Last Modified Time"];

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
  "Id",            // hide Id from popup
  "Account ID",
  "ID",
  "account_id",
  "Automation Logs",
  "Prompt Libraries",
  "CreatedAt",
  "UpdatedAt",
  "created_at",
  "updated_at",
  "Created Time",
  "Last Modified Time"
];

const STATUS_OPTIONS = ["Active", "Inactive", "Trial", "Suspended", "Unknown"];
const TYPE_OPTIONS = ["Agency", "Client"];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Amsterdam",
  "Asia/Tokyo",
  "UTC"
];

export default function TestTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [newRowData, setNewRowData] = useState<Partial<Row>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [cellEditing, setCellEditing] = useState<{ rowId: number, col: string } | null>(null);
  const [colWidths, setColWidths] = useState<{ [key: string]: number }>({});
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
          // we will add Id manually and show Created/LastModified only in table
          !["Id", "Automation Logs", "Prompt Libraries"].includes(k)
        );
        const ordered: string[] = ["Id"];
        if (keys.includes("name")) ordered.push("name");
        
        // Status, Type, Owner email, Phone, Business Niche, Website, Notes, Timezone
        if (keys.includes("status")) ordered.push("status");
        if (keys.includes("type")) ordered.push("type");
        if (keys.includes("owner_email")) ordered.push("owner_email");
        if (keys.includes("phone")) ordered.push("phone");
        if (keys.includes("business_niche")) ordered.push("business_niche");
        if (keys.includes("website")) ordered.push("website");
        if (keys.includes("notes")) ordered.push("notes");
        if (keys.includes("timezone")) ordered.push("timezone");

        const techCols = [
          "twilio_account_sid", 
          "twilio_auth_token", 
          "twilio_messaging_service_sid", 
          "twilio_default_from_number",
          "webhook_url",
          "webhook_secret",
          "max_daily_sends"
        ];
        
        // Leads, Campaigns, Interactions, Users, Tags after Max Daily Sends
        const middleCols = [
          "number of leads",
          "number of campaigns",
          "Leads",
          "Campaigns",
          "Interactions",
          "Automation Logs",
          "Users",
          "Tags",
          "Prompt Libraries"
        ];

        keys.forEach(k => {
          if (!ordered.includes(k) && !techCols.includes(k) && !SYSTEM_FIELDS.includes(k) && !middleCols.includes(k)) {
            ordered.push(k);
          }
        });

        // Add tech stuff including max_daily_sends
        techCols.forEach(k => {
          if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k);
        });

        // Add middle cols in order (Leads, Campaigns, Interactions, Users, Tags)
        middleCols.forEach(k => {
          if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k);
        });

        // Add requested time fields at the very end
        ["Created Time", "Last Modified Time"].forEach(k => {
          if (allKeys.includes(k)) ordered.push(k);
        });

        setColumns(ordered);
        
        // Initialize widths
        const initialWidths: { [key: string]: number } = {};
        ordered.forEach(col => {
          if (col === 'Id') initialWidths[col] = 60;
          else if (SMALL_WIDTH_COLS.includes(col)) initialWidths[col] = 100;
          else initialWidths[col] = 200; // Default size
        });
        setColWidths(initialWidths);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: "Could not connect to NocoDB.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInlineUpdate = async (rowId: number, col: string, value: any) => {
    if (NON_EDITABLE_FIELDS.includes(col)) return;
    const payload = { Id: rowId, [col]: value };
    try {
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "xc-token": NOCODB_TOKEN,
        },
        body: JSON.stringify([payload]),
      });

      if (!res.ok) throw new Error("Update failed");
      
      setRows(prev => prev.map(r => r.Id === rowId ? { ...r, [col]: value } : r));
      toast({ title: "Updated", description: "Changes saved to NocoDB." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save changes to NocoDB.",
      });
      fetchData();
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const deletePromises = selectedIds.map(id => 
        fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "xc-token": NOCODB_TOKEN,
          },
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
      // Clean data for creation - remove all non-editable/system fields
      const cleanData: any = {};
      Object.keys(newRowData).forEach(key => {
        if (!NON_EDITABLE_FIELDS.includes(key) && !HIDDEN_FIELDS.includes(key)) {
          cleanData[key] = newRowData[key];
        }
      });

      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xc-token": NOCODB_TOKEN,
        },
        body: JSON.stringify(cleanData),
      });

      if (!res.ok) throw new Error("Creation failed");

      toast({ title: "Success", description: "New account created." });
      setIsCreateOpen(false);
      setNewRowData({});
      fetchData();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: "Could not create the new record.",
      });
    }
  };

  const handleSaveEditDialog = async () => {
    if (!editingRow) return;
    try {
      // Filter out system fields to avoid NocoDB errors
      const { Id, ...rest } = editingRow;
      const cleanData: any = { Id };
      Object.keys(rest).forEach(key => {
        // Only include fields that are actually editable
        if (!NON_EDITABLE_FIELDS.includes(key) && !HIDDEN_FIELDS.includes(key)) {
          cleanData[key] = rest[key];
        }
      });

      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "xc-token": NOCODB_TOKEN,
        },
        body: JSON.stringify([cleanData]),
      });
      if (!res.ok) throw new Error("Update failed");
      toast({ title: "Success", description: "Record updated." });
      setEditingRow(null);
      fetchData();
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update record." });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map(r => r.Id));
    }
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
    const textColors = ['text-blue-600', 'text-purple-600', 'text-pink-600', 'text-indigo-600', 'text-cyan-600', 'text-orange-600'];
    return { bg: bgColors[id % bgColors.length], text: textColors[id % textColors.length] };
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name[0] + (name[1] || name[0])).toUpperCase();
  };

  const formatDate = (dateStr: string, timezone: string = 'UTC') => {
    if (!dateStr) return "-";
    try {
      // If it's a time string like "17:00:00", just strip the seconds
      if (dateStr.includes(':') && !dateStr.includes('-') && !dateStr.includes('/')) {
        const parts = dateStr.split(':');
        if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
      }

      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      // Basic formatting as requested: 09/02/26 - 18:41
      const year = d.getFullYear().toString().slice(-2);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${day}/${month}/${year} - ${hours}:${minutes}`;
    } catch (e) {
      return dateStr;
    }
  };

  const handleResize = (col: string, width: number) => {
    setColWidths(prev => ({ ...prev, [col]: width }));
  };

  return (
    <div className="w-screen min-h-screen bg-[#f8fafc] pt-24 pb-12 px-4 md:px-12">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <div className="h-10 w-2 bg-primary rounded-full" />
              Accounts Command Center
            </h1>
            <p className="text-slate-500 font-medium">Real-time NocoDB management with inline editing.</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <Button 
                variant="destructive" 
                className="gap-2 font-bold animate-in fade-in slide-in-from-right-4"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedIds.length})
              </Button>
            )}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-lg shadow-primary/20 font-bold px-6">
                  <Plus className="h-4 w-4" />
                  New Record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl h-[calc(100vh-80px)] p-0 gap-0 overflow-hidden flex flex-col">
                <DialogHeader className="p-6 border-b">
                  <DialogTitle>Add New Account</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 p-6">
                  <div className="grid grid-cols-2 gap-4 pb-4">
                    {columns.filter(c => !NON_EDITABLE_FIELDS.includes(c) && !HIDDEN_FIELDS.includes(c) && !DISPLAY_ONLY_FIELDS.includes(c)).map(col => (
                      <div key={col} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{col.replace(/_/g, ' ')}</label>
                        {col === 'timezone' ? (
                          <Select onValueChange={(val) => setNewRowData(prev => ({ ...prev, [col]: val }))}>
                            <SelectTrigger className="bg-slate-50 border-slate-200">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMEZONES.map(tz => (
                                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : col === 'status' ? (
                          <Select onValueChange={(val) => setNewRowData(prev => ({ ...prev, [col]: val }))}>
                            <SelectTrigger className="bg-slate-50 border-slate-200">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : col === 'type' ? (
                          <Select onValueChange={(val) => setNewRowData(prev => ({ ...prev, [col]: val }))}>
                            <SelectTrigger className="bg-slate-50 border-slate-200">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={newRowData[col] || ""}
                            onChange={(e) => setNewRowData(prev => ({ ...prev, [col]: e.target.value }))}
                            className="bg-slate-50 border-slate-200"
                          />
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
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="bg-white">
              <RefreshCw className={cn("h-4 w-4 text-slate-400", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white overflow-hidden rounded-3xl">
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 px-6 border-r border-slate-100/50">
                    <div className="flex justify-center">
                      <Checkbox 
                        checked={selectedIds.length === rows.length && rows.length > 0} 
                        onCheckedChange={toggleSelectAll}
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-16 px-4 border-r border-slate-100/50">
                    <div className="flex justify-center text-[10px] font-black uppercase tracking-widest text-slate-400">Acc</div>
                  </TableHead>
                  {columns.map(col => (
                    <TableHead 
                      key={col} 
                      style={{ width: colWidths[col] || 200 }}
                      className={cn(
                        "px-4 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap border-r border-slate-100/50 relative group table-fixed"
                      )}
                    >
                      <div className="flex items-center justify-between overflow-hidden">
                        <span className="truncate">{col === "name" ? "Company Name" : col.replace(/_/g, ' ')}</span>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
                          onMouseDown={(e) => {
                            const startX = e.pageX;
                            const startWidth = colWidths[col] || 200;
                            const onMouseMove = (moveEvent: MouseEvent) => {
                              const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX));
                              handleResize(col, newWidth);
                            };
                            const onMouseUp = () => {
                              document.removeEventListener('mousemove', onMouseMove);
                              document.removeEventListener('mouseup', onMouseUp);
                            };
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                          }}
                        />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="h-96 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40" />
                    </TableCell>
                  </TableRow>
                ) : rows.map((row) => {
                  const colors = getAccountColor(row.Id);
                  return (
                    <TableRow 
                      key={row.Id} 
                      className={cn(
                        "group border-b border-slate-50 transition-all hover:bg-slate-50/50",
                        selectedIds.includes(row.Id) && "bg-primary/[0.01]"
                      )}
                    >
                      <TableCell className="px-6 border-r border-slate-100/50">
                        <div className="flex justify-center">
                          <Checkbox 
                            checked={selectedIds.includes(row.Id)} 
                            onCheckedChange={() => toggleSelect(row.Id)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 border-r border-slate-100/50">
                        <div className="flex justify-center">
                          <div 
                            className={cn(
                              "h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white cursor-pointer shadow-sm hover:scale-110 transition-transform",
                              colors.bg
                            )}
                            onClick={() => setEditingRow(row)}
                          >
                            {getInitials(row.name)}
                          </div>
                        </div>
                      </TableCell>
                      {columns.map(col => (
                        <TableCell 
                          key={col} 
                          style={{ width: colWidths[col] || 200 }}
                          className={cn(
                            "px-4 py-4 text-sm transition-all relative border-r border-slate-100/50",
                            col === "name" && "font-bold"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {col === 'Id' ? (
                              <span className="text-slate-400 font-mono text-xs">{row.Id}</span>
                            ) : (
                              <div className="w-full flex-1 min-w-0">
                                {col === "status" ? (
                                  <Select 
                                    defaultValue={row[col] || "Unknown"} 
                                    onValueChange={(val) => handleInlineUpdate(row.Id, col, val)}
                                  >
                                    <SelectTrigger className={cn("h-7 w-fit min-w-[100px] border-none shadow-none font-bold text-[10px] uppercase tracking-wider", getStatusColor(row[col]))}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STATUS_OPTIONS.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : col === "type" ? (
                                  <Select 
                                    defaultValue={row[col]} 
                                    onValueChange={(val) => handleInlineUpdate(row.Id, col, val)}
                                  >
                                    <SelectTrigger className={cn("h-7 w-fit min-w-[100px] border-none shadow-none font-bold text-[10px] uppercase tracking-wider", getTypeColor(row[col]))}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TYPE_OPTIONS.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : col === "timezone" ? (
                                  <Select 
                                    defaultValue={row[col]} 
                                    onValueChange={(val) => handleInlineUpdate(row.Id, col, val)}
                                  >
                                    <SelectTrigger className="h-7 w-full border-none shadow-none bg-transparent">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIMEZONES.map(tz => (
                                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : ["Created Time", "Last Modified Time"].includes(col) ? (
                                  <span className="text-blue-600 font-bold font-mono text-xs whitespace-nowrap block overflow-hidden text-ellipsis">
                                    {formatDate(row[col], row['timezone'])}
                                  </span>
                                ) : ["Automation Logs", "Prompt Libraries"].includes(col) ? (
                                  <span className="text-orange-500 font-bold text-xs whitespace-nowrap block overflow-hidden text-ellipsis">
                                    {row[col] || ""}
                                  </span>
                                ) : DISPLAY_ONLY_FIELDS.includes(col) ? (
                                  <span className="text-orange-500 font-bold text-xs whitespace-nowrap block overflow-hidden text-ellipsis">
                                    {row[col] || ""}
                                  </span>
                                ) : (
                                  <div 
                                    className={cn("min-h-[20px] w-full", !NON_EDITABLE_FIELDS.includes(col) && "cursor-text")}
                                    onClick={(e) => {
                                      if (NON_EDITABLE_FIELDS.includes(col)) return;
                                      e.stopPropagation();
                                      setCellEditing({ rowId: row.Id, col });
                                    }}
                                  >
                                    {cellEditing?.rowId === row.Id && cellEditing?.col === col ? (
                                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setCellEditing(null)}>
                                        <div 
                                          className="bg-white shadow-2xl rounded-xl border border-primary/20 ring-4 ring-primary/5 p-4 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs font-black uppercase text-slate-400 tracking-widest">{col.replace(/_/g, ' ')}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCellEditing(null)}>
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </div>
                                          <Textarea
                                            autoFocus
                                            defaultValue={row[col] || ""}
                                            className="flex-1 min-h-[120px] max-h-[70vh] w-full text-sm p-3 bg-slate-50 border-slate-200 focus-visible:ring-primary/20 resize-y"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Escape') setCellEditing(null);
                                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                const target = e.target as HTMLTextAreaElement;
                                                if (target.value !== row[col]) {
                                                  handleInlineUpdate(row.Id, col, target.value);
                                                }
                                                setCellEditing(null);
                                              }
                                            }}
                                          />
                                          <div className="flex justify-end gap-2 mt-4">
                                            <Button variant="ghost" size="sm" onClick={() => setCellEditing(null)}>Cancel</Button>
                                            <Button size="sm" onClick={(e) => {
                                              const container = (e.currentTarget.parentElement?.parentElement);
                                              const textarea = container?.querySelector('textarea');
                                              if (textarea && textarea.value !== row[col]) {
                                                handleInlineUpdate(row.Id, col, textarea.value);
                                              }
                                              setCellEditing(null);
                                            }}>Save</Button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="block truncate max-w-full" title={row[col] || ""}>
                                        {col.toLowerCase().includes('hour') || col.toLowerCase().includes('time') ? formatDate(row[col]) : (row[col] || "")}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.length} selected record(s)? This action is permanent and will remove the data from NocoDB.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingRow && (
        <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
          <DialogContent className="max-w-3xl h-[calc(100vh-80px)] p-0 gap-0 overflow-hidden flex flex-col">
            <DialogHeader className="p-6 border-b">
              <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                <Edit2 className="h-6 w-6 text-primary" />
                Edit Record
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 p-6">
              <div className="grid grid-cols-2 gap-6 pb-6">
                {columns.filter(c => !NON_EDITABLE_FIELDS.includes(c) && !HIDDEN_FIELDS.includes(c)).map(col => (
                  <div key={col} className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{col.replace(/_/g, ' ')}</label>
                    {col === 'timezone' ? (
                      <Select 
                        defaultValue={editingRow[col]} 
                        onValueChange={(val) => setEditingRow(prev => prev ? ({ ...prev, [col]: val }) : null)}
                      >
                        <SelectTrigger className="bg-slate-50 border-slate-200 h-11">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map(tz => (
                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : col === 'status' ? (
                      <Select 
                        defaultValue={editingRow[col]} 
                        onValueChange={(val) => setEditingRow(prev => prev ? ({ ...prev, [col]: val }) : null)}
                      >
                        <SelectTrigger className="bg-slate-50 border-slate-200 h-11">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : col === 'type' ? (
                      <Select 
                        defaultValue={editingRow[col]} 
                        onValueChange={(val) => setEditingRow(prev => prev ? ({ ...prev, [col]: val }) : null)}
                      >
                        <SelectTrigger className="bg-slate-50 border-slate-200 h-11">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={editingRow[col] || ""}
                        onChange={(e) => setEditingRow(prev => prev ? ({ ...prev, [col]: e.target.value }) : null)}
                        className="bg-slate-50 border-slate-200 h-11"
                      />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="p-6 border-t bg-slate-50/50">
              <Button variant="ghost" onClick={() => setEditingRow(null)} className="h-11 px-6">Cancel</Button>
              <Button onClick={handleSaveEditDialog} className="h-11 px-8 font-bold shadow-lg shadow-primary/20">
                <Save className="h-4 w-4 mr-2" />
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
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

interface Row {
  Id: number;
  [key: string]: any;
}

const NOCODB_BASE_URL = "https://nocodb.leadawaker.com/api/v2";
const TABLE_ID = "m8hflvkkfj25aio";
const NOCODB_TOKEN = "2dHOteiGjwqUTj35QyZd932j-QwxJSlUeEXCTaLp";

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
          k !== "Id" && 
          k !== "created_at" && 
          k !== "updated_at" && 
          k !== "Created Time" && 
          k !== "Last Modified Time"
        );
        
        // Custom order logic
        const ordered: string[] = [];
        
        // 1. Account ID (Id) is always first
        ordered.push("Id");
        
        if (keys.includes("name")) ordered.push("name");
        
        // Set number of leads and number of campaigns early
        if (keys.includes("number of leads")) ordered.push("number of leads");
        if (keys.includes("number of campaigns")) ordered.push("number of campaigns");
        
        if (keys.includes("owner_email")) ordered.push("owner_email");
        if (keys.includes("phone")) ordered.push("phone");
        
        // Set Business Niche after the phone number
        if (keys.includes("business_niche")) ordered.push("business_niche");
        
        const endCols = ["twilio_account_sid", "twilio_auth_token", "twilio_messaging_service_sid", "twilio_default_from_number", "webhook_url"];
        
        keys.forEach(k => {
          if (!ordered.includes(k) && !endCols.includes(k) && k !== "Id") {
            ordered.push(k);
          }
        });
        
        endCols.forEach(k => {
          if (keys.includes(k)) ordered.push(k);
        });

        setColumns(ordered);
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
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xc-token": NOCODB_TOKEN,
        },
        body: JSON.stringify(newRowData),
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
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "xc-token": NOCODB_TOKEN,
        },
        body: JSON.stringify([editingRow]),
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
      case 'suspended': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const getNameColor = (id: number) => {
    const colors = ['text-blue-600', 'text-purple-600', 'text-pink-600', 'text-indigo-600', 'text-cyan-600', 'text-orange-600'];
    return colors[id % colors.length];
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
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Account</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  {columns.filter(c => c !== "Id").map(col => (
                    <div key={col} className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{col.replace(/_/g, ' ')}</label>
                      <Input
                        value={newRowData[col] || ""}
                        onChange={(e) => setNewRowData(prev => ({ ...prev, [col]: e.target.value }))}
                        className="bg-slate-50 border-slate-200"
                      />
                    </div>
                  ))}
                </div>
                <DialogFooter>
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
            <Table>
              <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 px-6">
                    <Checkbox 
                      checked={selectedIds.length === rows.length && rows.length > 0} 
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  {columns.map(col => (
                    <TableHead key={col} className="px-4 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                      {col === "name" ? "Company Name" : col.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="h-96 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/40" />
                    </TableCell>
                  </TableRow>
                ) : rows.map((row) => (
                  <TableRow 
                    key={row.Id} 
                    className={cn(
                      "group border-b border-slate-50 transition-all hover:bg-slate-50/50",
                      selectedIds.includes(row.Id) && "bg-primary/[0.01]"
                    )}
                  >
                    <TableCell className="px-6">
                      <Checkbox 
                        checked={selectedIds.includes(row.Id)} 
                        onCheckedChange={() => toggleSelect(row.Id)}
                      />
                    </TableCell>
                    {columns.map(col => (
                      <TableCell 
                        key={col} 
                        className={cn(
                          "px-4 py-4 text-sm transition-all relative",
                          col === "name" && "font-bold cursor-pointer"
                        )}
                        onClick={() => {
                          if (col === "name") setEditingRow(row);
                        }}
                      >
                        {col === "status" ? (
                          <Badge variant="outline" className={cn("font-bold text-[10px] uppercase tracking-wider", getStatusColor(row[col]))}>
                            {row[col] || "Unknown"}
                          </Badge>
                        ) : col === "name" ? (
                          <span className={cn("hover:underline decoration-2 underline-offset-4 transition-all", getNameColor(row.Id))}>
                            {row[col]}
                          </span>
                        ) : (
                          <div 
                            className="min-h-[20px] w-full cursor-text"
                            onClick={(e) => {
                              if (col !== "name") {
                                e.stopPropagation();
                                setCellEditing({ rowId: row.Id, col });
                              }
                            }}
                          >
                            {cellEditing?.rowId === row.Id && cellEditing?.col === col ? (
                              <Input
                                autoFocus
                                defaultValue={row[col] || ""}
                                className="h-7 text-sm py-0 px-2 bg-white border-primary/30 focus-visible:ring-1 focus-visible:ring-primary/20"
                                onBlur={(e) => {
                                  if (e.target.value !== row[col]) {
                                    handleInlineUpdate(row.Id, col, e.target.value);
                                  }
                                  setCellEditing(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleInlineUpdate(row.Id, col, e.currentTarget.value);
                                    setCellEditing(null);
                                  }
                                  if (e.key === 'Escape') setCellEditing(null);
                                }}
                              />
                            ) : (
                              <span className="text-slate-600 truncate block max-w-[200px]" title={row[col]}>
                                {row[col] ?? <span className="text-slate-300 italic">-</span>}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
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
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                <Edit2 className="h-6 w-6 text-primary" />
                Edit Record
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6 py-6">
              {columns.map(col => (
                <div key={col} className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{col.replace(/_/g, ' ')}</label>
                  <Input
                    value={editingRow[col] || ""}
                    onChange={(e) => setEditingRow(prev => prev ? ({ ...prev, [col]: e.target.value }) : null)}
                    className="bg-slate-50 border-slate-200 h-11"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
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

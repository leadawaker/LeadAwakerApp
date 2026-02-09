import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RefreshCw, Save, X, Edit2, Maximize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface Row {
  Id: number;
  [key: string]: any;
}

const NOCODB_BASE_URL = "https://nocodb.leadawaker.com/api/v2";
const TABLE_ID = "m8hflvkkfj25aio";
const NOCODB_TOKEN = "2dHOteiGjwqUTj35QyZd932j-QwxJSlUeEXCTaLp";
const EDITABLE_COLUMNS = [
  "name",
  "owner_email",
  "phone",
  "website",
  "type",
  "timezone",
  "notes",
  "status",
  "business hours start",
  "business hours end",
  "max_daily_sends",
  "business_niche",
];
export default function TestTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [newRowData, setNewRowData] = useState<Partial<Row>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
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
        const keys = Object.keys(list[0]).filter(k => k !== "Id" && k !== "created_at" && k !== "updated_at");
        // Reorder columns: company name, owner email, then the rest
        const ordered = [];
        if (keys.includes("name")) ordered.push("name");
        if (keys.includes("owner_email")) ordered.push("owner_email");
        keys.forEach(k => {
          if (k !== "name" && k !== "owner_email") ordered.push(k);
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

  const handleSaveEdit = async () => {
    if (!editingRow) return;

    const payload: Record<string, any> = { Id: editingRow.Id };

    EDITABLE_COLUMNS.forEach((col) => {
      if (editingRow[col] !== undefined) {
        payload[col] = editingRow[col];
      }
    });

    try {
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "xc-token": NOCODB_TOKEN,
        },
        body: JSON.stringify([payload]),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("NocoDB PATCH error:", errText);
        throw new Error("Update failed");
      }

      toast({
        title: "Success",
        description: "Record updated successfully.",
      });

      setEditingRow(null);
      fetchData();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save changes to NocoDB.",
      });
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

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="w-screen min-h-screen bg-background pt-24 pb-6 px-4 md:px-8">
      <div className="flex flex-col gap-6 w-full">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Accounts Command Center</h1>
            <p className="text-muted-foreground">High-density data management with live NocoDB synchronization.</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm font-bold">
                  <Plus className="h-4 w-4" />
                  New Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Account</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  {columns.map(col => (
                    <div key={col} className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {col.replace(/_/g, ' ')}
                      </label>
                      <Input
                        value={newRowData[col] || ""}
                        onChange={(e) => setNewRowData(prev => ({ ...prev, [col]: e.target.value }))}
                        placeholder={`Enter ${col.replace(/_/g, ' ')}`}
                      />
                    </div>
                  ))}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateRow}>Create Account</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="shadow-sm">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </header>

        <Card className="shadow-2xl border-primary/5 overflow-hidden w-full">
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader className="bg-muted/50 border-b">
                  <TableRow>
                    {columns.map(col => (
                      <TableHead key={col} className="font-bold py-4 uppercase text-[10px] tracking-widest text-muted-foreground whitespace-nowrap px-4">
                        {col === "name" ? "Company Name" : col.replace(/_/g, ' ')}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold py-4 pr-6 sticky right-0 bg-muted/50 z-10 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)]">Actions</TableHead>
                  </TableRow>handleSaveEdit 
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="h-96 text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary/20" />
                        <p className="mt-4 text-sm font-medium text-muted-foreground">Synchronizing live data...</p>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="h-64 text-center">
                        <p className="text-muted-foreground italic">No records found.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.Id} className="group hover:bg-primary/[0.02] transition-colors border-b last:border-0">
                        {columns.map(col => (
                          <TableCell key={col} className="py-4 px-4 max-w-[200px]">
                            <div className="truncate text-sm font-medium text-foreground/80" title={row[col] || "-"}>
                              {row[col] ?? "-"}
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="text-right py-4 pr-6 sticky right-0 bg-background/80 backdrop-blur-sm group-hover:bg-primary/[0.02] z-10 transition-colors shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)]">
                          <Dialog open={editingRow?.Id === row.Id} onOpenChange={(open) => !open && setEditingRow(null)}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 text-primary"
                                onClick={() => setEditingRow(row)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <Edit2 className="h-5 w-5 text-primary" />
                                  Edit Record: {row.name}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
                                {columns.map(col => (
                                  <div key={col} className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                                      {col.replace(/_/g, ' ')}
                                    </label>
                                    <Input
                                      value={editingRow?.[col] || ""}
                                      onChange={(e) => setEditingRow(prev => prev ? ({ ...prev, [col]: e.target.value }) : null)}
                                      className="focus-visible:ring-primary/30 bg-muted/20"
                                    />
                                  </div>
                                ))}
                              </div>
                              <DialogFooter className="border-t pt-6 gap-2 sm:gap-0">
                                <Button variant="ghost" onClick={() => setEditingRow(null)}>
                                  <X className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveEdit} className="font-bold">
                                  <Save className="h-4 w-4 mr-2" />
                                  Save Changes
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

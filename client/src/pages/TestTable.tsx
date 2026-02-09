import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RefreshCw, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<Row>>({});
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
        // Extract all unique keys except Id and technical fields if any
        const keys = Object.keys(list[0]).filter(k => k !== "Id" && k !== "created_at" && k !== "updated_at");
        setColumns(keys);
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

  const handleEdit = (row: Row) => {
    setEditingId(row.Id);
    setEditValues(row);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleSave = async (id: number) => {
    try {
      const res = await fetch(`${NOCODB_BASE_URL}/tables/${TABLE_ID}/records`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "xc-token": NOCODB_TOKEN,
        },
        body: JSON.stringify({
          Id: id,
          ...editValues
        }),
      });

      if (!res.ok) throw new Error("Update failed");

      toast({ title: "Success", description: "Record updated successfully." });
      setEditingId(null);
      fetchData();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save changes to NocoDB.",
      });
    }
  };

  const handleInputChange = (col: string, value: string) => {
    setEditValues(prev => ({ ...prev, [col]: value }));
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl">
      <div className="flex flex-col gap-8">
        <header className="flex justify-between items-end border-b pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2 text-primary">Account Management</h1>
            <p className="text-muted-foreground">Real-time visualization and inline editing of all database fields.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2 shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Sync Data
          </Button>
        </header>

        <Card className="shadow-xl border-primary/5 overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-xl flex items-center gap-3">
              Accounts Database
              {rows.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 bg-primary/10 rounded-full text-primary border border-primary/20">
                  {rows.length} records
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[700px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-20 shadow-sm">
                  <TableRow>
                    {columns.map(col => (
                      <TableHead key={col} className="font-bold py-4 uppercase text-[10px] tracking-widest text-muted-foreground">
                        {col.replace(/_/g, ' ')}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold py-4 pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="h-64 text-center">
                        <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary/30" />
                        <p className="mt-4 text-sm font-medium text-muted-foreground">Retrieving account data...</p>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="h-64 text-center">
                        <p className="text-muted-foreground italic">No account records found.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.Id} className="group hover:bg-primary/[0.01] transition-colors border-b last:border-0">
                        {columns.map(col => (
                          <TableCell key={col} className="py-3">
                            {editingId === row.Id ? (
                              <Input
                                value={editValues[col] ?? ""}
                                onChange={(e) => handleInputChange(col, e.target.value)}
                                className="h-8 text-sm focus-visible:ring-primary/30"
                              />
                            ) : (
                              <span className="text-sm font-medium">{row[col] ?? "-"}</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right py-3 pr-6">
                          {editingId === row.Id ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={handleCancel} className="h-8 w-8 p-0 text-muted-foreground">
                                <X className="h-4 w-4" />
                              </Button>
                              <Button size="sm" onClick={() => handleSave(row.Id)} className="h-8 gap-2 px-3 bg-emerald-600 hover:bg-emerald-700">
                                <Save className="h-3.5 w-3.5" />
                                Save
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/5 text-primary font-semibold"
                              onClick={() => handleEdit(row)}
                            >
                              Edit
                            </Button>
                          )}
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

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RefreshCw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Row {
  id: string;
  name: string;
  email: string;
  [key: string]: any;
}

const TABLE_ID = "m8hflvkkfj25aio";
const API_TOKEN = "2dHOteiGjwqUTj35QyZd932j-QwxJSlUeEXCTaLp";
const BASE_URL = "http://nocodb.leadawaker.com/api/v2/tables";

export default function TestTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/${TABLE_ID}/records`, {
        headers: { "xc-token": API_TOKEN },
      });
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = await res.json();
      setRows(data.list || []);
    } catch (err) {
      console.error("Error fetching NocoDB data:", err);
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: "Could not connect to NocoDB.",
      });
    } finally {
      setLoading(false);
    }
  };

  const addRow = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`${BASE_URL}/${TABLE_ID}/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xc-token": API_TOKEN,
        },
        body: JSON.stringify({ name, email }),
      });
      
      if (!res.ok) throw new Error("Failed to add row");
      
      setName("");
      setEmail("");
      toast({
        title: "Success",
        description: "New record added to NocoDB.",
      });
      fetchData();
    } catch (err) {
      console.error("Error adding row:", err);
      toast({
        variant: "destructive",
        title: "Error adding row",
        description: "Failed to save the record.",
      });
    } finally {
      setAdding(false);
    }
  };

  const handlePostMessage = async (row: Row) => {
    // Note: Associating with the row data. Using a placeholder webhook for the link associated logic.
    const webhookUrl = "https://hook.us1.make.com/6q7v2a8p4r5t6u7v8w9x0y1z2a3b4c5d";
    
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "row_action",
          timestamp: new Date().toISOString(),
          record: row
        }),
      });
      
      if (res.ok) {
        toast({
          title: "Action Triggered",
          description: `Data for ${row.name} sent successfully.`,
        });
      } else {
        throw new Error("Webhook failed");
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: "Could not trigger the associated link action.",
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="flex flex-col gap-8">
        <header className="flex justify-between items-end border-b pb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">Database Integration</h1>
            <p className="text-muted-foreground">Manage records and trigger associated actions.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          <Card className="lg:col-span-4 h-fit shadow-md border-primary/5 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">Quick Entry</CardTitle>
              <CardDescription>Add a new record to the database.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addRow} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Name</label>
                  <Input
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    data-testid="input-name"
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Email</label>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                    className="bg-background/50"
                  />
                </div>
                <Button type="submit" className="w-full font-bold shadow-sm" disabled={adding} data-testid="button-submit">
                  {adding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create Record
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-8 shadow-md border-primary/5 overflow-hidden flex flex-col">
            <CardHeader className="bg-muted/30 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Cloud Database</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Connection</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-grow">
              <div className="overflow-x-auto h-[400px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold py-4">Name</TableHead>
                      <TableHead className="font-bold py-4">Email</TableHead>
                      <TableHead className="text-right font-bold py-4 pr-6">Integration Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-64 text-center">
                          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary/30" />
                          <p className="mt-4 text-sm font-medium text-muted-foreground">Synchronizing data...</p>
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-64 text-center">
                          <p className="text-muted-foreground italic">No data available in this view.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id} className="group hover:bg-primary/[0.02] transition-colors border-b last:border-0">
                          <TableCell className="font-semibold py-4">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground py-4">{row.email}</TableCell>
                          <TableCell className="text-right py-4 pr-6">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="bg-primary/5 hover:bg-primary/10 text-primary border border-primary/10 font-bold transition-all"
                              onClick={() => handlePostMessage(row)}
                              data-testid={`button-send-${row.id}`}
                            >
                              <Send className="h-3.5 w-3.5 mr-2" />
                              Trigger Webhook
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <div className="bg-muted/10 p-4 border-t text-[10px] text-muted-foreground uppercase tracking-widest text-center">
              Table ID: {TABLE_ID}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

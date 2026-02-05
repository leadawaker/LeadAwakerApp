import { useEffect, useState } from "react";

interface Row {
  id: string;
  name: string;
  email: string;
}

const TABLE_ID = "YOUR_TABLE_ID"; // replace with your test table ID
const API_TOKEN = "YOUR_API_TOKEN"; // replace with your test token

export default function NocoTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Fetch table data
  const fetchData = async () => {
    try {
      const res = await fetch(
        `https://app.nocodb.com/api/v2/tables/${TABLE_ID}/records`,
        { headers: { "xc-token": API_TOKEN } }
      );
      const data = await res.json();
      setRows(data.list || []);
    } catch (err) {
      console.error("Error fetching NocoDB data:", err);
    }
  };

  // Add new row
  const addRow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(
        `https://app.nocodb.com/api/v2/tables/${TABLE_ID}/records`,
        {
          method: "POST",
          headers: {
            "xc-token": API_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, email }),
        }
      );
      setName("");
      setEmail("");
      fetchData(); // Refresh table
    } catch (err) {
      console.error("Error adding row:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <h2>My NocoDB Table</h2>
      <table border={1}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.email}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Add New Row</h3>
      <form onSubmit={addRow}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
import { useEffect, useState } from "react";

interface Row {
  id: string;
  name: string;
  email: string;
}

// Replace with your throwaway API table ID and token
const TABLE_ID = "m8hflvkkfj25aio"; // Accounts table ID
const API_TOKEN = "2dHOteiGjwqUTj35QyZd932j-QwxJSlUeEXCTaLp"; // throwaway token

export default function TestTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Fetch data from NocoDB
  const fetchData = async () => {
    try {
      const res = await fetch(
        `http://nocodb.leadawaker.com/api/v2/tables/${TABLE_ID}/records`,
        {
          headers: { "xc-token": API_TOKEN },
        }
      );
      const data = await res.json();
      setRows(data.list || []);
    } catch (err) {
      console.error("Error fetching NocoDB data:", err);
    }
  };

  // Add a new row
  const addRow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(
        `http://nocodb.leadawaker.com/api/v2/tables/${TABLE_ID}/records`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xc-token": API_TOKEN,
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
    <div style={{ padding: "2rem" }}>
      <h2>Test NocoDB Table</h2>
      <table border={1} style={{ width: "100%", marginBottom: "1rem" }}>
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

      <form onSubmit={addRow} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Add Row</button>
      </form>
    </div>
  );
}
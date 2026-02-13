export const fetchLeads = async () => {
  const res = await fetch(
    "https://api-leadawaker.netlify.app/.netlify/functions/api?tableId=m5sya7uwdeieso3"
  );
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.list || []);
};

export const updateLead = async (rowId: string | number, data: any) => {
  const res = await fetch(
    `https://api-leadawaker.netlify.app/.netlify/functions/api?tableId=m5sya7uwdeieso3&id=${rowId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    throw new Error("Failed to update lead");
  }
  return await res.json();
};

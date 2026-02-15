export const fetchLeads = async () => {
  const res = await fetch(
    "https://api-leadawaker.netlify.app/.netlify/functions/api?tableId=leads"
  );
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

export const updateLead = async (rowId: string | number, patchData: any) => {
  const res = await fetch(
    `https://api-leadawaker.netlify.app/.netlify/functions/api?tableId=leads&id=${rowId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patchData),
    }
  );
  if (!res.ok) {
    throw new Error("Failed to update lead");
  }
  return res.json();
};
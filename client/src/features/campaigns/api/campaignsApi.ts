export const fetchAccounts = async () => {
  const res = await fetch(
    "https://api-leadawaker.netlify.app/.netlify/functions/api?tableId=m8hflvkkfj25aio"
  );
  const data = await res.json();
  return data?.list || [];
};

export const fetchCampaigns = async () => {
  const res = await fetch(
    "https://api-leadawaker.netlify.app/.netlify/functions/api?tableId=m18yh52xz04y3gj"
  );
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.list || []);
};

export const updateCampaign = async (rowId: string | number, data: any) => {
  const res = await fetch(
    `https://api-leadawaker.netlify.app/.netlify/functions/api?tableId=m18yh52xz04y3gj&id=${rowId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) {
    throw new Error("Failed to update campaign");
  }
  return await res.json();
};

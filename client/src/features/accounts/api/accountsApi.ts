const API_BASE_URL = "https://api-leadawaker.netlify.app/.netlify/functions/api";
const TABLE_ID = "accounts";

/**
 * Fetches all accounts.
 * Compatible with the existing Netlify function API.
 */
export const fetchAccounts = async () => {
  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}`);
  if (!res.ok) throw new Error("Failed to fetch accounts");
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
};

/**
 * Updates an account.
 * Uses lowercase Supabase column names and 'id' as the identifier.
 * @param {string|number} id - The identifier of the account.
 * @param {Object} patch - The fields to update (keys must match lowercase column names).
 */
export const updateAccount = async (id: number | string, patch: any) => {
  // Ensure patch keys are lowercase as per Supabase columns
  const lowercasePatch = Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [key.toLowerCase(), value])
  );

  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lowercasePatch),
  });
  if (!res.ok) throw new Error("Failed to update account");
  return res.json();
};

/**
 * Creates a new account.
 * @param {Object} payload - The account data (keys must match lowercase column names).
 */
export const createAccount = async (payload: any) => {
  // Ensure payload keys are lowercase as per Supabase columns
  const lowercasePayload = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key.toLowerCase(), value])
  );

  const res = await fetch(`${API_BASE_URL}?tableId=${TABLE_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lowercasePayload),
  });
  if (!res.ok) throw new Error("Failed to create account");
  return res.json();
};

/**
 * Deletes multiple accounts by their IDs.
 * @param {(number|string)[]} ids - Array of account IDs to delete.
 */
export const deleteAccounts = async (ids: (number | string)[]) => {
  await Promise.all(
    ids.map((id) =>
      fetch(`${API_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, { 
        method: "DELETE" 
      })
    )
  );
};

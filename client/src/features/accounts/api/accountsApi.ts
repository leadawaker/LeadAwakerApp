// src/features/accounts/api/accountsApi.ts
const TABLE_ID = "m8hflvkkfj25aio";
const NOCODB_BASE_URL =
  "https://api-leadawaker.netlify.app/.netlify/functions/api";

export interface Account {
  Id: number;
  [key: string]: any;
}

export async function listAccounts(params?: { accountId?: number }) {
  const url = new URL(NOCODB_BASE_URL);
  url.searchParams.set("tableId", TABLE_ID);
  if (params?.accountId) {
    url.searchParams.set("account_id", String(params.accountId));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to list accounts");
  const data = await res.json();
  return (data.list || []) as Account[];
}

export async function updateAccount(
  id: number,
  patch: Partial<Account>,
): Promise<Account> {
  const res = await fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update account");
  return (await res.json()) as Account;
}

export async function createAccount(
  payload: Partial<Account>,
): Promise<Account> {
  const res = await fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create account");
  return (await res.json()) as Account;
}

export async function deleteAccounts(ids: number[]): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, {
        method: "DELETE",
      }),
    ),
  );
}
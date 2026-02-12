import type { Handler } from "@netlify/functions";

const NOCODB_BASE_URL = process.env.NOCODB_BASE_URL!;
const NOCODB_TOKEN = process.env.NOCODB_TOKEN!;

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  const tableId = event.queryStringParameters?.tableId;
  const recordId = event.queryStringParameters?.id;

  if (!tableId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing tableId" }),
    };
  }

  const url = `${NOCODB_BASE_URL}/tables/${tableId}/records`;

  try {
    const options: RequestInit = {
      method: event.httpMethod,
      headers: {
        "xc-token": NOCODB_TOKEN,
        "Content-Type": "application/json",
      },
    };

    if (["POST", "PATCH", "PUT"].includes(event.httpMethod || "")) {
      options.body = event.body;
    }

    const response = await fetch(url, options);
    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process request" }),
    };
  }
};
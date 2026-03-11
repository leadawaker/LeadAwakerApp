import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface Column {
  name: string;
  type: string;
  nullable: boolean;
}

interface Table {
  name: string;
  columns: Column[];
}

const pgTypeMap: Record<string, string> = {
  "character varying": "varchar",
  text: "text",
  integer: "integer",
  bigint: "bigint",
  numeric: "numeric",
  boolean: "boolean",
  "timestamp without time zone": "timestamp",
  timestamp: "timestamp",
  "time without time zone": "time",
  time: "time",
  json: "json",
  jsonb: "json",
  "double precision": "real",
};

function getDrizzleType(pgType: string, nullable: boolean): string {
  const baseType = pgTypeMap[pgType] || pgType;
  const nullable_suffix = nullable ? "" : "";
  return baseType + nullable_suffix;
}

async function introspectSchema() {
  try {
    // Get all tables in the nocodb schema
    const tableQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'p2mxx34fvbf3ll6'
      ORDER BY table_name
    `;

    const tableResult = await pool.query(tableQuery);
    const tables: Table[] = [];

    for (const tableRow of tableResult.rows) {
      const tableName = tableRow.table_name;

      const columnQuery = `
        SELECT
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'p2mxx34fvbf3ll6' AND table_name = $1
        ORDER BY ordinal_position
      `;

      const columnResult = await pool.query(columnQuery, [tableName]);
      const columns: Column[] = columnResult.rows.map((col) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === "YES",
      }));

      tables.push({ name: tableName, columns });
    }

    // Generate TypeScript schema file
    const schema = generateSchema(tables);
    const schemaPath = path.join(process.cwd(), "shared", "schema.ts");

    fs.writeFileSync(schemaPath, schema);
    console.log(`✅ Schema generated: ${schemaPath}`);
  } catch (error) {
    console.error("Error introspecting schema:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function generateSchema(tables: Table[]): string {
  let schema = `import { sql } from "drizzle-orm";
import {
  pgSchema,
  integer,
  text,
  varchar,
  timestamp,
  numeric,
  bigint,
  boolean,
  time,
  json,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// NocoDB schema
const nocodb = pgSchema("p2mxx34fvbf3ll6");

`;

  const tableDefinitions: string[] = [];
  const types: string[] = [];

  for (const table of tables) {
    const columns = table.columns
      .map((col) => {
        const camelName = toCamelCase(col.name);
        const drizzleType = getDrizzleType(col.type, col.nullable);
        return `  ${camelName}: ${drizzleType}("${col.name}")${col.nullable ? "" : ""}`;
      })
      .join(",\n");

    const tableName = table.name;
    const tableVar = toCamelCase(tableName); // camelCase for variable

    tableDefinitions.push(`
// ─── ${tableName} ───────────────────────────────────────────────────────────────

export const ${tableVar} = nocodb.table("${tableName}", {
${columns},
});

export const insert${tableName}Schema = createInsertSchema(${tableVar}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  ncOrder: true,
});
export type ${tableName} = typeof ${tableVar}.$inferSelect;
export type Insert${tableName} = z.infer<typeof insert${tableName}Schema>;
`);
  }

  schema += tableDefinitions.join("\n");

  return schema;
}

function toCamelCase(str: string, forVariable = false): string {
  const camel = str
    .split("_")
    .map((word, i) => {
      if (i === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");

  return camel;
}

introspectSchema();

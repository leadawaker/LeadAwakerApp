/**
 * Add a field to a NocoDB table
 *
 * Usage: npx tsx --env-file=.env script/add-field.ts <tableName> <fieldName> <fieldType> [defaultValue]
 *
 * Examples:
 *   npx tsx --env-file=.env script/add-field.ts Users status text
 *   npx tsx --env-file=.env script/add-field.ts Users age integer 0
 *   npx tsx --env-file=.env script/add-field.ts Users settings json '{}'
 */

import pg from "pg";
import { randomBytes } from "crypto";
import { execSync } from "child_process";

const { Pool } = pg;

interface FieldConfig {
  pgType: string;
  drizzleType: string;
  uidt: string;
  defaultValue?: string;
}

const fieldTypeMap: Record<string, FieldConfig> = {
  text: {
    pgType: "text",
    drizzleType: "text",
    uidt: "SingleLineText",
  },
  varchar: {
    pgType: "character varying",
    drizzleType: "varchar",
    uidt: "SingleLineText",
  },
  integer: {
    pgType: "integer",
    drizzleType: "integer",
    uidt: "Number",
  },
  bigint: {
    pgType: "bigint",
    drizzleType: "bigint",
    uidt: "Number",
  },
  numeric: {
    pgType: "numeric",
    drizzleType: "numeric",
    uidt: "Decimal",
  },
  boolean: {
    pgType: "boolean",
    drizzleType: "boolean",
    uidt: "Checkbox",
  },
  timestamp: {
    pgType: "timestamp",
    drizzleType: "timestamp",
    uidt: "DateTime",
  },
  time: {
    pgType: "time",
    drizzleType: "time",
    uidt: "Time",
  },
  json: {
    pgType: "json",
    drizzleType: "json",
    uidt: "Json",
  },
  real: {
    pgType: "double precision",
    drizzleType: "real",
    uidt: "Decimal",
  },
};

const generateId = () => randomBytes(6).toString("hex");

async function addField() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error(
      "Usage: npx tsx script/add-field.ts <tableName> <fieldName> <fieldType> [defaultValue]"
    );
    console.error("Supported types: " + Object.keys(fieldTypeMap).join(", "));
    process.exit(1);
  }

  const [tableName, fieldName, fieldType, defaultValue] = args;
  const config = fieldTypeMap[fieldType];

  if (!config) {
    console.error(`❌ Unknown field type: ${fieldType}`);
    console.error("Supported types: " + Object.keys(fieldTypeMap).join(", "));
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log(`\n📝 Adding field '${fieldName}' to '${tableName}' table...`);

    // 1. Add column to PostgreSQL
    let addColumnSql = `ALTER TABLE "p2mxx34fvbf3ll6"."${tableName}" ADD COLUMN ${fieldName} ${config.pgType}`;
    if (defaultValue) {
      addColumnSql += ` DEFAULT ${defaultValue}`;
    }

    await pool.query(addColumnSql);
    console.log(`✅ Added column to PostgreSQL`);

    // 2. Get table model ID
    const modelResult = await pool.query(
      `SELECT id FROM nc_models_v2 WHERE title = $1`,
      [tableName]
    );

    if (modelResult.rows.length === 0) {
      throw new Error(`Table ${tableName} not found in NocoDB`);
    }

    const modelId = modelResult.rows[0].id;

    // 3. Register in nc_columns_v2
    const maxOrderResult = await pool.query(
      `SELECT MAX("order") as max_order FROM nc_columns_v2 WHERE fk_model_id = $1`,
      [modelId]
    );
    const nextOrder = (maxOrderResult.rows[0]?.max_order || 0) + 1;

    const colId = generateId();

    await pool.query(
      `
      INSERT INTO nc_columns_v2 (
        id, source_id, base_id, fk_model_id, title, column_name, uidt, dt,
        dtx, system, "order", meta, fk_workspace_id, readonly, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    `,
      [
        colId,
        "bl04mt8mzye67gi", // source_id
        "p2mxx34fvbf3ll6", // base_id
        modelId,
        fieldName,
        fieldName,
        config.uidt,
        config.pgType,
        "specificType",
        false,
        nextOrder,
        "{}",
        "wg72oflr", // workspace_id
        false,
      ]
    );
    console.log(`✅ Registered in NocoDB metadata`);

    // 4. Add to grid view
    const gridViewResult = await pool.query(
      `SELECT id FROM nc_views_v2 WHERE fk_model_id = $1 AND type = 3 LIMIT 1`,
      [modelId]
    );

    if (gridViewResult.rows[0]) {
      const viewId = gridViewResult.rows[0].id;
      const maxGridOrderResult = await pool.query(
        `SELECT MAX("order") as max_order FROM nc_grid_view_columns_v2 WHERE fk_view_id = $1`,
        [viewId]
      );
      const nextGridOrder = (maxGridOrderResult.rows[0]?.max_order || 0) + 1;

      await pool.query(
        `
        INSERT INTO nc_grid_view_columns_v2
        (id, fk_view_id, fk_column_id, source_id, base_id, width, show, "order", fk_workspace_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, '200px', true, $6, $7, NOW(), NOW())
      `,
        [
          generateId(),
          viewId,
          colId,
          "bl04mt8mzye67gi",
          "p2mxx34fvbf3ll6",
          nextGridOrder,
          "wg72oflr",
        ]
      );
      console.log(`✅ Added to grid view`);
    }

    await pool.end();

    // 5. Restart NocoDB
    console.log(`\n🔄 Restarting NocoDB container...`);
    execSync("docker restart nocodb", { stdio: "inherit" });
    console.log(`✅ NocoDB restarted`);

    // 6. Wait for NocoDB to be ready
    console.log(`⏳ Waiting for NocoDB to be ready...`);
    let retries = 0;
    while (retries < 30) {
      try {
        const { execSync: exec } = await import("child_process");
        exec("curl -s http://localhost:8080/health > /dev/null 2>&1");
        break;
      } catch {
        retries++;
        if (retries < 30) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
    console.log(`✅ NocoDB is ready`);

    // 7. Run introspection script
    console.log(`\n🔍 Updating schema.ts...`);
    execSync("npx tsx --env-file=.env script/introspect-schema.ts", {
      stdio: "inherit",
    });

    console.log(`\n✨ Done! Field '${fieldName}' has been added to '${tableName}'\n`);
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

addField();

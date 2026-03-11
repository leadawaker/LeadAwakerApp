"""
support_context.py — DB helpers for Sophie support chat context.

Fetches aggregated stats from the LeadAwaker PostgreSQL database
and formats them into a structured string for injection into the
Sophie AI system prompt.
"""

import asyncio
import os
import asyncpg

# ── DB connection ─────────────────────────────────────────────────────────────

DB_SCHEMA = os.environ.get("DB_SCHEMA", "p2mxx34fvbf3ll6")

DB_CONFIG = {
    "host":     os.environ.get("DB_HOST",     "localhost"),
    "port":     int(os.environ.get("DB_PORT", "5432")),
    "database": os.environ.get("DB_NAME",     "nocodb"),
    "user":     os.environ.get("DB_USER",     "leadawaker"),
    "password": os.environ.get("DB_PASSWORD", "1234Bananas"),
}


async def get_db_connection() -> asyncpg.Connection:
    """Return a raw asyncpg connection (caller must close)."""
    return await asyncpg.connect(**DB_CONFIG)


# ── Stat helpers ──────────────────────────────────────────────────────────────

async def get_platform_stats() -> dict:
    """
    Top-level aggregated stats for Sophie's context:
    total accounts, campaigns, leads, bookings, and a breakdown
    of leads by Conversion_Status.
    """
    conn = await get_db_connection()
    try:
        # Core counts
        counts = await conn.fetchrow(f"""
            SELECT
                (SELECT COUNT(*) FROM "{DB_SCHEMA}"."Accounts")                    AS total_accounts,
                (SELECT COUNT(*) FROM "{DB_SCHEMA}"."Campaigns")                   AS total_campaigns,
                (SELECT COUNT(*) FROM "{DB_SCHEMA}"."Campaigns"
                    WHERE status = 'active')                                        AS active_campaigns,
                (SELECT COUNT(*) FROM "{DB_SCHEMA}"."Leads")                       AS total_leads,
                (SELECT COALESCE(SUM(bookings_generated), 0)
                    FROM "{DB_SCHEMA}"."Campaigns")                                 AS total_bookings
        """)

        # Leads by pipeline stage
        stage_rows = await conn.fetch(f"""
            SELECT "Conversion_Status" AS stage, COUNT(*) AS count
            FROM "{DB_SCHEMA}"."Leads"
            GROUP BY "Conversion_Status"
            ORDER BY count DESC
        """)

        return {
            "total_accounts":   counts["total_accounts"],
            "total_campaigns":  counts["total_campaigns"],
            "active_campaigns": counts["active_campaigns"],
            "total_leads":      counts["total_leads"],
            "total_bookings":   counts["total_bookings"],
            "stages":           [dict(r) for r in stage_rows],
        }
    finally:
        await conn.close()


async def get_all_accounts_detailed() -> list[dict]:
    """Admin: compact per-account summary for Sophie context."""
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(f"""
            SELECT
                a.id,
                a.name,
                a.status,
                COUNT(DISTINCT c.id)                    AS campaign_count,
                COUNT(DISTINCT l.id)                    AS total_leads,
                COALESCE(SUM(c.bookings_generated), 0)  AS total_bookings
            FROM "{DB_SCHEMA}"."Accounts" a
            LEFT JOIN "{DB_SCHEMA}"."Campaigns" c ON c."Accounts_id" = a.id
            LEFT JOIN "{DB_SCHEMA}"."Leads"     l ON l."Accounts_id" = a.id
            GROUP BY a.id, a.name, a.status
            ORDER BY a.name
            LIMIT 20
        """)
        return [dict(r) for r in rows]
    finally:
        await conn.close()


# ── Prompt formatter ──────────────────────────────────────────────────────────

def format_context_for_prompt(
    stats: dict,
    accounts_detail: list[dict] | None = None,
) -> str:
    """
    Convert aggregated stats into a compact text block suitable for
    injection into Sophie's system prompt as live platform context.
    """
    stages = stats.get("stages", [])
    stage_lines = ", ".join(
        f"{s['stage']}: {s['count']}" for s in stages
    ) if stages else "no data"

    context = (
        f"PLATFORM CONTEXT (live):\n"
        f"  Accounts: {stats.get('total_accounts', 0)}\n"
        f"  Campaigns: {stats.get('total_campaigns', 0)} total, "
        f"{stats.get('active_campaigns', 0)} active\n"
        f"  Leads: {stats.get('total_leads', 0)} total\n"
        f"  Bookings generated: {stats.get('total_bookings', 0)}\n"
        f"  Pipeline breakdown: {stage_lines}"
    )

    if accounts_detail:
        lines = ["\n\nPER-ACCOUNT BREAKDOWN:"]
        for acc in accounts_detail:
            lines.append(
                f"  - {acc['name']} ({acc.get('status', 'unknown')}): "
                f"{acc['campaign_count']} campaigns, "
                f"{acc['total_leads']} leads, "
                f"{acc['total_bookings']} bookings"
            )
        context += "\n".join(lines)

    return context

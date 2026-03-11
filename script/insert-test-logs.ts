import { db } from "../server/db.js";
import * as schema from "../shared/schema.js";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const { automationLogs } = schema;

async function insertTestLogs() {
  const testLogs = [
    {
      workflowName: "Lead Reactivation Workflow",
      stepName: "Check Eligibility",
      status: "success",
      leadsId: null,
      campaignsId: null,
      accountsId: null,
      executionTimeMs: 125,
    },
    {
      workflowName: "Lead Reactivation Workflow",
      stepName: "Generate AI Message",
      status: "success",
      leadsId: null,
      campaignsId: null,
      accountsId: null,
      executionTimeMs: 523,
    },
    {
      workflowName: "Lead Reactivation Workflow",
      stepName: "Send WhatsApp Message",
      status: "failed",
      errorCode: "TWILIO_API_ERROR",
      leadsId: null,
      campaignsId: null,
      accountsId: null,
      executionTimeMs: 89,
    },
    {
      workflowName: "Bump Follow-up Workflow",
      stepName: "Wait for Response",
      status: "waiting",
      leadsId: null,
      campaignsId: null,
      accountsId: null,
      executionTimeMs: 0,
    },
    {
      workflowName: "Bump Follow-up Workflow",
      stepName: "Send Bump 1 Message",
      status: "success",
      leadsId: null,
      campaignsId: null,
      accountsId: null,
      executionTimeMs: 342,
    },
    {
      workflowName: "Calendar Booking Workflow",
      stepName: "Extract Meeting Details",
      status: "success",
      leadsId: null,
      campaignsId: null,
      accountsId: null,
      executionTimeMs: 210,
    },
    {
      workflowName: "Calendar Booking Workflow",
      stepName: "Book Calendar Slot",
      status: "failed",
      errorCode: "CALENDAR_UNAVAILABLE",
      leadsId: null,
      campaignsId: null,
      accountsId: null,
      executionTimeMs: 456,
    },
    {
      workflowName: "Lead Scoring Workflow",
      stepName: "Calculate Engagement Score",
      status: "success",
      leadsId: null,
      campaignsId: null,
      accountsId: null,
      executionTimeMs: 89,
    },
  ];

  try {
    console.log("Inserting test automation logs...");
    const inserted = await db.insert(automationLogs).values(testLogs).returning();
    console.log(`Successfully inserted ${inserted.length} test logs:`);
    inserted.forEach((log, i) => {
      console.log(`  ${i + 1}. ${log.workflowName} - ${log.stepName} (${log.status})`);
    });
  } catch (error) {
    console.error("Error inserting test logs:", error);
  } finally {
    process.exit(0);
  }
}

insertTestLogs();

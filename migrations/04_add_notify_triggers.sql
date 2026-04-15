-- Real-time notifications for all major CRM tables
-- This file creates triggers for leads, campaigns, accounts, tasks, automation_logs, and tags
-- These triggers fire pg_notify after any insert/update/delete, allowing the SSE listener to broadcast changes

-- ============ LEADS TRIGGER ============
CREATE OR REPLACE FUNCTION p2mxx34fvbf3ll6.notify_leads_changed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data p2mxx34fvbf3ll6."Leads";
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := OLD; ELSE row_data := NEW; END IF;
  PERFORM pg_notify('leads_changed', json_build_object(
    'id', row_data.id,
    'accounts_id', row_data."Accounts_id",
    'op', TG_OP
  )::text);
  RETURN row_data;
END; $$;

CREATE OR REPLACE TRIGGER leads_changed_trigger
AFTER INSERT OR UPDATE OR DELETE ON p2mxx34fvbf3ll6."Leads"
FOR EACH ROW EXECUTE FUNCTION p2mxx34fvbf3ll6.notify_leads_changed();

-- ============ CAMPAIGNS TRIGGER ============
CREATE OR REPLACE FUNCTION p2mxx34fvbf3ll6.notify_campaigns_changed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data p2mxx34fvbf3ll6."Campaigns";
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := OLD; ELSE row_data := NEW; END IF;
  PERFORM pg_notify('campaigns_changed', json_build_object(
    'id', row_data.id,
    'accounts_id', row_data."Accounts_id",
    'op', TG_OP
  )::text);
  RETURN row_data;
END; $$;

CREATE OR REPLACE TRIGGER campaigns_changed_trigger
AFTER INSERT OR UPDATE OR DELETE ON p2mxx34fvbf3ll6."Campaigns"
FOR EACH ROW EXECUTE FUNCTION p2mxx34fvbf3ll6.notify_campaigns_changed();

-- ============ ACCOUNTS TRIGGER ============
CREATE OR REPLACE FUNCTION p2mxx34fvbf3ll6.notify_accounts_changed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data p2mxx34fvbf3ll6."Accounts";
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := OLD; ELSE row_data := NEW; END IF;
  PERFORM pg_notify('accounts_changed', json_build_object(
    'id', row_data.id,
    'accounts_id', row_data.id,
    'op', TG_OP
  )::text);
  RETURN row_data;
END; $$;

CREATE OR REPLACE TRIGGER accounts_changed_trigger
AFTER INSERT OR UPDATE OR DELETE ON p2mxx34fvbf3ll6."Accounts"
FOR EACH ROW EXECUTE FUNCTION p2mxx34fvbf3ll6.notify_accounts_changed();

-- ============ TASKS TRIGGER ============
CREATE OR REPLACE FUNCTION p2mxx34fvbf3ll6.notify_tasks_changed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data p2mxx34fvbf3ll6."Tasks";
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := OLD; ELSE row_data := NEW; END IF;
  PERFORM pg_notify('tasks_changed', json_build_object(
    'id', row_data.id,
    'accounts_id', row_data."Accounts_id",
    'op', TG_OP
  )::text);
  RETURN row_data;
END; $$;

CREATE OR REPLACE TRIGGER tasks_changed_trigger
AFTER INSERT OR UPDATE OR DELETE ON p2mxx34fvbf3ll6."Tasks"
FOR EACH ROW EXECUTE FUNCTION p2mxx34fvbf3ll6.notify_tasks_changed();

-- ============ AUTOMATION_LOGS TRIGGER ============
CREATE OR REPLACE FUNCTION p2mxx34fvbf3ll6.notify_automation_logs_changed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data p2mxx34fvbf3ll6."Automation_Logs";
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := OLD; ELSE row_data := NEW; END IF;
  PERFORM pg_notify('automation_logs_changed', json_build_object(
    'id', row_data.id,
    'accounts_id', row_data."Accounts_id",
    'op', TG_OP
  )::text);
  RETURN row_data;
END; $$;

CREATE OR REPLACE TRIGGER automation_logs_changed_trigger
AFTER INSERT OR UPDATE OR DELETE ON p2mxx34fvbf3ll6."Automation_Logs"
FOR EACH ROW EXECUTE FUNCTION p2mxx34fvbf3ll6.notify_automation_logs_changed();

-- ============ TAGS TRIGGER ============
CREATE OR REPLACE FUNCTION p2mxx34fvbf3ll6.notify_tags_changed()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data p2mxx34fvbf3ll6."Tags";
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := OLD; ELSE row_data := NEW; END IF;
  PERFORM pg_notify('tags_changed', json_build_object(
    'id', row_data.id,
    'accounts_id', row_data."Accounts_id",
    'op', TG_OP
  )::text);
  RETURN row_data;
END; $$;

CREATE OR REPLACE TRIGGER tags_changed_trigger
AFTER INSERT OR UPDATE OR DELETE ON p2mxx34fvbf3ll6."Tags"
FOR EACH ROW EXECUTE FUNCTION p2mxx34fvbf3ll6.notify_tags_changed();

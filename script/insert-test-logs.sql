-- Insert test automation logs with workflow_name and step_name
INSERT INTO "p2mxx34fvbf3ll6"."Automation_Logs" (workflow_name, step_name, status, execution_time_ms, created_at) VALUES
('Lead Reactivation Workflow', 'Check Eligibility', 'success', 125, NOW()),
('Lead Reactivation Workflow', 'Generate AI Message', 'success', 523, NOW()),
('Lead Reactivation Workflow', 'Send WhatsApp Message', 'failed', 89, NOW() - INTERVAL '1 hour'),
('Bump Follow-up Workflow', 'Wait for Response', 'waiting', 0, NOW()),
('Bump Follow-up Workflow', 'Send Bump 1 Message', 'success', 342, NOW() - INTERVAL '2 hours'),
('Calendar Booking Workflow', 'Extract Meeting Details', 'success', 210, NOW() - INTERVAL '3 hours'),
('Calendar Booking Workflow', 'Book Calendar Slot', 'failed', 456, NOW() - INTERVAL '4 hours'),
('Lead Scoring Workflow', 'Calculate Engagement Score', 'success', 89, NOW() - INTERVAL '5 hours');

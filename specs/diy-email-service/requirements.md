# Requirements: DIY Email Service (#245)

## What It Does

A self-hosted email sending service for the Lead Awaker automations engine. Sends outreach emails from `gabriel@leadawaker.com` via SMTP with DKIM signing, open tracking (1x1 pixel), click tracking (link rewriting through own server), proper List-Unsubscribe headers, and full logging to Automation_Logs.

## Why

SendGrid free tier is only a 60-day trial. DIY is zero cost, full control, no vendor lock-in. Initial scale is small (24 Den Bosch companies), so deliverability at massive scale is not a concern yet.

## Acceptance Criteria

1. **`tools/email_service.py`** sends HTML emails via aiosmtplib with DKIM signature
2. **Open tracking**: each email embeds a unique 1x1 pixel URL served from the Pi; hitting it logs "opened" to Automation_Logs
3. **Click tracking**: all links in email body are rewritten to pass through a tracking redirect endpoint on the Pi; the redirect logs the click and forwards to the original URL
4. **List-Unsubscribe** header included on every email (RFC 2369), pointing to an unsubscribe endpoint
5. **Proper Message-ID** header: `<uuid@leadawaker.com>`
6. **All sends logged** via AsyncLogStep with workflow_name="email_service", step details including recipient, subject, tracking IDs
7. **Dry-run support**: respects `settings.dry_run` flag, logs without actually sending
8. **Unsubscribe endpoint**: marks prospect as opted out (sets a flag in DB)
9. **Integration with send_service.py**: email becomes a new channel alongside whatsapp/sms/instagram

## Dependencies

- aiosmtplib (new dependency)
- dkimpy or python-dkim (new dependency)
- SMTP credentials for leadawaker.com (Cloudflare Email Routing or external SMTP relay)
- DKIM private key generated and DNS TXT record published
- SPF DNS record updated

## Related Features

- `tools/send_service.py` (unified multi-channel dispatcher)
- `tools/twilio_service.py` (reference pattern for tool structure)
- `src/automations/automation_logger.py` (AsyncLogStep logging)

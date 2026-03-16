# Action Required: DIY Email Service (#245)

Manual steps that must be completed by a human.

## How It Works

The email service supports two modes:

1. **Direct MX delivery** (default, no SMTP provider needed): resolves the recipient's MX record via DNS and connects directly to their mail server on port 25. This is the true DIY approach. Leave `SMTP_HOST` empty in `.env`.

2. **SMTP relay** (optional, better deliverability): if you set `SMTP_HOST` in `.env`, it sends through that relay instead. Useful if your Pi's IP gets blocked.

For your scale (24 prospects), direct MX works fine with proper DNS records.

## Setup Steps

- [ ] **Generate DKIM key pair** — Run `cd /home/gabriel/automations && ./scripts/generate_dkim.sh`
- [ ] **Add DNS records in Cloudflare** (3 records):

### SPF Record
```
Type: TXT
Name: @  (or leadawaker.com)
Value: v=spf1 ip4:<YOUR_PI_PUBLIC_IP> ~all
```
(Use your Pi's public IP. Find it with `curl -s ifconfig.me`)

### DKIM Record
```
Type: TXT
Name: mail._domainkey
Value: v=DKIM1; k=rsa; p=<public-key-base64-from-generate-script>
```

### DMARC Record
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:gabriel@leadawaker.com
```
Start with `p=none` (monitor mode). Move to `p=quarantine` after confirming emails pass SPF+DKIM.

- [ ] **Set DKIM key path in `.env`** — Add: `DKIM_PRIVATE_KEY_PATH=/home/gabriel/automations/dkim/leadawaker.com.key`
- [ ] **Run database migration** — `psql -U leadawaker -d nocodb < /home/gabriel/LeadAwakerApp/migrations/add_email_tracking_table.sql`
- [ ] **Install new Python dependencies** — `cd /home/gabriel/automations && pip install -r requirements.txt`
- [ ] **Restart automations engine** — `pm2 restart leadawaker-engine`

## Testing

- [ ] **Test DKIM/SPF** — Send a test email to `check-auth@verifier.port25.com` or use mail-tester.com. Should show SPF pass + DKIM pass.
- [ ] **Verify tracking pixel** — Send test email, open it, check Automation_Logs for open event
- [ ] **Verify click tracking** — Click a tracked link, check Automation_Logs for click event

## Optional: Switch to SMTP Relay Later

If direct delivery has issues (rejected by recipient servers), add these to `.env`:
```
SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-login
SMTP_PASSWORD=your-brevo-smtp-key
```
Then update SPF to: `v=spf1 include:sendinblue.com ~all`

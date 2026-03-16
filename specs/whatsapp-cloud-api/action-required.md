# Action Required: WhatsApp Cloud API Integration

Manual steps that must be completed by a human (Gabriel) in the Meta Business dashboard.

## Before Implementation

### Meta Business Account Setup
- [ ] **Verify you have a Meta Business Account** at business.facebook.com. If not, create one using your KVK registration (Lead Awaker BV / eenmanszaak details). Business verification takes 1-3 business days.
- [ ] **Create a WhatsApp Business App** at developers.facebook.com:
  1. Go to developers.facebook.com > My Apps > Create App
  2. Select "Business" type
  3. Name it (e.g., "Lead Awaker WhatsApp")
  4. Link it to your Meta Business Account
- [ ] **Add WhatsApp product** to the app:
  1. In your app dashboard, click "Add Product"
  2. Select "WhatsApp" > Set Up
  3. This gives you a test phone number and temporary access token

### Phone Number Registration
- [ ] **Choose which phone number to register** with Meta. WARNING: once registered, this number becomes API-only. You can NOT use the WhatsApp mobile app on this number anymore. Options:
  - Use a dedicated business SIM (recommended)
  - Use an existing number you're willing to give up for WhatsApp app use
- [ ] **Register the phone number** in WhatsApp > Getting Started:
  1. Click "Add phone number"
  2. Enter your business phone number
  3. Verify via SMS or voice call
  4. Note the **Phone Number ID** that appears after registration

### Access Token (Permanent)
- [ ] **Create a System User** for permanent API access:
  1. Go to business.facebook.com > Business Settings > Users > System Users
  2. Click "Add" > name it "LeadAwaker API" > role: Admin
  3. Click "Generate Token"
  4. Select the WhatsApp app
  5. Grant permissions: `whatsapp_business_management`, `whatsapp_business_messaging`
  6. Copy the token (this is your permanent `WHATSAPP_ACCESS_TOKEN`)
- [ ] **Note your WhatsApp Business Account ID** from Business Settings > Accounts > WhatsApp Accounts

### Message Templates
- [ ] **Create at least one message template** for outreach:
  1. In WhatsApp Manager (business.facebook.com > WhatsApp Accounts > your account > Message Templates)
  2. Create a template, e.g.:
     - Name: `lead_reactivation_intro`
     - Category: Marketing
     - Language: Dutch (nl)
     - Body: "Hallo {{1}}, ik ben Gabriel van Lead Awaker. Ik zag dat {{2}} interessante mogelijkheden heeft voor lead reactivatie. Zou u openstaan voor een kort gesprek? {{3}}"
     - Variables: {{1}}=first_name, {{2}}=company_name, {{3}}=value_prop
  3. Submit for review (usually approved within minutes to hours)
  4. Also create an English version if needed

### Webhook Configuration
- [ ] **Configure the webhook URL** in Meta App Dashboard:
  1. Go to your app > WhatsApp > Configuration
  2. Under Webhooks, click "Edit"
  3. Callback URL: `https://webhooks.leadawaker.com/webhooks/whatsapp`
  4. Verify token: the same random string you set as `WHATSAPP_VERIFY_TOKEN` in `.env`
  5. Click "Verify and Save"
  6. Subscribe to webhook fields: `messages` (required)

## During Implementation

- [ ] **Set env vars** in `/home/gabriel/automations/.env`:
  ```
  WHATSAPP_PHONE_NUMBER_ID=<from Meta dashboard>
  WHATSAPP_ACCESS_TOKEN=<System User permanent token>
  WHATSAPP_VERIFY_TOKEN=<random string, e.g. output of: python3 -c "import secrets; print(secrets.token_urlsafe(32))">
  WHATSAPP_BUSINESS_ACCOUNT_ID=<from Business Settings>
  ```
- [ ] **Install httpx** if not already installed: `pip install httpx` (used for async HTTP calls to Graph API)

## After Implementation

- [ ] **Test with Meta test number first** before switching to your real number. The app dashboard provides a test phone number you can send to your own WhatsApp.
- [ ] **Send a test template message** to your own phone to verify end-to-end flow
- [ ] **Verify webhook receives** inbound messages by replying to the template message
- [ ] **Check pm2 logs** for successful send/receive logging
- [ ] **Monitor Meta's rate limits**: 80 messages/second for Cloud API (not a concern at current scale, but good to know)

## Cost Reference

| Conversation Type | NL Price | Notes |
|---|---|---|
| Marketing (template, first msg) | ~$0.06 | When you initiate with a template |
| Service (user-initiated) | Free | First 1,000/month free, then ~$0.03 |
| Utility (order updates, etc.) | ~$0.02 | Not relevant for outreach |

At 24 Den Bosch prospects: worst case ~$1.44/month for marketing conversations.

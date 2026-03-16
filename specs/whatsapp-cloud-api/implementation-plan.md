# Implementation Plan: WhatsApp Cloud API Integration

## Overview

Build `tools/whatsapp_cloud.py` (service layer) and `src/webhooks/whatsapp_cloud_routes.py` (webhook endpoint) in the automations engine. Wire into `send_service.py` as a new channel and register the webhook router in `main.py`.

## Phase 1: Config + Service Module

Add config vars and build the core WhatsApp Cloud API service.

### Tasks
- [ ] Add WhatsApp Cloud API config vars to `src/config.py`
- [ ] Create `tools/whatsapp_cloud.py` with send_template_message, send_text_message, and webhook parsing

### Technical Details

**Config additions in `src/config.py`** (add after the Twilio block, line ~22):
```python
# WhatsApp Cloud API (Meta direct)
whatsapp_phone_number_id: str = ""
whatsapp_access_token: str = ""
whatsapp_verify_token: str = ""
whatsapp_business_account_id: str = ""  # optional, for template management
```

**Env vars in `.env`:**
```
WHATSAPP_PHONE_NUMBER_ID=<from Meta dashboard>
WHATSAPP_ACCESS_TOKEN=<permanent System User token>
WHATSAPP_VERIFY_TOKEN=<random string you choose for webhook verification>
WHATSAPP_BUSINESS_ACCOUNT_ID=<optional>
```

**`tools/whatsapp_cloud.py` functions:**

```python
import httpx
import structlog
from src.config import settings

log = structlog.get_logger()

GRAPH_API_VERSION = "v21.0"
BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


async def send_template_message(
    phone: str,
    template_name: str,
    language: str = "en_US",
    variables: list[str] | None = None,
) -> dict:
    """
    Send a pre-approved WhatsApp template message.
    phone: E.164 format (e.g. "+31612345678")
    variables: list of strings for template body variables ({{1}}, {{2}}, etc.)
    Returns dict with success, message_id, status.
    """
    # DRY_RUN guard (same pattern as twilio_service.py)
    ...

    url = f"{BASE_URL}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }

    # Build template components
    components = []
    if variables:
        parameters = [{"type": "text", "text": v} for v in variables]
        components.append({"type": "body", "parameters": parameters})

    payload = {
        "messaging_product": "whatsapp",
        "to": phone.lstrip("+"),
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language},
            "components": components,
        },
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, headers=headers, json=payload)
        ...


async def send_text_message(phone: str, text: str) -> dict:
    """
    Send a free-form text message (only works within 24h reply window).
    """
    url = f"{BASE_URL}/{settings.whatsapp_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone.lstrip("+"),
        "type": "text",
        "text": {"body": text},
    }
    ...


def parse_inbound_webhook(payload: dict) -> list[dict]:
    """
    Parse a Meta WhatsApp webhook payload.
    Returns list of parsed messages (may be empty for status-only webhooks).
    Each dict has: message_id, from_phone, timestamp, type, body, media_url, media_type.
    """
    ...


def parse_status_updates(payload: dict) -> list[dict]:
    """
    Extract message status updates from webhook payload.
    Each dict has: message_id, status (sent/delivered/read/failed), timestamp, recipient_phone.
    """
    ...


def verify_webhook(params: dict, verify_token: str) -> str | None:
    """
    Handle Meta webhook verification GET request.
    Returns hub.challenge string on success, None on failure.
    Same pattern as instagram_service.verify_webhook_challenge.
    """
    ...
```

**Meta webhook payload structure (for reference):**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {"phone_number_id": "...", "display_phone_number": "..."},
        "contacts": [{"profile": {"name": "..."}, "wa_id": "31612345678"}],
        "messages": [{
          "id": "wamid.xxx",
          "from": "31612345678",
          "timestamp": "1234567890",
          "type": "text",
          "text": {"body": "Hello!"}
        }],
        "statuses": [{
          "id": "wamid.xxx",
          "status": "delivered",
          "timestamp": "1234567890",
          "recipient_id": "31612345678"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

## Phase 2: Webhook Endpoint

Create the FastAPI webhook routes for Meta callbacks.

### Tasks
- [ ] Create `src/webhooks/whatsapp_cloud_routes.py` with GET (verification) and POST (inbound) endpoints
- [ ] Register the router in `src/main.py`

### Technical Details

**`src/webhooks/whatsapp_cloud_routes.py`** follows the pattern of `instagram_routes.py`:

- `GET /webhooks/whatsapp` : Meta verification handshake (return `hub.challenge`)
- `POST /webhooks/whatsapp` : Receive messages + status updates
  - Parse messages via `parse_inbound_webhook()`
  - Parse statuses via `parse_status_updates()` and log them
  - Map to `process_inbound` format (same keys as Twilio: `message_sid`, `from_number`, `to_number`, `body`, etc.)
  - Add `channel: "whatsapp_cloud"` to webhook_data for downstream routing
  - Always return 200 (Meta requirement)
  - Process in background via `BackgroundTasks`

**Router registration in `src/main.py`:**
```python
from src.webhooks.whatsapp_cloud_routes import router as whatsapp_cloud_router
...
app.include_router(whatsapp_cloud_router)
```

**Webhook URL to configure in Meta dashboard:**
`https://webhooks.leadawaker.com/webhooks/whatsapp`

## Phase 3: Wire into send_service.py

Add `whatsapp_cloud` as a channel option in the unified send service.

### Tasks
- [ ] Add `whatsapp_cloud` channel branch in `tools/send_service.py`

### Technical Details

In `send_service.py`, add a new elif branch (after the voice note block, before the else/Twilio block):

```python
elif channel == "whatsapp_cloud":
    from tools.whatsapp_cloud import send_text_message as wa_send_text
    result = await wa_send_text(phone=phone, text=body)
    from_addr = settings.whatsapp_phone_number_id
    to_addr = phone
```

Note: Template messages are called directly from automation workflows, not through `send_service.py` (templates have different parameters: template_name, language, variables). The send_service only handles free-form text for the 24h reply window.

## Phase 4: Status Update Logging

Log delivery status updates to the Interactions table for read receipts / delivery tracking.

### Tasks
- [ ] Add status update handler in webhook routes that logs to Automation_Logs and optionally updates Interactions

### Technical Details

Status updates from Meta include: `sent`, `delivered`, `read`, `failed`.

Log each status change via `AsyncLogStep` to Automation_Logs. For `failed` statuses, include the error object from Meta:
```json
{"errors": [{"code": 131026, "title": "Message Undeliverable"}]}
```

Optionally update the corresponding Interaction row's metadata with delivery status (future enhancement, not blocking).

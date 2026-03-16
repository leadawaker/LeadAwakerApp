# Implementation Plan: DIY Email Service (#245)

## Overview

Build `tools/email_service.py` in `/home/gabriel/automations/` using aiosmtplib for SMTP sending, python-dkim for DKIM signing, and FastAPI endpoints for open/click tracking + unsubscribe. All sends logged via AsyncLogStep.

## Phase 1: Dependencies & Config

### Tasks
- [x] Add aiosmtplib and dkimpy to requirements.txt
- [x] Add SMTP and DKIM config fields to `src/config.py`
- [ ] Add SMTP credentials and DKIM key path to `.env` (manual: needs SMTP provider)

## Phase 2: DKIM Key Generation

### Tasks
- [x] Create DKIM key generation script at `scripts/generate_dkim.sh`

## Phase 3: Core Email Service

### Tasks
- [x] Create `tools/email_service.py` with `send_email()` function [complex]
  - [x] Build HTML email with MIME multipart (text + HTML)
  - [x] Add DKIM signing using dkimpy
  - [x] Add Message-ID, List-Unsubscribe, and tracking headers
  - [x] Inject open-tracking pixel into HTML body
  - [x] Rewrite links for click tracking
  - [x] Send via aiosmtplib with STARTTLS
  - [x] Log via AsyncLogStep

## Phase 4: Tracking & Unsubscribe Endpoints

### Tasks
- [x] Create `src/api/email_tracking.py` with FastAPI router for pixel, click redirect, and unsubscribe endpoints [complex]
  - [x] GET `/email/pixel/{tracking_id}.png` — returns 1x1 transparent PNG, logs open
  - [x] GET `/email/click/{tracking_id}?url=...` — logs click, redirects to original URL
  - [x] POST `/email/unsubscribe/{tracking_id}` — marks prospect as unsubscribed
  - [x] GET `/email/unsubscribe/{tracking_id}` — shows simple unsubscribe confirmation page
- [x] Create `tools/db/email_tracking.py` for DB operations (store/lookup tracking records)
- [x] Register email_tracking router in `src/main.py`

## Phase 5: Integration with send_service.py

### Tasks
- [x] Add "email" channel to `tools/send_service.py`

## Phase 6: Database Migration

### Tasks
- [x] Create migration SQL file for email_tracking table
- [ ] Run migration on Pi (manual)

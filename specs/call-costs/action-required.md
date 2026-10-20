# Call costs: action required

- [ ] **Restart the engine** (`pm2 restart leadawaker-engine`) so phone calls start being priced. Other uncommitted engine work goes live with the same restart (see the home-dashboard and receptionist-channels action lists).
- [ ] After the first real call, check `pm2 logs leadawaker-engine | grep -E "voice.phone.usage_first|voice.phone.cost"`. Two things to confirm:
  - `usage_first` shows a `seconds` field.
  - `cost.backend` is above 0. If it stays 0, GPT-Live does not forward the backend's `response.done` usage, and backend cost needs another source.
- [ ] Copy Telnyx's real NL inbound per-minute rate from the portal rate card into `TELNYX_TRUNK_PER_MIN` in `automations/src/automations/voice/call_costs.py`, and bump `PRICES_VERSION`.
- [x] Migration `scripts/migrate_add_voice_call_cost.py` run on 2026-10-15.

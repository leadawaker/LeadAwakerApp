# Instagram connect + publishing: Action Required (manual steps)

Spec: `docs/superpowers/specs/2026-10-19-instagram-connect-and-publishing-design.md`
Plan: `docs/superpowers/plans/2026-10-19-instagram-connect-and-publishing.md`
Branch: `feat/instagram-publishing` (cut from `wip/all-work-2026-10-20`). Not merged, not on `main`.

Tasks 1 to 9 are built. Tasks 6 to 9 were built in a cloud session without a database, pm2,
a browser or a live Meta app: every server test runs on in-memory fakes, and nothing below has
been run against the real Pi. Task 10 needs a human, the live Meta app and Augusto's phone.

## 1. On the Pi, before anything else
- [ ] Check out `feat/instagram-publishing` on the Pi (or merge it into the branch the Pi runs).
- [ ] Tables: run `node --env-file=.env script/create-social-tables.mjs` if Task 1 did not already
      run it on this database. It is idempotent: a second run changes nothing.
- [ ] Run all Social tests on the Pi (ffmpeg is there, so the 4 ffmpeg tests run instead of skipping):
      `node --import tsx --test shared/socialPosts.test.ts server/social/*.test.ts client/src/features/social/lib/*.test.ts`
- [ ] `pm2 restart leadawaker`, then `pm2 logs leadawaker --lines 60 --nostream`. Expect
      `[social-publisher] started (60s)` and `[social-tokens] started (6h)`, and no import errors.
- [ ] Type check once, when Gabriel wants one (`npx tsc --noEmit`). The cloud session did not run tsc,
      per CLAUDE.md. Only esbuild syntax checks and the node tests ran.
- [ ] Optional env: `SOCIAL_MEDIA_BASE_URL` (default `https://app.leadawaker.com`), the host Meta
      downloads the video from.

## 2. Smoke tests on the Pi (plan Tasks 5 and 6, never run)
- [ ] `curl -s -o /dev/null -w "%{http_code}" https://app.leadawaker.com/api/social/accounts/1/status` returns `401`.
- [ ] `curl -s -X POST -d "signed_request=garbage" -o /dev/null -w "%{http_code}" https://app.leadawaker.com/api/social/instagram/deauthorize` returns `400`.
- [ ] `curl -s "https://app.leadawaker.com/api/social/oauth/instagram/callback?code=x&state=bad" -o /dev/null -w "%{redirect_url}"` ends in `/platform/accounts?instagram=error&reason=invalid_state`.
- [ ] As agency (session cookie), on a test account with Social on and a connection:
      `curl -b cookie.txt -H "Content-Type: video/mp4" --data-binary @clip.mp4 https://app.leadawaker.com/api/social/accounts/<id>/uploads`
      returns JSON with `uploadId`. The same request with `Content-Type: video/webm` returns `415`.
- [ ] `https://app.leadawaker.com/media/social/<uploadId>.mp4` returns `404` before a post uses it, `200` after.

## 3. Check in the browser (plan Tasks 8 and 9 Step 5, never run)
- [ ] As agency on a test account: Integrations shows a fifth tile "Instagram" and the Social group
      with the switch and the card. Switching Social on survives a reload.
- [ ] Impersonate a Viewer of that account: the Social group shows, with no Connect or Disconnect button.
- [ ] Visit `/platform/accounts?instagram=error&reason=not_professional`: Integrations opens on Social,
      the translated message shows as a toast, and the URL is cleaned.
- [ ] Social tab: create a post with a short test clip for tomorrow; it shows under "Needs approval".
      Impersonate a Manager and approve it. Edit the caption as agency; it goes back to "Needs approval".
- [ ] Check the Social tab and the New post panel at 375 px wide and in dark mode.
- [ ] Read the pt-BR strings (`client/src/locales/pt/accounts.json`, keys `social.*`,
      `integrationGroups.social`) and the client notifications in `server/social/notify.ts`. Gabriel reviews the Portuguese.

## 4. Meta details to confirm at build time (plan "Left to the builder")
- [ ] AI label field name: `AI_LABEL_PARAM = "is_ai_generated"` in `server/social/instagramApi.ts`.
      Confirm it in the IG User Media reference and change only that constant if it differs.
- [ ] Graph version: `IG_GRAPH = https://graph.instagram.com/v26.0` in the same file. Confirm it against
      the content-publishing reference.
- [ ] Cloudflare: Meta must be able to fetch `/media/social/*`. From outside the home network,
      `curl -sI https://app.leadawaker.com/media/social/<publicId>.mp4` must return `200`,
      `content-type: video/mp4` and `accept-ranges: bytes`. If Cloudflare shows a challenge page,
      add a WAF skip rule for `/media/social/*`.
- [ ] Cloudflare caps request bodies at 100 MB on this plan; the upload cap is 100 MB to match.

## 5. Task 10: first real post (Gabriel and Augusto)
- [ ] Gabriel merges `feat/instagram-publishing` into `main` and pushes (Vercel frontend), and the Pi
      runs the server code (`pm2 restart leadawaker`). Only when Gabriel says so: `main` auto-deploys.
- [ ] Create Augusto's account (timezone `America/Sao_Paulo`, language Portuguese) and a Manager user
      for him, then switch Social on for the account.
- [ ] Augusto accepts the Instagram Tester invite, logs in on his phone and taps Connect Instagram.
      Expected: the card shows his @username. In `Social_Connections`: `status = connected`, five scopes,
      `token_expires_at` about 60 days out, `access_token_enc` starting with `v1:`.
- [ ] Do the Cloudflare check in section 4 with a real public id.
- [ ] Gabriel schedules the theme 1 video about 10 minutes ahead with approval on. Augusto approves.
      Expected: within about 2 minutes of the time the post shows "Published" with a permalink, the
      Reel is on his profile with the AI label, and both get a notification.
- [ ] Screen-record connect, schedule and the post going live, for App Review later (only
      `instagram_business_basic` and `instagram_business_content_publish` in the first submission).

## 6. Known gaps and choices made in this build (decide or accept)
- **Approve carries a version.** Approve sends the post's content version (caption and video). If the
  agency changed either after the Manager loaded the list, the approval is refused (409 `changed`)
  instead of approving something unseen. Not in the plan; added after review.
- **Publish errors never fail at once.** If `media_publish` errors, the post stays "publishing" and the
  next tick checks the container: `PUBLISHED` means it went out, and only a later tick that still sees
  `FINISHED` (past 15 minutes) fails it. So Retry can never post a Reel twice.
- **The publisher's claim is conditional** on status, approval, caption, video, time and toggles. A Manager
  rejecting, or the agency editing or rescheduling during a tick, wins; the unused container expires at Meta.
- **The return after connecting** goes to `/platform/accounts?instagram=…` without an account id. A client
  lands on their own account. An agency user lands on whichever account is selected; on a phone with
  nothing selected, they pick the account by hand. The server could add `&account=<id>` later.
- **No publishing quota left:** the post waits and is retried every minute with a log line, no notification.
- **Client notifications** go to the account's Managers only (needs approval, published), not Viewers.
- **Orphan uploads** (never used by a post) are deleted after 24 h by the 6-hourly job.
- `server/social/upload.ts` `findUpload` is no longer used by the routes (`postRoutes.ts` has its own,
  which also re-probes the file); it is kept with its test.

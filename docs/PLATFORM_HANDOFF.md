# P0 platform handoff — Task #1

## Delivered scope

This work finishes the local platform layer: `apps/web`, `apps/api`, `packages/core`, `packages/plugin-sdk`,
`packages/design-system`, root test tooling/lockfile, and platform documentation.
No `plugins/` business files were changed.
Existing plugin business behavior remains the responsibility of each plugin owner.

The shell now mounts Home, PluginCenter, PluginHost, Timeline and Assistant through hash routes:
`#/`, `#/plugins`, `#/plugins/<encoded-id>`, `#/timeline`, `#/ai`.
Refresh and browser history preserve routes. Invalid percent escapes fall back to the plugin center.
Navigation has current-page semantics, heading focus and a keyboard skip link.
Shared design-system styles own buttons, fields, cards, notices and dialogs;
shell styles cover layout, responsive navigation and content.
Theme follows the system on first use and persists valid light/dark selections when storage permits.

PluginHost isolates rendering failures, provides retry, runs activation/cleanup,
and creates fresh contexts during React StrictMode effect replay.
Consent and theme updates do not recreate the active context.
Initialization failures dispose the context and suppress plugin rendering.

## Actual public APIs

`@zaitu/plugin-sdk` exports `ZaituPlugin`, `PluginContext`, `PluginStorage`, `LifeEvent`, `ChatMessage`,
`Permission`, `PluginCategory`, `PERMISSIONS`, and `CATEGORIES`.

Core APIs:

- `registerPlugins(plugins)`, `validatePlugin(plugin)`:
  Validate declarations and reject duplicate ids; freeze the returned list.
- `readEnabled()`, `isEnabled(id)`, `setEnabled(id, boolean)`:
  Local enabled state; defaults to enabled.
  Persisted nonboolean values are ignored, runtime setter arguments are checked.
- `makeContext(plugin, { requestAIConsent })`:
  Returns SDK capabilities plus host-only `dispose()`. Options should have stable identity.
- `context.publish({ type, data })`:
  Requires `timeline.write`, enabled state and a live context; stamps id, source and time.
- `context.readTimeline()`:
  Requires `timeline.read`, enabled state and a live context; returns all local timeline events.
- `context.invokeAI(messages)`:
  Requires `ai.invoke`; asks consent before forwarding, coalesces concurrent consent prompts within this context,
  rechecks lifecycle/consent after waiting.
- `context.dispose()`:
  Permanently rejects future timeline/AI calls and aborts in-flight AI fetches. Host calls this before plugin cleanup.
- `createPluginStorage(id)`, `clearPluginData(id)`:
  Keys use `zaitu.plugin.<id>.`; ids must match `zaitu.<lowercase-name>`.
  Storage supports `get(key, fallback)`, `set(key, value)`, `remove(key)`.
- `readEvents()`, `appendEvent(source, event)`, `deleteEvent(id)`, `clearEvents(source?)`:
  Browser-local timeline; optionally clear only one source.
- `subscribeTimeline(listener)`:
  Same-tab change notifications; returns unsubscribe. Web hook also handles browser storage events.
- `exportTimeline()`, `importTimeline(payload)`:
  Versioned JSON backup and validated merge; import returns `{ added, skipped }`.
- `readAIConsent()`, `setAIConsent(id, boolean)`:
  Persisted AI consent with same-process revision tracking to reject stale pending approvals.
- `chat(messages, signal?)`:
  Shared client for `POST /api/chat`; validates success shape and presents readable errors.
- `readJSON(key, fallback)`, `writeJSON(key, value)`:
  Parse/read failures fall back; failed writes throw a user-readable error. Callers validate domain-specific shapes.

No callback-style legacy `makeContext(plugin, refresh)` adapter remains:
the old shell was the caller and now uses `ContextOptions`.
Timeline subscribers replace manual refresh callbacks.
The plugin-facing context methods remain compatible and storage is additive.

## Storage and import contract

Timeline retains `zaitu.timeline.v2` with `{ version: 2, events }`; no operation log or tombstones are stored.
Mutations synchronously read/modify/write that table only while the page holds the exclusive Web Lock
`zaitu.timeline.writer`. No localStorage CAS or localStorage-based lock is used.

The timeline module requests the lock asynchronously on browser module evaluation, before React mounts.
No core index or host initialization change is required. The request uses `ifAvailable: true` and holds the lock
by keeping its callback promise pending for the page lifetime. Repeated initialization shares the same attempt.
`initializeTimeline()` in the timeline module waits for an attempt, not for page closure or guaranteed ownership.
React StrictMode, subscriber cleanup, route changes, and plugin disposal do not release this page-level lock.

Before readiness, writes throw `足迹写入保护正在初始化，请稍后重试`.
Non-owner writes throw `另一页面正在编辑，请关闭后重试` and start another asynchronous acquisition attempt.
After closing the owner, retry once to request the lock, then retry the action after initialization completes.
No failed action is queued or automatically replayed. Missing Web Locks or rejected requests fail closed with
`浏览器写入保护不可用，请使用支持 Web Locks 的安全页面后重试`; reads and exports remain available.

`pagehide` immediately revokes local write permission and resolves the lock lifetime promise.
Browser page destruction also releases the Web Lock. On `pageshow` after suspension, including bfcache restoration,
the page must acquire again. A generation check prevents stale acquisition callbacks from granting permission.
All writers must use this protocol; an old client or direct localStorage writer can bypass the lock.

Only the owner migrates v1 arrays to v2. Non-owners synchronously read v2, or valid v1 data when v2 is unavailable.
Migration filters invalid rows, persists v2 before removing v1, and prefers valid v2 over stale v1.
Cleanup failure is retried; mutations propagate it so a delete cannot succeed while a stale v1 payload remains.
Read-time migration failures preserve readable legacy data. Malformed JSON and denied reads do not crash the shell.
Failed writes preserve the previous v2 table and do not notify subscribers.
Same-tab notifications follow successful writes; the web hook continues listening to timeline storage events.

Imports accept only `{ app: "zaitu", kind: "timeline", version: 2, exportedAt, events }`.
The informational `exportedAt` field is not used for validation or ordering.
Unknown versions, wrong kinds and bare arrays are rejected. V1 arrays are supported only for local migration.

Events need a nonempty string id, `domain.verb` type, valid plugin source, parseable date and object data.
Reads/exports deduplicate by id and sort newest first; equal timestamps are ordered by id.
Append/import physically retain at most 500 rows in v2. Evicted rows cannot reappear after newer rows are deleted.
Delete/clear physically remove matching payloads from the stored JSON; source-filtered clear preserves other sources.
There is no hidden history, deletion log, or unbounded accumulation of operation keys.
Existing ids win during import. `added` counts unique valid incoming events retained after the cap;
`skipped` includes invalid, duplicate and capacity-excluded rows. Storage/quota errors remain explicit.
Browser import UI rejects files larger than 5 MB. Export excludes private plugin data, theme and consent.

## Consent and trust boundaries

`timeline.read` is **declared capability checking only**, not user authorization.
A bundled plugin declaring it can read the entire timeline.
The plugin center and SDK explicitly state this limitation. `profile.read` is reserved and has no implementation.

AI consent is a separate browser-local decision shown before a plugin's first AI invocation
and revocable in PluginCenter.
A pending approval cannot revive a disposed/disabled context or overwrite a same-process revocation.
Navigation dismisses pending consent. Concurrent requests in one context share the prompt;
an overlapping host prompt from another caller is denied rather than replacing an unresolved decision.

Disposal aborts outstanding fetches on a best-effort basis. Revoking consent prevents subsequent sends;
it cannot retract content already sent, nor does revocation itself cancel an already-sent request.
Cross-tab consent state is reread before sending,
but same-process revision tracking is not a distributed authorization protocol.

All bundled plugins execute in the same JavaScript origin. Namespaces prevent accidental key collisions;
they do not prevent direct localStorage/fetch access.
Neither this implementation nor its error boundary is a malicious-code sandbox.
Plugin-owned async/event-handler errors still need plugin-owned handling.
Private data written directly under legacy plugin keys is not automatically migrated or cleared by `clearPluginData`.

Assistant is a distinct explicit-send flow: it displays the provider disclosure, keeps chat only in page memory,
supports stop/retry/clear, and sends recent history capped to gateway limits.
It does not automatically attach timeline data.

## Gateway contract and configuration

`GET /api/health` returns `{ ok, aiConfigured, dailyRemaining }`; it never returns the key.

`POST /api/chat` requires JSON `{ messages: [{ role: "user" | "assistant", content: string }] }`,
1–24 messages, nonblank content up to 5,000 characters per message, last role `user`,
and at most 24,000 request bytes. It returns `{ message: string }` or `{ error: string }`.
Client system messages and extra fields are not forwarded; the gateway adds its own system prompt and token cap.

Oversized Content-Length and chunked requests receive readable JSON 413 responses
without destroying the socket before the response.
A 30-second provider deadline covers both headers and JSON body parsing.
Invalid success payloads become 502; provider auth/balance failures become 502,
provider throttling 503, and deadline expiry 504. Client throttling/budget exhaustion is 429.
Logs include error class/status only, not message bodies, credentials or provider response bodies.

Configuration is loaded from root `.env` by the server entry point;
tests inject configuration and fake provider responses without loading that file.

| Environment variable | Default |
| --- | --- |
| `DEEPSEEK_API_KEY` | Empty; chat returns 503 until configured |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | `deepseek-chat` |
| `API_HOST` | `127.0.0.1` |
| `API_PORT` | `8787` |
| `AI_MAX_TOKENS` | `1024` |
| `AI_RATE_PER_MINUTE` | `20` per socket IP, fixed window |
| `AI_DAILY_LIMIT` | `300` forwarded attempts per server-local day |

Budget and rate counters are process-local and reset on restart. Failed provider calls consume daily budget.
These limits bound requests/tokens, not actual monetary cost. Forwarded proxy IP headers are not trusted.
The default is a local single-user gateway without authentication; public hosting needs additional deployment hardening.
The Vite development proxy is not a production API deployment.

## Verification evidence

Timeline single-writer revision: 37 tests passed across core (19), timeline (14), App (3), and Assistant (1).
`npx tsc --noEmit -p apps/web/tsconfig.json` passed.
The controllable Web Locks mock checks exclusivity, delayed callbacks, pagehide/pageshow, retry and denied requests.
Storage assertions check physical deletion, 500-row eviction without revival, and migration cleanup failures.
These are deterministic lifecycle tests, not real-browser multi-tab/bfcache end-to-end verification.

Initial platform handoff verification:

Validated on Node 22 using `PATH=/opt/homebrew/opt/node@22/bin:$PATH`:

- `npm install`: succeeds; updated lockfile, Vitest 5.0.5,
  zero reported dependency vulnerabilities after replacing the initially selected older runner.
- `npm run typecheck`: web, SDK/core and API TypeScript checks pass.
- `npm test`: 33 tests across three files pass: 19 core, 11 API, 3 UI.
- `npm run build`: Vite production web build passes.

Core regression tests cover permission failures, enabled settings, namespace rejection, consent reuse/concurrency,
late approvals after disposal/disable/revocation, abort on disposal, malformed/denied storage,
migration write failures, strict import versions and capped import counts.

API tests run a real ephemeral loopback HTTP server with fake provider fetches:
health/config, payload validation, chunked oversize 413, forwarding whitelist/token limits,
client and daily limits, provider errors, malformed responses, and stalled headers/body deadlines.

UI tests run in jsdom with a fixture plugin, React StrictMode, dialog method stubs and fake fetch.
They verify stable contexts during theme/consent updates, explicit consent before sending,
route navigation/current-page state, cleanup/revocation, pending-consent cancellation and malformed URL handling.
They do not establish real-browser dialog focus trapping, visual layout at 375px,
screen-reader behavior or live provider connectivity; those remain manual acceptance checks.

Verification made no real provider requests and did not read or print secrets.
`.github/workflows/ci.yml` runs dependency installation, type checking, tests and the web build
on Node 22 for pushes and pull requests. This CI configuration has not yet run remotely.
Cloud/auth services and cross-plugin workflows remain outside this delivery.

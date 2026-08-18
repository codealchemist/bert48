# Per-invitee RSVP links with admin management

## Context

The invitation page has a per-invitee flow: each invitee gets a unique link (`/i/:guid`) that pre-fills their name and lets them confirm or cancel attendance with one button, select their food preference, and say how many people are coming with them. A password-protected admin page lets the host add invitees and grab their links. Data is stored in Netlify Blobs, read/written through Netlify Functions.

Decisions:

- **Admin auth**: single shared password (`ADMIN_PASSWORD` env var), sent as a bearer token from the admin page.
- **Invitee links**: clean path `yoursite.com/i/<guid>`, served by rewriting `/i/*` to `/index.html` (status 200) via a Netlify redirect. Because it's a 200 rewrite (not a 3xx redirect), the browser's address bar keeps showing `/i/<guid>` — `rsvp.js` reads the guid straight from `location.pathname` rather than depending on Netlify substituting it into a query string, which is a much less reliable mechanism.
- **Cancel is not final**: a cancelled invitee still sees a "confirm attendance" button and can flip back.
- **Menu preference stays**: kept as part of the confirm step (same 4 options as today).
- **Guest count**: a single non-negative integer per invitee representing people coming with them (not itemized by name or menu preference — just a headcount), editable any time they update their RSVP, capped at 20 as a sanity bound.

## Data model

One JSON blob per invitee in a Netlify Blobs store named `invitees`, keyed by guid:

```json
{
  "id": "‹uuid›",
  "name": "Juan Pérez",
  "status": "pending | confirmed | cancelled",
  "menuPreference": "tradicional | veggie | sin-gluten | keto | null",
  "guestCount": "non-negative integer, 0-20, default 0",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

`pending` = never responded, `cancelled` = confirmed then backed out (kept distinct from `pending` so the admin list shows real history). Both `pending` and `cancelled` render the same "confirm attendance" UI to the invitee. The guid itself is the invitee's capability token — nothing else gates the public RSVP endpoints, which is the standard/acceptable model for this kind of link.

## Files

**`netlify/functions/lib/store.js`** — shared helper:

- `getInviteesStore()` → `getStore('invitees')` from `@netlify/blobs`.
- `requireAdmin(request)` → checks `Authorization: Bearer <token>` against `process.env.ADMIN_PASSWORD`, returns a 401 response if it doesn't match.

**`netlify/functions/invitees.js`** — Netlify Functions v2, `path: "/api/invitees"`, admin-only (via `requireAdmin`):

- `GET` → list all invitee records (`store.list()` + `store.get(key, {type:'json'})` per key — guest list is small, no need for an index).
- `POST` body `{ name }` → generates `crypto.randomUUID()`, writes a new `pending` record, returns `{ id, name, link: "/i/<id>" }`.

**`netlify/functions/rsvp.js`** — Netlify Functions v2, `path: "/api/rsvp/:guid"`, public:

- `GET` → return the record for `context.params.guid`, or 404 JSON if missing.
- `POST` body `{ action: "confirm" | "cancel", menuPreference?, guestCount? }` → `confirm` requires a valid `menuPreference` and a `guestCount` that's an integer between 0 and 20, sets `status: "confirmed"`; `cancel` sets `status: "cancelled"` and leaves `menuPreference`/`guestCount` as-is. Updates `updatedAt`. Returns the updated record, 404 if guid unknown.

**`netlify.toml`** — `build.command = "npm run build"`, `publish = "dist"`, `functions = "netlify/functions"`, plus one redirect: `/i/*` → `/index.html` (status 200 rewrite, splat form — the guid segment isn't referenced in `to` at all since the client reads it back out of the still-visible `/i/<guid>` URL). No redirect needed for `/api/*` since Functions v2 `path` config handles routing directly.

**`src/admin.html`** + **`src/admin.js`** — separate Vite entry:

- Password gate: single input, "Ingresar" button; stores the entered value in `sessionStorage` and uses it as the bearer token on every `/api/invitees` call. A failed call (401) clears it and re-prompts — no separate login endpoint needed.
- Form: "Nombre y apellido" input + "Generar invitación" button → `POST /api/invitees`.
- Summary panel below the create form, led by a hero stat: total confirmed headcount (`invitados confirmados + sus acompañantes`, summing `1 + guestCount` over `status: "confirmed"` invitees) shown as one big number in its own highlighted block, above everything else — it's the number the host actually needs for the venue/catering, so it gets top billing rather than sitting as a text line among the other counts. Below it, the smaller stat tiles (total invitees / pending / confirmed / cancelled) and a menu-preference breakdown (tradicional / veggie / sin-gluten / keto) of that same confirmed headcount — guests are assumed to eat the same menu choice as the invitee they're attached to, since guest count is a bare number with no identity or menu of its own. All computed client-side from the same `GET /api/invitees` response used to build the table — no new endpoint needed — and recomputed on every refresh.
- Table of existing invitees: name, status badge, guest count, generated link (`/i/<id>`) with a copy-to-clipboard button. Refreshes after each new invite.
- "Exportar CSV" button next to the summary: builds a CSV client-side from the same in-memory invitee list (columns: Nombre, Estado, Preferencia de menú, Acompañantes, Link, Creado, Actualizado — status and menu preference written out as their Spanish labels, not the raw codes) and triggers a download (`Blob` + a temporary `<a download="invitados.csv">` click). No new endpoint — it's a formatting/export step over data the admin already has loaded. Values are CSV-escaped (quoted, doubled internal quotes) since names can contain commas or quotes.
- Reuses the dark/light theme tokens and `.fi` icon classes from `index.html` for visual consistency.

**`vite.config.js`** — multi-page build: `build.rollupOptions.input = { main: 'src/index.html', admin: 'src/admin.html' }`. Also sets `server.host = '127.0.0.1'` so the Vite dev server is reliably visible to `netlify dev`'s port probe.

**`package.json`** — adds `@netlify/blobs` (runtime dep for the functions) and `netlify-cli` (devDependency, so `netlify dev` runs Vite + the functions + Blobs emulation together on one port). Adds a `dev:netlify` script.

**`.gitignore`** — ignores `.env` (local `ADMIN_PASSWORD` for `netlify dev`) and `.netlify`. **`.env.example`** documents `ADMIN_PASSWORD=changeme`.

**`src/index.html`** RSVP section — the free-form `#rsvpForm` becomes an empty `#rsvpContent` container driven by JS.

**`src/rsvp.js`** — drives the RSVP box:

- On load, reads the guid from `location.pathname` (matching `/i/<guid>`), falling back to a `?guid=` query param for direct local testing without the redirect. No guid → static "esta invitación es personal, pedí tu link" message, no form.
- With a guid: fetches `GET /api/rsvp/:guid`.
  - 404 → "Invitación no encontrada" message.
  - Found → reveals a `¡Hola <name>!` greeting at the top of the page (above the header, in `#inviteeGreeting`, hidden until an invitee is actually resolved) instead of repeating the name inside the RSVP box, plus a menu-preference `<select>` and a `guestCount` number input (min 0, max 20, defaults to 0 / the invitee's last saved value) in the box itself:
    - `pending`/`cancelled` → "Confirmar asistencia" button → `POST /api/rsvp/:guid` `{action:"confirm", menuPreference, guestCount}`.
    - `confirmed` → confirmed badge + the same menu `<select>` and `guestCount` input (both prefilled with the current values) with an "Actualizar datos" button → `POST /api/rsvp/:guid` `{action:"confirm", menuPreference, guestCount}` again, so a confirmed invitee can change their food preference or guest count without cancelling first — plus a separate "Cancelar asistencia" button → `POST /api/rsvp/:guid` `{action:"cancel"}` (which leaves `menuPreference`/`guestCount` untouched, so re-confirming restores them).
  - `rsvp.js`'s `confirm` action overwrites `menuPreference` and `guestCount` unconditionally on every confirm call, whatever the invitee's prior status was — that's what makes "update while confirmed" work with no separate update endpoint.

## Netlify setup (CLI)

The site needs to exist on Netlify before Blobs/Functions/env vars work end-to-end. `netlify-cli` is already a devDependency, so run everything through `npx netlify` (or `npm run dev:netlify` for local dev).

1. **Log in**

   ```
   npx netlify login
   ```

   Opens a browser to authorize the CLI against your Netlify account.

2. **Create or link the site**
   - New site: `npx netlify init` — walks through creating a Netlify site, detects the build command (`npm run build`) and publish dir (`dist`) from `netlify.toml`.
   - Existing site: `npx netlify link` — connects this local folder to a site you already created in the Netlify dashboard.

3. **Set the admin password**

   ```
   npx netlify env:set ADMIN_PASSWORD "your-real-password"
   ```

   This sets it on the deployed site. For local dev, copy `.env.example` to `.env` and fill in a value there instead — `netlify dev` reads `.env` automatically.

4. **Run it locally**

   ```
   npm install
   npm run dev:netlify
   ```

   This starts Vite plus a local emulation of the Functions and the Blobs store on one port, so `/api/*` and `/i/:guid` behave the same as production.

5. **Deploy**
   ```
   npx netlify deploy --prod
   ```
   Builds via `npm run build` and publishes `dist/`, along with the functions in `netlify/functions`. Netlify Blobs requires no separate provisioning — the store is created automatically the first time a function writes to it.

## Verification

1. Visit `/admin.html`, enter the admin password, create an invitee, copy the generated `/i/<guid>` link.
2. Open that link in a private/incognito window: confirm the name is prefilled, confirm attendance with a menu choice and a guest count, reload and verify state persists (served from the blob), then cancel and verify the UI flips back to the confirm state.
3. While confirmed, change the menu choice and/or guest count via "Actualizar datos" and verify it saves without needing to cancel first.
4. Reload `/admin.html` and verify the invitee's status and guest count reflect the confirm/cancel/update actions, and that the stat tiles, confirmed headcount line, and menu-preference breakdown all update accordingly.
5. Submit a `guestCount` outside 0-20 (or non-integer) directly against the API and confirm it's rejected with a 400.
6. Hit `/i/<bogus-guid>` and confirm the "not found" state renders instead of an error.
7. Click "Exportar CSV" on `/admin.html` and confirm the downloaded file opens cleanly in a spreadsheet app, with one row per invitee and correct status/menu-preference/guest-count values, and that a name containing a comma or quote survives round-trip.
8. `npm run build` to confirm the multi-page Vite build emits both `index.html` and `admin.html` into `dist/`.

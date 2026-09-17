# Social Lab Growth Hub: build guide

Stack: **Lovable** builds the screens, **Lovable Cloud** holds the database and logins, **GitHub** stores the code, and **VS Code + Claude Code** handle the deeper work.

What's already built and tested in this folder:

| File | What it is |
|---|---|
| `supabase/migrations/20260917000000_growth_hub.sql` | The whole database: every table, the team-only access rules, default targets and lists, your 5 team emails, the 30-day checklist |
| `src/lib/metrics.ts` | Every dashboard calculation (conversion, speed to lead, AOV, CAC, churn, LTV, LTV:CAC, trends, channel table, pricing signal, bottom 30%, price test) |
| `src/lib/capacity.ts` | Capacity planner maths from the Team and Capacity Planner tabs |
| `src/lib/format.ts` | AUD and dd/mm/yyyy formatting |
| `src/server/integrations/*` | Integrations: mail server scanning with AI triage, Instagram DMs, Meta Ads, Calendly bookings |
| `tests/` | 18 tests covering the maths, email parsing, Meta actions, Instagram timing and Calendly signatures (`deno task test`) |

---

## Step 1. Create the project in Lovable (you, about 5 minutes)

1. Go to lovable.dev and start a new project.
2. Paste **Prompt 1** below. When Lovable asks to enable **Lovable Cloud**, say yes.
3. Paste the full contents of the migration file where the prompt says to. Approve the migration when Lovable asks.

## Step 2. Connect GitHub (you, about 2 minutes)

In Lovable, open the **GitHub** menu, choose **Connect**, then **Create repository** and name it `social-lab-growth-hub`. Lovable pushes the project to your GitHub, and edits sync both ways from then on.

## Step 3. Bring in the tested code (Claude Code)

In VS Code: **Clone Git Repository** > `social-lab-growth-hub`. Open the Claude Code panel and say:

> Copy src/lib, supabase/functions, tests and the config.functions.toml blocks from ~/Documents/social-lab-hub into this repo, then commit and push.

Lovable picks up the push within a minute.

## Step 4. Build the screens (Prompts 2 to 7, one at a time in Lovable)

Check each one works before sending the next.

## Step 5. Add the team

Lovable Cloud > **Users** > **Add user** for each of: dan@, blake@, digital@, emily@, chloe@sociallab.com.au. Anyone who isn't in `team_members` is blocked by the database even if they somehow get a login.

## Step 6. Switch on integrations

See **Integrations setup** at the bottom.

---

## Prompt 1: foundation, database and login

```
Build an internal growth dashboard for Social Lab, a Gold Coast marketing agency. Use Lovable Cloud for the database and authentication.

Enable Lovable Cloud, then run this SQL migration exactly as written. It creates every table, the row level security and the defaults. Do not change table or column names:

<PASTE THE WHOLE CONTENTS OF supabase/migrations/20260917000000_growth_hub.sql HERE>

Authentication:
- Email and password login only. No sign-up page, no public sign-up (turn sign-ups off), no social logins.
- Add "Forgot password" (email reset link).
- After login, check the user's email exists in public.team_members with active = true. If not, sign them out and show "This account isn't on the Social Lab team list."
- Every page except /login requires a session.

App shell only for now (no page content yet):
- Left sidebar on desktop, bottom tab bar on mobile: Dashboard, Leads, Daily Log, Clients, Capacity, Settings.
- Top bar: Social Lab logo text, a service line filter (All, then the active list_items where list = 'service_line'), a prominent "Log today" button (it will open a dialog later), and the signed-in user's name with sign out.
- Keep the service line filter in a React context so every page can read it, and persist it in the URL (?service=).
- Currency is AUD, dates display as dd/mm/yyyy, timezone Australia/Brisbane.
- Design: clean, fast, mobile friendly. Light and dark mode. Neutral surfaces, one accent colour (#2a78d6). Status colours: good #0ca30c, warning #fab219, critical #d03b3b, always paired with an icon and a label, never colour alone.
```

## Prompt 2: shared calculations (after Step 3)

```
The repo now contains src/lib/metrics.ts, src/lib/capacity.ts and src/lib/format.ts. These are tested and are the single source of truth for every number in the app. Never reimplement a calculation in a component. Import from these files. Use formatAUD, formatPct and formatDate from src/lib/format.ts everywhere money, percentages or dates are shown. Date inputs accept dd/mm/yyyy (parseAUDate) and store ISO dates.

Create typed data hooks with TanStack Query for: settings (single row id = 1), list_items grouped by list, daily_entries, clients (read from the clients_with_stats view), leads, meta_ads_daily, integration_runs, checklist_items, staff, packages, location_defaults. Invalidate the relevant queries after every mutation. No page UI changes yet.
```

## Prompt 3: Daily Log and the "Log today" dialog

```
Build the Daily Log. The data is public.daily_entries (one row per date + channel + service_line, unique) and public.daily_checkins (one row per day).

1) Daily Log page
- Quick entry form at the top defaulting to today: date, channel (select from list_items 'channel'), service line (select), new leads, responded within 30 min, meetings held, clients won, value won ($/month), marketing spend, notes. Channel and service line are required. Numbers default to 0, must be >= 0, and responded within 30 min cannot exceed new leads. Saving the same date + channel + service line again updates that row (upsert on the unique key).
- Below it, an editable table of past entries: newest first, inline edit, delete with confirm, filter by date range, channel and the global service line filter. Show a totals row.

2) "Log today" dialog (the button in the top bar). One guided 3-step check-in, designed to take about 5 minutes. Every step is required before Save.

Step 1 Inbox: list leads where status = 'pending' (auto-captured from email and Instagram). Show source icon, received time, name/handle, subject, ai_summary, and the AI suggestion (ai_is_lead + ai_reason) as a small badge. Each needs a decision:
  - "Lead": requires channel and service line (prefilled from the lead when present). Sets status = 'new', reviewed_by, reviewed_at.
  - "Not a lead": sets status = 'rejected'.
  - "Not a fit": sets status = 'nurture', fit = 'not_fit', and shows a copy-to-clipboard reply that offers the free resource (settings.not_fit_resource_url).
  Also show a "Did it happen?" yes/no for leads with status 'meeting_booked' and meeting_at before now. Yes sets 'meeting_held', no sets 'contacted'.
  Continue is disabled until every item has a decision.

Step 2 Today's numbers: an editable grid, one row per channel + service line, PREFILLED from the CRM for the selected date (default today, Australia/Brisbane):
  - new leads = leads with status not in (pending, rejected) and received_at on that date
  - responded within 30 min = those whose first_response_at - received_at <= 30 minutes (use responseMinutes from metrics.ts)
  - meetings held = leads that moved to meeting_held with meeting_at on that date
  - clients won = leads with won_at on that date, value won = sum of won_value
  - marketing spend on the "Meta Ads" row = sum of meta_ads_daily.spend for that date. Put it on the Meta Ads row with the most leads, or Digital & Brand if none.
  If daily_entries already exist for that date, load those values instead. Rows can be added (for phone calls and referrals that never hit the CRM) and edited. Show a small "auto" tag on prefilled cells. Same validation as the form.

Step 3 Wrap up: highlights (optional), blockers (optional), and a summary of today's totals vs target (leads today vs weekly target / 5, speed to lead vs 90%). Save upserts all daily_entries rows and inserts/updates daily_checkins for the date with leads_reviewed = number of inbox decisions.

The top-bar button shows a green tick with "Logged" once today's check-in exists, and turns amber after 4pm if it hasn't been done.
```

## Prompt 4: Dashboard

```
Build the Dashboard as an easy-to-read hub. Every number comes from src/lib/metrics.ts. The global service line filter applies to everything (filterByService on daily entries and clients). Use Recharts. Rules: one y-axis per chart (never dual axis), thin 2px lines, rounded bar ends, recessive grid, hover tooltip on every chart, no number on every point, AUD and dd/mm/yyyy.

Sections, top to bottom:

1. Check-in strip: the last 14 days as small squares (logged / missed / weekend), the current streak, and the Log today button.

2. "The three numbers for Monday": three large tiles. Leads last 7 days vs target_leads_per_week, speed to lead last 7 days vs target_responded_30, and conversion month to date vs target_conversion. Each shows a progress bar to target and a status icon + label (On target / Close / Off target).

3. Scorecard table: columns Today, Last 7 Days, Month to Date, Target (use scorecards() and leadTargets()). Rows: New leads, Speed to lead %, Meetings held, Clients won, Conversion %, Value won ($/mo), Average order value, Marketing spend, CAC. Highlight conversion above 40% in amber with the note "Test a price increase" (conversionFlag). Show the pricingSignal() message as a banner under the table.

4. 12-month trends (monthlyTrend from settings.tracking_start_month) as a grid of small charts, 3 across on desktop and 1 on mobile: Leads (bars), Conversion (line, with a shaded 20% to 40% sweet-spot band and a 30% target line), Average order value (line + target line), CAC (bars), Active clients (line), MRR (area), Churn (line, %), LTV (line), LTV:CAC (line with a 3x target line). Future months are empty, not zero.

5. Lead channels: month picker (defaults to this month) and a table from channelTable(): Channel, Leads, Meetings, Clients won, Conversion, Value won, Spend, CAC (direct), Share of leads (inline bar). Hide rows with no activity behind a "Show all channels" toggle.

6. Pipeline and speed: pending inbox count (links to Log today), leads with no response after 30 minutes (red, with minutes waiting), upcoming Calendly meetings, a pipeline funnel (new > contacted > meeting booked > meeting held > proposal > won), and median response minutes over the last 30 days.

7. Price test in thirds: priceTestResults() as three cards (current / mid / high price point from settings): quoted, won, lost, win rate, average won value.

8. Clients: active clients, MRR, average fee, and the bottom 30% by fee (bottomThirtyPercent) with each client's price_review_status. Plus clients whose last_scope_review is more than 90 days ago.

9. Meta Ads this month: spend, leads, cost per lead, booked calls (schedules), with a 30-day spend sparkline and the last sync time from integration_runs.

10. 30-day plan: checklist_items as tickable items (sets done, done_by, done_at).
```

## Prompt 5: Clients

```
Build the Clients page from the clients_with_stats view.
- Table: Client, Service line, Tier, Lead channel, Start date, Monthly fee, End date, Status (Active green / Lost grey badge), Months active, Revenue to date, Price review. Sortable by every column, default sort by monthly fee ascending. Filter Active / Lost / All, plus the global service line filter.
- Add and edit in a side sheet. End date blank means active. Show a note: "Never delete a lost client, add an end date. Churn and LTV need them." Delete is allowed only with a typed confirmation.
- Flag the bottom 30% of active clients by fee with a small "Bottom 30%" tag, and let people set price_review_status (none, planned, notice given, accepted, transitioning out).
- Last scope review date, with an amber "Review due" tag after 90 days.
- Hours tab inside the client sheet: log hours (date, person, role from list 'role', hours, note) into client_hours, and show the last 4 weeks total, hours per month, and fee per hour. If hours per month exceed the package's total hours_by_role by 5+ hours a week, show "Consistently over scope: have the conversation".
```

## Prompt 6: Leads CRM

```
Build the Leads page as a light CRM on public.leads and public.lead_activities.
- Views: Board (columns: New, Contacted, Meeting booked, Meeting held, Proposal, Won, Lost, Nurture) with drag to change status, and a Table view with search and filters (status, channel, source, owner, date range).
- Pending and rejected leads are hidden here. Pending lives in the Log today inbox. Show a "3 waiting for review" link.
- "Add lead" for phone calls and referrals: received time (defaults now), name, company, email, phone, channel, service line, message, number of agents, monthly marketing budget. Manual leads skip the inbox (status = 'new').
- Speed-to-lead timer on New cards: minutes since received_at, red after 30 minutes. A "Mark responded" button sets first_response_at = now (editable).
- Lead detail sheet: contact details, source and original message, AI summary, qualifying questions (number_of_agents, monthly_marketing_budget), Fit (unknown / fit / not fit; choosing not fit offers to move to Nurture with the free resource reply), owner (team_members), meeting time, and an activity timeline with notes.
- Proposal: choosing Proposal asks for a price band. Preselect nextPriceBand() so proposals rotate through current / mid / high (show each band's price from settings) and quoted_value.
- Won: asks for won_value (defaults to quoted_value), sets won_at = now, then offers "Create client" prefilled (name, service line, lead channel, start date today, monthly fee) and links client_id.
- Lost: asks for a lost_reason (Price, Timing, Chose another agency, No response, Not a fit, Other).
- Every status change writes a lead_activities row.
```

## Prompt 7: Settings, Capacity and Integrations

```
Settings page, tabbed:
1. Assumptions and targets: edit the single settings row (tracking start month, gross margin %, average client lifetime months, fixed monthly acquisition cost, the five targets, the three price points, not-fit resource URL, enquiry owner, planning ceiling, target labour %). Percent fields are shown as % and stored as decimals.
2. Lists: manage list_items for channel, service line, tier and role. Add, rename, reorder (drag), deactivate. Renaming should warn that past entries keep the old name.
3. Team: team_members (admins only can add, deactivate or change role).
4. Integrations: one card each for Email, Instagram DMs, Meta Ads and Calendly. Each shows the last 5 integration_runs (time, ok/failed, items, message) and a "Sync now" button that POSTs to its server route (/api/sync/email, /api/sync/instagram, /api/sync/meta-ads). The Calendly card has a "Register webhook" button that POSTs to /api/calendly/register and shows the result. Show the error message returned when a secret is missing.

Capacity page, using src/lib/capacity.ts:
- Staff table (staff): name, role, location (Australia / Philippines), with optional overrides for hours per week, leave, public holidays, sick days, training days, utilisation (blank uses location_defaults), annual cost and pay rise per year. Show calculated production hours per month and cost per production hour.
- Location defaults editor.
- Packages (packages): tier, price, planned volume (blank uses active clients on that tier), and hours per client per month for each role (hours_by_role JSON).
- Capacity by role (capacityByRole): available, plannable at ceiling, required, a utilisation bar, spare hours, extra FTE needed, and a status badge (Room to grow / Stretched / Over capacity / Nobody on the team has this role).
- Headroom (headroomByPackage): extra clients per package and the bottleneck role.
- Margin outlook (marginOutlook): now, in 12 months and in 24 months, labour % vs target.
- Note: "If a role is over capacity and conversion is above 40%, reprice or tighten scope before you hire."
```

---

## Integrations setup

Add each value in **Lovable Cloud > Secrets**, then use Settings > Integrations > **Sync now** to test. Prompt 8 sets up the scheduled runs (email and Instagram every 10 minutes, Meta Ads hourly).

| Secret | Where to get it |
|---|---|
| `IMAP_HOST`, `IMAP_PORT` (993), `IMAP_USER`, `IMAP_PASSWORD` | Your mail server's IMAP settings for the enquiries mailbox (e.g. mail.sociallab.com.au). Using an app-specific password is best |
| `IMAP_INBOX` (INBOX), `IMAP_SENT_FOLDER` (Sent, sometimes "INBOX.Sent" or "Sent Items") | Folder names on your server |
| `EMAIL_IGNORE_DOMAINS` | `sociallab.com.au` (internal mail is skipped) |
| `META_ACCESS_TOKEN` | Meta Business Settings > System users > add a system user > assign the ad account > Generate token with `ads_read` |
| `META_AD_ACCOUNT_IDS` | Ads Manager account ID(s), comma separated |
| `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` | A Meta app (developers.facebook.com) with Instagram messaging. The system user token needs `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata` and `pages_messaging`, generated for the Facebook Page linked to the Instagram account. Turn on "Allow access to messages" in the Instagram app (Settings > Messages > Connected tools) |
| `CALENDLY_TOKEN` | Calendly > Integrations > API & Webhooks > Personal access token (needs a paid Calendly plan for webhooks) |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | Any long random string, then press "Register webhook" in Settings |
| `LOVABLE_API_KEY` | Provided by Lovable Cloud when AI is enabled. Without it, enquiries are triaged by keywords instead |
| `RESEND_API_KEY` | resend.com > API keys. Free tier covers 3,000 emails a month, far more than one Monday email |
| `REPORT_FROM_EMAIL` | The from address, e.g. `Social Lab Growth Hub <hub@sociallab.com.au>`. The domain must be verified in Resend first |
| `APP_URL` | `https://social-lab-growth-hub.lovable.app`, so the email's "Open the dashboard" button works |

The scheduled runs authenticate with Lovable's own `LOVABLE_CRON_SECRET`, so there's nothing extra to set for those.

**Getting Meta booked calls into Calendly data:** add `?utm_source=facebook&utm_medium=paid` to the Calendly link in your Meta ads. The webhook reads the UTM and sets the channel to Meta Ads automatically.

**Qualifying questions:** add "How many agents or listings?" and "Monthly marketing budget?" as questions on the Calendly event and the website form. They're picked up automatically.

# Social Lab Dashboard

## Goal
Replace the dashboard placeholder with a clear, responsive operating hub covering check-ins, weekly priorities, scorecards, trends, channels, pipeline, pricing, clients, Meta Ads, and the 30-day plan.

## Build
1. **Dashboard calculation layer**
   - Extend `src/lib/metrics.ts` only where the requested dashboard needs calculations not already present, keeping all derived numbers out of components.
   - Add typed helpers for check-in streaks, target status, pipeline counts, 30-day response metrics, client summaries, overdue scope reviews, Meta Ads summaries, and future-month chart values.
   - Add focused tests for new calculations and edge cases.

2. **Dashboard data and actions**
   - Add the all-check-ins query needed for the 14-day strip.
   - Ensure checklist completion stores `done`, `done_by`, and `done_at`, using the signed-in user.
   - Reuse the existing typed hooks for settings, lists, entries, clients, leads, Meta Ads, integration runs, and checklist items.

3. **Dashboard interface**
   - Build the ten requested sections in order, with the global service-line filter applied to entries and clients before metrics are calculated.
   - Reuse the existing Log today dialog from both the check-in strip and pipeline alerts.
   - Use Recharts for every chart: one y-axis, 2px lines, rounded bars, subtle grids, tooltips, no point labels, and empty future periods.
   - Add responsive tables, small-chart grids, progress/status treatments, the channel month selector and toggle, pipeline funnel, client review lists, Meta Ads sparkline, and tickable checklist.
   - Keep AUD, percentages, and dates formatted through the existing formatting helpers.

4. **Validation**
   - Run targeted calculation tests and type checks.
   - Verify the dashboard in the live preview at desktop and mobile widths, including chart rendering, Log today opening, channel controls, checklist toggling, dark mode, and no overlapping content.

#!/usr/bin/env python3
"""Builds the one-page get-started guide: docs/Social-Lab-Growth-Hub-Get-Started.pdf

Run with any Python that has fpdf2 installed:  python3 docs/make-team-guide.py
"""
from fpdf import FPDF

APP_URL = "social-lab-growth-hub.lovable.app"

INK = (18, 18, 18)
MUTED = (105, 105, 105)
RULE = (205, 205, 205)
PANEL = (242, 242, 240)

LEFT, RIGHT = 12, 198
WIDTH = RIGHT - LEFT

pdf = FPDF(format="A4")
pdf.set_auto_page_break(auto=False)
pdf.set_margins(LEFT, 10, 12)
pdf.add_page()


def text(x, y, content, size=9, style="", color=INK, width=WIDTH, height=4.2):
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", style, size)
    pdf.set_text_color(*color)
    pdf.multi_cell(width, height, content)
    return pdf.get_y()


def rule(y):
    pdf.set_draw_color(*RULE)
    pdf.line(LEFT, y, RIGHT, y)


def person(x, y, width, name, role, steps):
    """One person's instructions, in a bordered block."""
    pdf.set_fill_color(*PANEL)
    pdf.set_draw_color(*RULE)
    inner = width - 8
    pdf.set_font("Helvetica", "", 8.4)
    lines = sum(max(1, len(pdf.multi_cell(inner - 5, 4, s, dry_run=True, output="LINES"))) for s in steps)
    height = 13 + lines * 4 + 3
    pdf.rect(x, y, width, height, style="DF")
    text(x + 4, y + 3, name, size=10.5, style="B", width=inner)
    text(x + 4, y + 8, role, size=7.6, color=MUTED, width=inner, height=3.4)
    cursor = y + 12.5
    for step in steps:
        pdf.set_xy(x + 4, cursor)
        pdf.set_font("Helvetica", "B", 8.4)
        pdf.set_text_color(*INK)
        pdf.cell(4, 4, "-")
        pdf.set_xy(x + 8, cursor)
        pdf.set_font("Helvetica", "", 8.4)
        cursor = text(x + 8, cursor, step, size=8.4, width=inner - 5, height=4)
    return y + height


# ---------------------------------------------------------------- header
y = text(LEFT, 12, "Social Lab Growth Hub", size=21, style="B")
y = text(LEFT, y + 1, "Get started: what to do, and what you are looking at", size=10.5, color=MUTED)
y = text(LEFT, y + 2.5,
         f"Open {APP_URL}  |  Log in with your Social Lab email  |  Change your password: your name, top right",
         size=8.6, color=MUTED)
rule(y + 1.5)

# ---------------------------------------------------------------- the three numbers
y = text(LEFT, y + 4, "THE THREE NUMBERS WE REVIEW EVERY MONDAY", size=8, style="B", color=MUTED)
cols = [
    ("Leads", "10 a week", "Every enquiry from anywhere. Someone put their hand up."),
    ("Speed to lead", "90% inside 30 min", "How fast we reply. The faster we are, the more we close."),
    ("Conversion", "About 30%", "Clients won divided by enquiries. Above 40% means we are too cheap."),
]
col_width = (WIDTH - 8) / 3
top = y + 1
for i, (title, target, blurb) in enumerate(cols):
    x = LEFT + i * (col_width + 4)
    pdf.set_fill_color(*PANEL)
    pdf.set_draw_color(*RULE)
    pdf.rect(x, top, col_width, 21, style="DF")
    text(x + 3, top + 2.5, title, size=10, style="B", width=col_width - 6)
    text(x + 3, top + 8, target, size=8.4, style="B", color=MUTED, width=col_width - 6, height=3.6)
    text(x + 3, top + 12, blurb, size=7.6, color=MUTED, width=col_width - 6, height=3.3)
y = top + 24

# ---------------------------------------------------------------- what each person does
y = text(LEFT, y, "WHAT YOU NEED TO DO", size=8, style="B", color=MUTED)
half = (WIDTH - 5) / 2
left_x, right_x = LEFT, LEFT + half + 5
row_top = y + 1

emily_bottom = person(left_x, row_top, half, "Emily", "Enquiries and the daily log - every enquiry passes through you", [
    "Log every enquiry the moment it lands: press + Log enquiry, or add it in the Log today box.",
    "Reply inside 30 minutes, then tick 'Replied within 30 minutes'.",
    "Screen it. Right fit? Book a strategy call with Elijah. Not a fit? Mark it and send the free resource.",
    "End of day, press Log today and finish the three steps. Takes five minutes.",
])

elijah_bottom = person(right_x, row_top, half, "Elijah", "Sales and running the program - you close what Emily books", [
    "Set up the Capacity page with Chloe this week. Nothing else can be planned until it is done.",
    "Work the Leads board: move each lead along as it progresses.",
    "On every proposal use the price the app suggests. It rotates current, mid and high so we learn what sticks.",
    "Mark won or lost honestly, with the reason. Lost reasons are how we learn.",
])

row_top = max(emily_bottom, elijah_bottom) + 4
chloe_bottom = person(left_x, row_top, half, "Chloe", "Backend and delivery - you keep delivery honest", [
    "With Elijah, fill in Capacity: the team, their annual cost, and hours per client for each tier.",
    "Log hours per client for four weeks so we learn what each tier really costs.",
    "Watch 'What each tier earns and costs'. Flag any tier running over its hours.",
    "Keep clients current: new clients, fee changes, and an end date whenever someone leaves.",
])

dan_bottom = person(right_x, row_top, half, "Dan and Blake", "Directors - here for decisions, not data entry", [
    "Read the top of the Dashboard: one verdict, four numbers. That is your week.",
    "Check 'What needs a person' and chase whatever is sitting there.",
    "The Monday email lands at 7am with the same numbers.",
    "Dan also helps Emily keep lead tracking up to date.",
])

y = max(chloe_bottom, dan_bottom) + 3
rule(y)

# ---------------------------------------------------------------- rhythm and rules
y += 3
col_width = (WIDTH - 6) / 2
left_col = text(LEFT, y, "THE RHYTHM", size=8, style="B", color=MUTED, width=col_width)
left_col = text(LEFT, left_col + 0.5,
    "Every day (Emily, 5 min): press Log today. Add the day's enquiries, confirm the numbers, note anything worth "
    "saying, save.\n\n"
    "Every Monday (everyone, 15 min): read the email, open the Dashboard together, work through what needs a person, "
    "check which price point is winning.\n\n"
    "Every month (Elijah and Chloe): update the assumptions in Settings, review the cheapest 30% of clients, and look "
    "at the margin outlook.",
    size=8.4, width=col_width, height=4)

right_col = text(LEFT + col_width + 6, y, "RULES WE AGREED", size=8, style="B", color=MUTED, width=col_width)
right_col = text(LEFT + col_width + 6, right_col + 0.5,
    "Every enquiry gets a reply within 30 minutes. No exceptions.\n\n"
    "Log every enquiry, even when we are full. The goal is enough leads to pick the best clients, not to take everyone.\n\n"
    "Never delete a client who leaves: add an end date, or churn and lifetime value go wrong.\n\n"
    "Always pick a channel and a tier, or it will not show on the dashboard.",
    size=8.4, width=col_width, height=4)

y = max(left_col, right_col) + 2
rule(y)

# ---------------------------------------------------------------- glossary
y = text(LEFT, y + 3, "THE WORDS ON THE SCREEN", size=8, style="B", color=MUTED)
terms = [
    ("Average order value", "Average monthly fee of new clients. Moving from about $3,000 toward $4,500."),
    ("CAC", "Cost to win one client: ad spend plus fixed sales costs, divided by clients won."),
    ("LTV", "Profit one client brings over their whole time with us."),
    ("LTV:CAC", "Profit per dollar spent winning a client. 3x or better is healthy."),
    ("Churn", "Share of clients who left this month. Lower is better."),
    ("MRR", "Monthly recurring revenue: every active client's fee added up."),
    ("Tier", "Which package a client is on: Ad Only, Tier 1, 2 or 3."),
    ("Price test in thirds", "A third quoted at current price, a third mid, a third high. We watch where the pushback starts."),
]
col_width = (WIDTH - 6) / 2
cursor = [y + 1, y + 1]
for i, (term, meaning) in enumerate(terms):
    col = i % 2
    x = LEFT + col * (col_width + 6)
    pdf.set_xy(x, cursor[col])
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*INK)
    pdf.cell(30, 3.8, term)
    cursor[col] = text(x + 30, cursor[col], meaning, size=8, color=MUTED, width=col_width - 30, height=3.8)

y = max(cursor) + 2
rule(y)
text(LEFT, y + 2,
     "Everyone sees the same live numbers. If something looks wrong it is usually a missed daily log or a client "
     "without an end date - the Daily Log page can be edited. Still wrong? Tell Dan.",
     size=7.8, color=MUTED, height=3.4)

bottom = pdf.get_y()
if bottom > 288:
    raise SystemExit(f"Content runs past the page: ends at {bottom:.0f}mm of 297mm. Trim something.")

pdf.output("docs/Social-Lab-Growth-Hub-Get-Started.pdf")
print(f"wrote docs/Social-Lab-Growth-Hub-Get-Started.pdf (content ends at {bottom:.0f}mm of 297mm)")

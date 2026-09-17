#!/usr/bin/env python3
"""Builds the one-page team handout: docs/Social-Lab-Growth-Hub-Start-Here.pdf

Run with any Python that has fpdf2 installed:  python3 docs/make-team-guide.py
"""
from fpdf import FPDF

APP_URL = "social-lab-growth-hub.lovable.app"

INK = (15, 15, 15)
MUTED = (110, 110, 110)
RULE = (200, 200, 200)
PANEL = (243, 243, 241)

LEFT, RIGHT = 14, 196
WIDTH = RIGHT - LEFT

pdf = FPDF(format="A4")
pdf.set_auto_page_break(auto=False)
pdf.set_margins(LEFT, 12, 14)
pdf.add_page()


def text(x, y, content, size=10, style="", color=INK, width=WIDTH, height=5):
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", style, size)
    pdf.set_text_color(*color)
    pdf.multi_cell(width, height, content)
    return pdf.get_y()


def job(x, y, width, name, lines):
    """One person, one short list of what they do."""
    pdf.set_fill_color(*PANEL)
    pdf.set_draw_color(*RULE)
    inner = width - 10
    pdf.set_font("Helvetica", "", 10)
    rows = sum(max(1, len(pdf.multi_cell(inner - 6, 5, l, dry_run=True, output="LINES"))) for l in lines)
    height = 12 + rows * 5 + 4
    pdf.rect(x, y, width, height, style="DF")
    text(x + 5, y + 3.5, name, size=12, style="B", width=inner)
    cursor = y + 11
    for line in lines:
        pdf.set_xy(x + 5, cursor)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*INK)
        pdf.cell(5, 5, "-")
        cursor = text(x + 10, cursor, line, size=10, width=inner - 6, height=5)
    return y + height


# ------------------------------------------------------------------ heading
y = text(LEFT, 16, "The Growth Hub", size=26, style="B")
y = text(LEFT, y + 1, "Everything about our Ecosystem program in one place.", size=11.5, color=MUTED)

# ------------------------------------------------------------------ how to get in
y += 3
pdf.set_fill_color(*PANEL)
pdf.set_draw_color(*RULE)
pdf.rect(LEFT, y, WIDTH, 21, style="DF")
text(LEFT + 5, y + 3.5, APP_URL, size=13, style="B", width=WIDTH - 10)
text(LEFT + 5, y + 10.5,
     "Log in with your Social Lab email and the password Dan sent you. "
     "Change it once you are in: click your name, top right.",
     size=10, color=MUTED, width=WIDTH - 10, height=4.6)
y += 26

# ------------------------------------------------------------------ what each person does
y = text(LEFT, y, "WHAT YOU DO", size=8.5, style="B", color=MUTED)
half = (WIDTH - 6) / 2
left_x, right_x = LEFT, LEFT + half + 6
top = y + 1.5

emily = job(left_x, top, half, "Emily", [
    "Log every enquiry as it comes in. Press + Log enquiry.",
    "Reply inside 30 minutes, then tick the box that says so.",
    "Good fit? Book a strategy call with Elijah.",
    "Not a fit? Mark it and send the free resource.",
    "End of day: press Log today. Five minutes.",
])

elijah = job(right_x, top, half, "Elijah", [
    "Fill in the Capacity page with Chloe this week.",
    "Move each lead along the Leads board as it progresses.",
    "Quote the price the app suggests. It rotates three prices so we learn what sticks.",
    "Mark every deal won or lost, with the reason.",
])

top = max(emily, elijah) + 5
chloe = job(left_x, top, half, "Chloe", [
    "Fill in Capacity with Elijah: the team and the hours each tier takes.",
    "Log hours per client for four weeks.",
    "Add new clients, fee changes, and an end date when someone leaves.",
])

dan = job(right_x, top, half, "Dan and Blake", [
    "Read the top of the Dashboard. That is the week.",
    "Chase whatever sits under 'What needs a person'.",
    "The summary email arrives Monday 7am.",
])

y = max(chloe, dan) + 6

# ------------------------------------------------------------------ the three numbers
y = text(LEFT, y, "THE THREE NUMBERS WE TALK ABOUT EVERY MONDAY", size=8.5, style="B", color=MUTED)
numbers = [
    ("Leads", "10 a week", "Every enquiry, from anywhere."),
    ("Speed to lead", "90%", "Replied to within 30 minutes."),
    ("Conversion", "About 30%", "Enquiries that become clients."),
]
col = (WIDTH - 10) / 3
top = y + 1.5
for i, (title, target, blurb) in enumerate(numbers):
    x = LEFT + i * (col + 5)
    pdf.set_fill_color(*PANEL)
    pdf.set_draw_color(*RULE)
    pdf.rect(x, top, col, 25, style="DF")
    text(x + 5, top + 3, title, size=11, style="B", width=col - 10)
    text(x + 5, top + 9.5, target, size=15, style="B", width=col - 10, height=6)
    text(x + 5, top + 17, blurb, size=9, color=MUTED, width=col - 10, height=4)
y = top + 30

# ------------------------------------------------------------------ two rules
pdf.set_draw_color(*RULE)
pdf.line(LEFT, y, RIGHT, y)
y = text(LEFT, y + 4, "THREE RULES", size=8.5, style="B", color=MUTED)
y = text(LEFT, y + 1,
    "1.  Every enquiry gets a reply within 30 minutes.\n"
    "2.  Log every enquiry, even when we are full.\n"
    "3.  Never delete a client who leaves. Give them an end date instead.",
    size=10.5, height=5.6)

y = text(LEFT, y + 4, "Something look wrong? Tell Dan.", size=9.5, color=MUTED)

bottom = pdf.get_y()
if bottom > 288:
    raise SystemExit(f"Content runs past the page: ends at {bottom:.0f}mm of 297mm. Trim something.")

pdf.output("docs/Social-Lab-Growth-Hub-Start-Here.pdf")
print(f"wrote docs/Social-Lab-Growth-Hub-Start-Here.pdf (content ends at {bottom:.0f}mm of 297mm)")

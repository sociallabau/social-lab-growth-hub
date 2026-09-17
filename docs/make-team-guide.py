#!/usr/bin/env python3
"""Builds the team guide PDF: docs/Social-Lab-Growth-Hub-Team-Guide.pdf

Run with any Python that has fpdf2 installed:  python3 docs/make-team-guide.py
"""
from fpdf import FPDF

APP_URL = "social-lab-growth-hub.lovable.app"

INK = (18, 18, 18)
MUTED = (110, 110, 110)
RULE = (208, 208, 208)
PANEL = (243, 243, 241)


class Guide(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.set_xy(15, 10)
        self.cell(0, 5, "Social Lab Growth Hub - team guide", align="L")
        self.set_draw_color(*RULE)
        self.line(15, 17, 195, 17)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-15)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, f"Page {self.page_no() - 1}", align="R")


pdf = Guide(format="A4")
pdf.set_auto_page_break(auto=True, margin=18)
pdf.set_margins(15, 20, 15)


def h1(text):
    pdf.set_font("Helvetica", "B", 19)
    pdf.set_text_color(*INK)
    pdf.ln(2)
    pdf.multi_cell(0, 9, text)
    pdf.ln(1)


def h2(text):
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 12.5)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, 7, text)
    pdf.ln(0.5)


def body(text, size=10):
    pdf.set_font("Helvetica", "", size)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, 5.4, text)
    pdf.ln(1)


def muted(text, size=9):
    pdf.set_font("Helvetica", "", size)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(0, 5, text)
    pdf.ln(1)


def bullets(items, numbered=False):
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*INK)
    for i, item in enumerate(items, 1):
        marker = f"{i}." if numbered else "-"
        pdf.set_x(15)
        pdf.cell(7, 5.4, marker)
        pdf.set_x(22)
        pdf.multi_cell(173, 5.4, item)
    pdf.ln(1)


def panel(title, lines):
    """A bordered block for a person's responsibilities."""
    pdf.ln(2)
    top = pdf.get_y()
    pdf.set_fill_color(*PANEL)
    pdf.set_draw_color(*RULE)
    height = 9 + 5.4 * sum(max(1, len(pdf.multi_cell(172, 5.4, line, dry_run=True, output="LINES"))) for line in lines) + 4
    pdf.rect(15, top, 180, height, style="DF")
    pdf.set_xy(19, top + 3)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*INK)
    pdf.cell(0, 6, title)
    pdf.set_xy(19, top + 10)
    pdf.set_font("Helvetica", "", 10)
    for line in lines:
        pdf.set_x(19)
        pdf.multi_cell(172, 5.4, line)
    pdf.set_y(top + height + 3)


def table(headers, rows, widths):
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*MUTED)
    pdf.set_draw_color(*RULE)
    for header, width in zip(headers, widths):
        pdf.cell(width, 7, header, border="B")
    pdf.ln(7)
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(*INK)
    for row in rows:
        height = max(
            len(pdf.multi_cell(width, 5, cell, dry_run=True, output="LINES"))
            for cell, width in zip(row, widths)
        ) * 5
        x, y = pdf.get_x(), pdf.get_y()
        if y + height > pdf.h - 20:
            pdf.add_page()
            x, y = pdf.get_x(), pdf.get_y()
        for cell, width in zip(row, widths):
            pdf.set_xy(x, y)
            pdf.multi_cell(width, 5, cell, border="B")
            x += width
        pdf.set_xy(15, y + height)
    pdf.ln(2)


# ---------------------------------------------------------------- cover
pdf.add_page()
pdf.ln(48)
pdf.set_font("Helvetica", "B", 30)
pdf.set_text_color(*INK)
pdf.multi_cell(0, 13, "Social Lab\nGrowth Hub")
pdf.ln(3)
pdf.set_font("Helvetica", "", 13)
pdf.set_text_color(*MUTED)
pdf.multi_cell(0, 7, "How to use it, and what you are looking at")
pdf.ln(28)
pdf.set_draw_color(*RULE)
pdf.line(15, pdf.get_y(), 195, pdf.get_y())
pdf.ln(6)
pdf.set_font("Helvetica", "", 10.5)
pdf.set_text_color(*INK)
pdf.multi_cell(0, 6,
    f"Open it at  {APP_URL}\n"
    "Log in with your Social Lab email and the password you were given.\n"
    "Change your password once you are in: your name, top right.")
pdf.ln(4)
muted("Everyone sees the same live numbers. Nothing is stored on anyone's computer.")

# ---------------------------------------------------------------- what it is
pdf.add_page()
h1("What this is")
body(
    "One place for the Ecosystem retainer program: every enquiry, every client, and the numbers that tell us "
    "whether we are growing. It replaces the spreadsheet our mentor gave us, and it does the maths for us.")
body(
    "It answers one question: are we getting enough enquiries, answering them fast enough, and turning enough of "
    "them into clients at the right price?")

h2("The three numbers we review every Monday")
table(
    ["Number", "What it means", "Target"],
    [
        ["Leads", "Enquiries from anywhere: calls, DMs, emails, referrals. Someone put their hand up.", "10 a week"],
        ["Speed to lead", "Share of enquiries we replied to within 30 minutes. The faster we reply, the more we close.", "90%"],
        ["Conversion", "Clients won divided by enquiries. Too high means we are too cheap.", "About 30%"],
    ],
    [30, 110, 40],
)
muted("Above 40% conversion is not a win. It means our prices are too low and we should test raising them.")

h2("What you see when you open it")
bullets([
    "A one-line verdict on the week, in plain English.",
    "Four numbers: leads, speed to lead, conversion, and revenue against target.",
    "What needs a person: enquiries not yet replied to, days missed, clients due a review.",
    "Everything else sits below, and can be collapsed with the 'Show the full detail' switch.",
])
body("If you only have five minutes, read the top of the Dashboard and stop there.")

# ---------------------------------------------------------------- who does what
pdf.add_page()
h1("Who does what")

panel("Emily - enquiries and the daily log", [
    "The engine room. Every enquiry passes through you.",
    "1. Log every enquiry as it comes in, using '+ Log enquiry' or the Log today box.",
    "2. Reply within 30 minutes. Tick 'Replied within 30 minutes' when you do.",
    "3. Screen it: right fit? Book a strategy call with Elijah. Not a fit? Mark it and send the free resource.",
    "4. End of day: press 'Log today' and complete the three steps. Five minutes.",
])

panel("Elijah - sales and running the program", [
    "You close the deals Emily books, and you own the price test.",
    "1. Work the Leads board: move each lead along as it progresses.",
    "2. On proposals, use the price the app suggests. It rotates current, mid and high so we learn what sticks.",
    "3. Mark won or lost honestly, including the reason. Lost reasons are how we learn.",
    "4. With Chloe, fill in the Capacity page (see the next page).",
])

panel("Chloe - backend and delivery", [
    "You keep the delivery side honest.",
    "1. With Elijah, set up Capacity: the team, their hours, and hours per tier.",
    "2. Log hours per client for four weeks so we learn what each tier really costs.",
    "3. Watch 'What each tier earns and costs'. If a tier is over its hours, flag it.",
    "4. Keep client records current: new clients, fee changes, and end dates when someone leaves.",
])

panel("Dan and Blake - directors", [
    "You are here for decisions, not data entry.",
    "1. Read the top of the Dashboard. The verdict and four numbers tell you the week.",
    "2. Check 'What needs a person' and chase whatever is sitting there.",
    "3. Monday: the summary email lands at 7am with the same numbers.",
    "4. Dan also helps Emily keep lead tracking up to date.",
])

# ---------------------------------------------------------------- capacity setup
pdf.add_page()
h1("First job: Elijah and Chloe, set up Capacity")
body(
    "Until this is filled in, the app cannot tell us how many more clients we can take, or which tier is quietly "
    "eating our margin. It takes about 30 minutes together, once.")
bullets([
    "Open Capacity, then Team. Add everyone who delivers client work: name, role, and where they are based.",
    "Add each person's annual cost. Leave hours, leave and utilisation blank unless someone is different from the default.",
    "Add any pay rise you already know is coming, so it does not surprise us in the margin outlook.",
    "In Packages, put the monthly price for each tier, and the revenue goal for that tier.",
    "In the same row, put your best guess at hours per client per month for each role. Guesses are fine to start.",
    "Read 'Capacity by role'. Red means over capacity. Amber means we are above our planning ceiling.",
    "From then on, log hours per client on the Clients page for four weeks. After that the real numbers replace the guesses.",
], numbered=True)
muted("Rule from our mentor: if a role is over capacity and conversion is above 40%, reprice or tighten scope before hiring.")

h2("Then, every three months")
bullets([
    "Review each client's scope. The app flags anyone not reviewed in 90 days.",
    "If a client is consistently costing an extra five hours a week, have the conversation and adjust the package.",
])

# ---------------------------------------------------------------- daily rhythm
pdf.add_page()
h1("The daily and weekly rhythm")

h2("Every day - Emily, five minutes")
bullets([
    "Press 'Log today'. It also opens by itself when you open the Daily Log page.",
    "Step 1: add today's enquiries, one row each. Name, where it came from, tier, the time it arrived, and whether we replied inside 30 minutes.",
    "Step 1 also lists anything captured automatically, waiting for your yes or no.",
    "Step 2: check today's numbers, which are already filled in. Record anyone who signed.",
    "Step 3: add a highlight or a blocker, then save.",
], numbered=True)
muted("Log an enquiry even when we are full. The goal is enough leads to pick the best clients, not to take everyone.")

h2("Every Monday - everyone, fifteen minutes")
bullets([
    "Read the Monday email, which arrives at 7am.",
    "Open the Dashboard together and look at the three numbers against target.",
    "Work through 'What needs a person' and agree who is doing what.",
    "Check the price test: which of the three price points is winning.",
], numbered=True)

h2("Once a month - Elijah and Chloe")
bullets([
    "Update Settings: gross margin, average client lifetime, fixed acquisition costs.",
    "Review the bottom 30% of clients by fee and plan the price conversation.",
    "Check the margin outlook: now, in 12 months, and in 24 months.",
])

# ---------------------------------------------------------------- the words
pdf.add_page()
h1("What the words mean")
table(
    ["Term", "Plain English"],
    [
        ["Lead", "An enquiry from anyone who might buy. Phone, DM, email, referral, form."],
        ["Speed to lead", "How quickly we replied. Measured against 30 minutes. We aim for 10."],
        ["Conversion", "Clients won divided by enquiries. Around 30% is right. Above 40% means we are too cheap."],
        ["Average order value", "Average monthly fee of new clients we win. We are moving from about $3,000 toward $4,500."],
        ["CAC", "What it costs to win one client: ad spend plus fixed sales costs, divided by clients won."],
        ["LTV", "Gross profit one client brings over their whole time with us."],
        ["LTV:CAC", "Dollars of profit for every dollar spent winning a client. 3x or better is healthy."],
        ["Churn", "Share of clients who left in the month. Lower is better."],
        ["MRR", "Monthly recurring revenue: the total of every active client's monthly fee."],
        ["Tier", "Which package a client is on: Ad Only, Tier 1, Tier 2 or Tier 3."],
        ["Price test in thirds", "We quote a third at current price, a third mid, a third high, and watch where the pushback starts."],
        ["Bottom 30%", "Our cheapest clients. Move them to new pricing with notice, or help them move on."],
    ],
    [42, 138],
)

pdf.add_page()
h1("Rules we agreed")
bullets([
    "Every enquiry gets a reply within 30 minutes. No exceptions.",
    "Log every enquiry, even when we are at capacity.",
    "Never delete a client who leaves. Add an end date instead, or churn and LTV go wrong.",
    "Always choose a channel and a tier, or the numbers will not show on the dashboard.",
    "Lead generation for Social Lab stays switched on, even when we are full.",
])

h2("If something looks wrong")
bullets([
    "A number that looks off is usually a missing daily log or a client without an end date.",
    "The Daily Log page shows every row we have entered, and any of it can be edited.",
    "Still wrong? Tell Dan.",
])

pdf.ln(6)
muted("Built from the game plan our mentor set out: leads first, then pricing and client selection, then capacity, "
      "then delivery efficiency.")

pdf.output("docs/Social-Lab-Growth-Hub-Team-Guide.pdf")
print("wrote docs/Social-Lab-Growth-Hub-Team-Guide.pdf")

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.graphics.shapes import Circle, Drawing, Line, Rect, String


ROOT = Path(r"C:\dev\FlockTrax")
OUTPUT_MD = ROOT / "output" / "FlockTrax_Admin_Mobile_Platform_Summary_2026-04-04.md"
OUTPUT_PDF = ROOT / "output" / "pdf" / "FlockTrax_Admin_Mobile_Platform_Summary_2026-04-04.pdf"


TITLE = "FlockTrax-Admin & FlockTrax-Mobile Platform Summary"
SUBTITLE = "Interconnectivity, architecture, and operating flow"

BRAND_BLUE = "#3f6286"
BRAND_RUST = "#8b3f25"
BRAND_RUST_SOFT = "#efe1d2"
BRAND_GREEN = "#223224"
BRAND_MOSS = "#5d695e"
PAPER = "#f7f1e7"
PAPER_SOFT = "#fbf7f0"
LINE = "#dccfbe"


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="DocTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            alignment=TA_LEFT,
            textColor=colors.HexColor(BRAND_GREEN),
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="DocSubtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=14,
            alignment=TA_LEFT,
            textColor=colors.HexColor(BRAND_MOSS),
            spaceAfter=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor(BRAND_GREEN),
            spaceBefore=6,
            spaceAfter=8,
            borderPadding=0,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#2b2f2b"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#666666"),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Lead",
            parent=styles["Body"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            textColor=colors.HexColor("#364137"),
            spaceAfter=12,
        )
    )
    return styles


def draw_box(drawing, x, y, w, h, title, subtitle="", fill="#f6efe4", stroke="#d4c3ac", title_color="#2b3729"):
    drawing.add(
        Rect(
            x,
            y,
            w,
            h,
            rx=12,
            ry=12,
            fillColor=colors.HexColor(fill),
            strokeColor=colors.HexColor(stroke),
            strokeWidth=1,
        )
    )
    drawing.add(
        String(
            x + 12,
            y + h - 20,
            title,
            fontName="Helvetica-Bold",
            fontSize=11,
            fillColor=colors.HexColor(title_color),
        )
    )
    if subtitle:
        drawing.add(
            String(
                x + 12,
                y + h - 36,
                subtitle,
                fontName="Helvetica",
                fontSize=8.5,
                fillColor=colors.HexColor("#5c625b"),
            )
        )


def draw_wordmark(drawing, x, y, product, descriptor=None, scale=1.0, centered=False):
    brand_size = 16 * scale
    product_size = 14 * scale
    tm_size = 6 * scale
    descriptor_size = 8 * scale
    divider_gap = 2 * scale
    char_w = 0.58

    brand = "FlockTrax"
    divider = "-"
    product_text = product
    brand_width = len(brand) * brand_size * char_w
    divider_width = len(divider) * product_size * char_w
    product_width = len(product_text) * product_size * char_w
    tm_width = 4 * scale
    total_width = brand_width + divider_gap + divider_width + divider_gap + product_width + tm_width

    start_x = x - total_width / 2 if centered else x
    baseline_y = y

    drawing.add(
        String(
            start_x,
            baseline_y,
            brand,
            fontName="Helvetica-Bold",
            fontSize=brand_size,
            fillColor=colors.HexColor(BRAND_BLUE),
        )
    )
    cursor = start_x + brand_width + divider_gap
    drawing.add(
        String(
            cursor,
            baseline_y,
            divider,
            fontName="Helvetica-Bold",
            fontSize=product_size,
            fillColor=colors.HexColor(BRAND_RUST),
        )
    )
    cursor += divider_width + divider_gap
    drawing.add(
        String(
            cursor,
            baseline_y,
            product_text,
            fontName="Helvetica-Bold",
            fontSize=product_size,
            fillColor=colors.HexColor(BRAND_RUST),
        )
    )
    drawing.add(
        String(
            cursor + product_width + 1,
            baseline_y + 6 * scale,
            "TM",
            fontName="Helvetica-Bold",
            fontSize=tm_size,
            fillColor=colors.HexColor(BRAND_RUST),
        )
    )

    if descriptor:
        drawing.add(
            String(
                x if centered else start_x,
                baseline_y - 13 * scale,
                descriptor,
                fontName="Helvetica",
                fontSize=descriptor_size,
                fillColor=colors.HexColor("#4a423a"),
                textAnchor="middle" if centered else "start",
            )
        )


def arrow(drawing, x1, y1, x2, y2, color="#ab6d42"):
    drawing.add(
        Line(x1, y1, x2, y2, strokeColor=colors.HexColor(color), strokeWidth=1.6)
    )
    if x2 >= x1:
        drawing.add(Line(x2, y2, x2 - 6, y2 + 3, strokeColor=colors.HexColor(color), strokeWidth=1.6))
        drawing.add(Line(x2, y2, x2 - 6, y2 - 3, strokeColor=colors.HexColor(color), strokeWidth=1.6))
    else:
        drawing.add(Line(x2, y2, x2 + 6, y2 + 3, strokeColor=colors.HexColor(color), strokeWidth=1.6))
        drawing.add(Line(x2, y2, x2 + 6, y2 - 3, strokeColor=colors.HexColor(color), strokeWidth=1.6))


def platform_layers_diagram():
    d = Drawing(470, 180)
    d.add(
        Rect(
            8, 8, 454, 164, rx=16, ry=16,
            fillColor=colors.HexColor(PAPER_SOFT),
            strokeColor=colors.HexColor("#e4d7c4"),
            strokeWidth=1
        )
    )
    d.add(String(26, 155, "Shared platform layers", fontName="Helvetica-Bold", fontSize=10, fillColor=colors.HexColor(BRAND_RUST)))
    draw_box(d, 30, 112, 180, 36, "Application Surface", "FlockTrax-Admin and FlockTrax-Mobile client surfaces")
    draw_box(d, 30, 66, 180, 36, "Service Layer", "Supabase Edge Functions, auth, submit, dashboard reads")
    draw_box(d, 30, 20, 180, 36, "Data Layer", "Shared hosted Supabase tables and views")

    draw_box(d, 245, 110, 190, 44, "Admin Role", "Oversight, setup, reporting, settings", fill="#eef3ea", stroke="#cad8c6")
    draw_box(d, 245, 58, 190, 44, "Mobile Role", "Fast daily entry and placement-day submission", fill="#eef3ea", stroke="#cad8c6")
    draw_box(d, 245, 12, 190, 36, "Shared Governance", "Roles, settings, and platform identity", fill="#eef3ea", stroke="#cad8c6")
    return d


def flow_diagram():
    d = Drawing(470, 220)
    d.add(
        Rect(
            8, 8, 454, 204, rx=16, ry=16,
            fillColor=colors.HexColor(PAPER_SOFT),
            strokeColor=colors.HexColor("#e4d7c4"),
            strokeWidth=1
        )
    )
    d.add(String(26, 195, "Runtime flow and shared truth", fontName="Helvetica-Bold", fontSize=10, fillColor=colors.HexColor(BRAND_RUST)))
    draw_box(d, 24, 134, 120, 54, "FlockTrax-Mobile", "Login, active placements, log submission", fill="#edf3ec", stroke="#c8d6c6")
    draw_box(d, 24, 46, 120, 54, "FlockTrax-Admin", "Dashboard, oversight, reporting, settings", fill="#edf3ec", stroke="#c8d6c6")
    draw_box(d, 175, 90, 120, 54, "Supabase Functions", "session-create, placement-day-submit, read APIs")
    draw_box(d, 326, 134, 118, 54, "Hosted Database", "placements, flocks, logs, rollups", fill="#f7efe8", stroke="#dcc4af")
    draw_box(d, 326, 46, 118, 54, "Platform Roles", "Admin, app-owner, future role tiers", fill="#f7efe8", stroke="#dcc4af")

    arrow(d, 144, 161, 175, 161)
    arrow(d, 144, 73, 175, 117)
    arrow(d, 295, 151, 326, 161)
    arrow(d, 326, 151, 295, 151)
    arrow(d, 295, 83, 326, 73)
    arrow(d, 326, 73, 295, 83)

    d.add(String(186, 176, "Auth + submit", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#5d5d5d")))
    d.add(String(183, 132, "Dashboard reads", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#5d5d5d")))
    d.add(String(332, 176, "Shared source of truth", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#5d5d5d")))
    d.add(String(334, 88, "Role-aware access", fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#5d5d5d")))
    return d


def cover_panel():
    d = Drawing(470, 210)
    d.add(
        Rect(
            0, 0, 470, 210, rx=26, ry=26,
            fillColor=colors.HexColor("#f8f2e8"),
            strokeColor=colors.HexColor("#e6d9c7"),
            strokeWidth=1.2,
        )
    )
    d.add(
        Rect(
            0, 0, 470, 210, rx=26, ry=26,
            fillColor=None,
            strokeColor=colors.HexColor("#f3eadf"),
            strokeWidth=10,
        )
    )
    d.add(Circle(430, 184, 12, fillColor=colors.HexColor(BRAND_RUST_SOFT), strokeColor=None))
    d.add(Circle(402, 26, 18, fillColor=colors.HexColor("#e4ecd8"), strokeColor=None))
    d.add(Circle(40, 174, 18, fillColor=colors.HexColor("#efe5d5"), strokeColor=None))
    draw_wordmark(d, 32, 166, "Admin", "Operational command surface", scale=1.0, centered=False)
    d.add(
        String(
            32,
            132,
            "Build the operation around one shared",
            fontName="Helvetica-Bold",
            fontSize=22,
            fillColor=colors.HexColor(BRAND_GREEN),
        )
    )
    d.add(
        String(
            32,
            106,
            "platform truth across farms, barns, flocks,",
            fontName="Helvetica-Bold",
            fontSize=22,
            fillColor=colors.HexColor(BRAND_GREEN),
        )
    )
    d.add(
        String(
            32,
            80,
            "placements, and daily logs.",
            fontName="Helvetica-Bold",
            fontSize=22,
            fillColor=colors.HexColor(BRAND_GREEN),
        )
    )
    d.add(
        String(
            32,
            50,
            "This summary explains how FlockTrax-Admin and FlockTrax-Mobile",
            fontName="Helvetica",
            fontSize=10,
            fillColor=colors.HexColor(BRAND_MOSS),
        )
    )
    d.add(
        String(
            32,
            36,
            "connect through Supabase, shared placement identity, and role-aware services.",
            fontName="Helvetica",
            fontSize=10,
            fillColor=colors.HexColor(BRAND_MOSS),
        )
    )
    return d


def signature_block():
    d = Drawing(470, 70)
    draw_wordmark(d, 185, 48, "Admin", centered=True, scale=0.82)
    d.add(String(236, 48, "&", fontName="Helvetica-Bold", fontSize=10, fillColor=colors.HexColor("#6c675f")))
    draw_wordmark(d, 319, 48, "Mobile", centered=True, scale=0.82)
    d.add(
        String(
            235,
            25,
            "Integrated flock management platform",
            fontName="Helvetica-Bold",
            fontSize=9,
            fillColor=colors.HexColor(BRAND_RUST),
            textAnchor="middle",
        )
    )
    d.add(
        String(
            235,
            11,
            "In-barn data collection, enterprise reporting, and shared hosted operations truth",
            fontName="Helvetica",
            fontSize=7.8,
            fillColor=colors.HexColor("#4a423a"),
            textAnchor="middle",
        )
    )
    return d


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setStrokeColor(colors.HexColor(LINE))
    canvas.line(doc.leftMargin, 0.64 * inch, letter[0] - doc.rightMargin, 0.64 * inch)
    canvas.setFillColor(colors.HexColor("#7a756c"))
    footer_text = f"{TITLE}  |  Page {doc.page}"
    canvas.drawCentredString(letter[0] / 2, 0.45 * inch, footer_text)
    canvas.restoreState()


def markdown_text():
    return """# FlockTrax-Admin & FlockTrax-Mobile Platform Summary

## Purpose

FlockTrax is being shaped as a two-surface poultry operations platform built around one shared hosted data model. `FlockTrax-Admin` is the management, reporting, and platform-governance side. `FlockTrax-Mobile` is the fast-entry operational side used closer to the barn floor. Both surfaces are intended to work against the same hosted Supabase backend so that the business operates from one shared source of truth instead of fragmented app-specific data.

## Shared operating model

The key operating unit across the platform is the placement. A placement ties farm, barn, flock, and active production timing together into the shared key `placement_id`. Once a placement exists, both the admin and mobile surfaces can work against the same production context. That means mobile can submit daily and mortality activity while admin can summarize, monitor, and report against the exact same placement history.

Master entities such as farms, barns, and flocks define structure. Placements define the live flock-in-barn operating context. Daily logs and mortality logs define the changing production state. The result is a platform where setup, transaction flow, and reporting can all stay connected.

## Surface responsibilities

### FlockTrax-Mobile

`FlockTrax-Mobile` is designed for fast execution. Its role is to:

- authenticate the user
- show active placements
- support placement-day submission
- capture daily production activity and mortality with low friction

Mobile should stay narrow, fast, and reliable so barn-floor users can enter data quickly without carrying the weight of broader admin workflows.

### FlockTrax-Admin

`FlockTrax-Admin` is designed for visibility and control. Its role is to:

- present active placements by barn
- summarize current placement state
- support management oversight and reporting
- manage settings, preferences, feature flags, and platform identity over time

The admin side is where the business should be able to understand operations across farms and barns rather than just enter one day of records.

## Platform structure

The current platform is settling into three layers:

1. Data layer: hosted Supabase tables and views for farms, barns, flocks, placements, daily logs, mortality logs, weights, and derived dashboard rollups.
2. Service layer: Supabase Edge Functions for authentication, submission, and read-oriented APIs.
3. Application layer: `FlockTrax-Admin` and `FlockTrax-Mobile`.

This separation is healthy because each layer has a distinct job. The database stores truth. The function layer enforces business logic and request handling. The client surfaces stay focused on user workflow.

## Interconnectivity

The two surfaces do not need to communicate directly with each other. Their interconnectivity comes from shared services:

- Supabase provides the shared hosted database.
- Edge Functions provide controlled entry points such as `session-create` and `placement-day-submit`.
This means the platform is connected by common APIs, shared identifiers, and common data structures rather than by fragile custom app-to-app wiring.

## Authentication and runtime flow

The hosted `session-create` function issues the session token used by downstream requests. That token allows the platform to move toward a role-aware operating model. Over time, this will support differentiated access such as admin, higher-trust settings access, and app-owner controls across the whole platform.

The current runtime direction is straightforward:

- Supabase Edge Functions handle authentication, submit flows, and read-oriented APIs.
- Both client surfaces should operate against the same hosted project and shared identifiers.
- Legacy leftovers that do not serve the hosted Admin and Mobile platform should be treated as cleanup work, not architecture.

## Dashboard strategy

For the admin dashboard, the stronger design is live rollups from source-of-truth records rather than mutable counters hand-maintained on placements. In practical terms:

- starting counts come from flock placement data
- mortality comes from the mortality logs
- current in-house count is calculated as starting count minus net mortality

This reduces drift when historical records are corrected. The admin dashboard then becomes a trustworthy summary surface over the same underlying data mobile writes.

## Conclusion

FlockTrax is becoming a unified operations platform with two primary working surfaces under one backend model. `FlockTrax-Mobile` captures fast operational truth. `FlockTrax-Admin` organizes, summarizes, and governs that truth. Supabase is the bridge that keeps the system coherent, and the platform direction is clearly toward a shared hosted backend, role-aware access, and durable application structure.
"""


def build_story(styles):
    story = []
    story.append(Spacer(1, 0.08 * inch))
    story.append(cover_panel())
    story.append(Spacer(1, 0.18 * inch))
    story.append(signature_block())
    story.append(Spacer(1, 0.18 * inch))
    story.append(Paragraph(TITLE, styles["DocTitle"]))
    story.append(Paragraph(SUBTITLE, styles["DocSubtitle"]))

    intro = (
        "FlockTrax is being shaped as a two-surface poultry operations platform built around one shared hosted "
        "data model. <b>FlockTrax-Admin</b> is the management, reporting, and governance surface. "
        "<b>FlockTrax-Mobile</b> is the fast-entry operational surface used closer to the barn floor. "
        "Both are intended to operate from the same hosted Supabase backend so setup, submission, and oversight "
        "can all stay tied to one shared source of truth."
    )
    story.append(Paragraph(intro, styles["Lead"]))
    story.append(Paragraph("Platform layers", styles["Section"]))
    story.append(platform_layers_diagram())
    story.append(Spacer(1, 0.18 * inch))
    story.append(
        Paragraph(
            "The platform is settling into three layers. The data layer stores farms, barns, flocks, placements, "
            "logs, and rollups. The service layer exposes auth, submit, and read-oriented functions. "
            "The application layer presents specialized workflows across Admin and Mobile.",
            styles["Body"],
        )
    )
    story.append(
        Table(
            [
                ["Surface", "Primary job", "Key examples"],
                ["FlockTrax-Admin", "Oversight, reporting, settings, feature governance", "Dashboard tiles, master data, future settings"],
                ["FlockTrax-Mobile", "Fast operational entry", "Active placements, daily submission, mortality entry"],
                ["Supabase service layer", "Shared auth, submit, and read APIs", "session-create, placement-day-submit, dashboard reads"],
            ],
            colWidths=[1.5 * inch, 2.2 * inch, 2.65 * inch],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(BRAND_RUST_SOFT)),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor(BRAND_GREEN)),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("LEADING", (0, 0), (-1, -1), 12),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor(PAPER_SOFT)),
                    ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#dac9b3")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            ),
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("Interconnectivity and shared runtime flow", styles["Section"]))
    story.append(
        Paragraph(
            "The two surfaces do not need to communicate directly with each other. Their interconnectivity comes "
            "from shared services, shared identifiers, and common backend rules. The key operating spine is the "
            "<b>placement_id</b>, which ties farm, barn, flock, and active production timing together. Once that key exists, "
            "both Admin and Mobile can work against the same live production context.",
            styles["Body"],
        )
    )
    story.append(flow_diagram())
    story.append(Spacer(1, 0.15 * inch))
    story.append(
        Paragraph(
            "At runtime, the hosted <b>session-create</b> function establishes the session token used in downstream requests. "
            "Submit-oriented flows such as placement-day entry use purpose-built Edge Functions. Read-oriented flows should also "
            "be served from the same hosted service layer so both client surfaces stay aligned to one source of truth.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Shared data model", styles["Section"]))
    story.append(
        Paragraph(
            "Master entities such as farms, barns, and flocks define operational structure. Placements define the active "
            "flock-in-barn context. Daily logs, mortality logs, and weight logs define the changing operating state over time. "
            "Because both surfaces are intended to read and write against the same hosted project, corrections and new submissions "
            "flow back into one common history instead of drifting apart across tools.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "This is especially important for dashboard reporting. The safer design is live rollups from source-of-truth data: "
            "starting counts come from flock placement data, mortality comes from log records, and current in-house counts are "
            "derived from those values. That makes the admin dashboard a trustworthy summary of the same operational truth the "
            "mobile surface writes.",
            styles["Body"],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("Operating direction and governance", styles["Section"]))
    story.append(
        Paragraph(
            "The platform direction is becoming clearer. <b>FlockTrax-Mobile</b> should stay narrow, fast, and field-friendly. "
            "<b>FlockTrax-Admin</b> should stay structured, role-aware, and suitable for oversight, settings, and reporting. "
            "Supabase remains the backend bridge between both surfaces, and any leftover legacy tool assumptions should be "
            "treated as cleanup rather than part of the intended architecture.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Branding is also becoming part of platform structure. Treating <b>FlockTrax-Admin TM</b> and <b>FlockTrax-Mobile TM</b> "
            "as subsystem wordmarks under one managed platform helps communicate that these are coordinated operating surfaces rather "
            "than disconnected apps. The same principle applies to future settings and preferences: they belong in a governed "
            "administrative layer, eventually protected by role-aware access such as admin and app-owner security levels.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Recommended next steps", styles["Section"]))
    next_steps = [
        "Keep both Admin and Mobile pointed at the same hosted Supabase project in all normal test flows.",
        "Continue replacing silent fallbacks with visible runtime errors so data-source issues are obvious.",
        "Use live dashboard rollups for placement summary tiles rather than hand-maintained counters on placements.",
        "Add a Settings and Preferences area in Admin, gated by admin or higher roles, with a future app-owner tier for platform governance.",
        "Keep session, submit, and dashboard APIs centralized in Supabase Edge Functions so business rules stay consistent across all surfaces.",
    ]
    for item in next_steps:
        story.append(Paragraph(f"- {item}", styles["Body"]))

    story.append(Spacer(1, 0.14 * inch))
    story.append(
        Paragraph(
            "In short, FlockTrax is maturing into one shared operations platform with two purposeful surfaces: "
            "Mobile for fast capture of operational truth, and Admin for organizing, summarizing, and governing that truth. "
            "That architecture is strong enough to support continued growth without losing clarity.",
            styles["Body"],
        )
    )
    return story


def write_markdown():
    OUTPUT_MD.write_text(markdown_text(), encoding="utf-8")


def write_pdf():
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=letter,
        leftMargin=0.72 * inch,
        rightMargin=0.72 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.72 * inch,
        title=TITLE,
        author="OpenAI Codex",
    )
    story = build_story(styles)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_MD.parent.mkdir(parents=True, exist_ok=True)
    write_markdown()
    write_pdf()
    print(OUTPUT_MD)
    print(OUTPUT_PDF)


if __name__ == "__main__":
    main()

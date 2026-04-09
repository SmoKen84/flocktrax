from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from pypdf import PdfReader


ROOT = Path(r"C:\dev\FlockTrax")
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PATH = OUTPUT_DIR / "flocktrax_app_summary.pdf"


def build_pdf(path: Path) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=0.55 * inch,
        rightMargin=0.55 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.45 * inch,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TitleTight",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=20,
            textColor=colors.HexColor("#123B2F"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=12,
            textColor=colors.HexColor("#123B2F"),
            spaceBefore=5,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyCompact",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.8,
            leading=10.4,
            textColor=colors.HexColor("#1E2933"),
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletCompact",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.6,
            leading=10,
            leftIndent=12,
            firstLineIndent=-7,
            bulletIndent=0,
            textColor=colors.HexColor("#1E2933"),
            spaceAfter=1,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SmallNote",
            parent=styles["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=7.7,
            leading=9,
            textColor=colors.HexColor("#4B5563"),
            spaceBefore=4,
        )
    )

    story = [
        Paragraph("FlockTrax App Summary", styles["TitleTight"]),
        Paragraph("Repo summarized: <b>C:\\dev\\FlockTrax</b>", styles["BodyCompact"]),
        Paragraph("What It Is", styles["Section"]),
        Paragraph(
            "FlockTrax appears to be a Supabase-backed poultry operations app for managing farms, barns, flock placements, "
            "and daily flock records. This repo primarily contains the backend service layer, database schema, and Windows "
            "development toolkit; a bundled frontend UI was <b>Not found in repo</b>.",
            styles["BodyCompact"],
        ),
        Paragraph("Who It's For", styles["Section"]),
        Paragraph(
            "Primary persona: farm managers, barn operators, or ag-tech admins who need to track flock placement, daily conditions, "
            "mortality, and user access across farm locations.",
            styles["BodyCompact"],
        ),
        Paragraph("What It Does", styles["Section"]),
    ]

    feature_bullets = [
        "Supports auth flows with Edge Functions for login, signup, logout, session checks, and refresh verification.",
        "Stores farm, barn, flock, placement, profile, role, and membership data in Supabase Postgres.",
        "Captures daily flock metrics such as temperatures, ventilation, comments, and operational notes.",
        "Captures mortality and cull data, including counts, reasons, and quality grades.",
        "Applies row-level security and role checks for farm access and write permissions.",
        "Exports data to an Adalo-friendly ZIP of CSV files plus import guidance.",
        "Provides Windows toolkit scripts to start, test, deploy, reset, and inspect the local Supabase stack.",
    ]
    for bullet in feature_bullets:
        story.append(Paragraph(bullet, styles["BulletCompact"], bulletText="-"))

    story.extend(
        [
            Paragraph("How It Works", styles["Section"]),
            Paragraph(
                "<b>Client layer:</b> External app/client <b>Not found in repo</b>; function names and `export-adalo` suggest outside consumers, including Adalo-related workflows.",
                styles["BodyCompact"],
            ),
            Paragraph(
                "<b>Service layer:</b> Supabase Edge Functions written for the Deno runtime handle auth, sessions, signup-code redemption, daily log reads, daily/mortality upserts, and CSV export.",
                styles["BodyCompact"],
            ),
            Paragraph(
                "<b>Data layer:</b> Supabase Postgres stores farms, barns, flocks, placements, daily logs, mortality logs, profiles, roles, and memberships; SQL functions, triggers, and views enforce defaults, sync barn state, and support writes.",
                styles["BodyCompact"],
            ),
            Paragraph(
                "<b>Data flow:</b> Client sends HTTP requests to Edge Functions or Supabase endpoints, functions use Supabase Auth and database APIs, Postgres applies RLS/business rules, and responses return JSON or ZIP downloads.",
                styles["BodyCompact"],
            ),
            Paragraph("How To Run", styles["Section"]),
        ]
    )

    run_bullets = [
        "Install Docker Desktop and the Supabase CLI. Both are required by `toolkit\\START_FLOCKTRAX_DEV.bat`.",
        "Open the repo at `C:\\dev\\FlockTrax`.",
        "Run `toolkit\\START_FLOCKTRAX_DEV.bat` for the fastest local startup, or `toolkit\\TOOLKIT_MENU.bat` for the full toolkit menu.",
        "Wait for `supabase start` to finish, then use Supabase Studio at `http://127.0.0.1:54323`.",
    ]
    for bullet in run_bullets:
        story.append(Paragraph(bullet, styles["BulletCompact"], bulletText="-"))

    story.extend(
        [
            Spacer(1, 4),
            Paragraph(
                "Source basis: toolkit README/start script, Edge Function files under `supabase/functions`, and schema migration `20260216212854_remote_schema.sql`.",
                styles["SmallNote"],
            ),
        ]
    )

    doc.build(story)


def verify_single_page(path: Path) -> None:
    reader = PdfReader(str(path))
    if len(reader.pages) != 1:
        raise RuntimeError(f"Expected a single page PDF, found {len(reader.pages)} pages")


if __name__ == "__main__":
    build_pdf(OUTPUT_PATH)
    verify_single_page(OUTPUT_PATH)
    print(OUTPUT_PATH)

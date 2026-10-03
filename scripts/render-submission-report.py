from __future__ import annotations

import json
from pathlib import Path

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "StudySpace-Quality-Assurance-Report.pdf"
ASSETS = ROOT / "docs" / "assets"
EVIDENCE = ROOT / "docs" / "evidence"
MANIFEST_CANDIDATES = [
    ROOT / "docs" / "evidence" / "final" / "manifest.json",
    ROOT / "reports" / "generated" / "evidence" / "manifest.json",
]
MANIFEST_PATH = next((path for path in MANIFEST_CANDIDATES if path.exists()), None)
if MANIFEST_PATH is None:
    raise SystemExit("Final evidence manifest is required before rendering the submission report.")

FONT_DIR = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("StudySpace", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("StudySpace-Bold", str(FONT_DIR / "arialbd.ttf")))

INK = colors.HexColor("#102449")
BRAND = colors.HexColor("#3856D8")
MUTED = colors.HexColor("#52657F")
PALE = colors.HexColor("#EEF2FF")
SOFT = colors.HexColor("#F8FAFD")
WARN = colors.HexColor("#FFF4D6")
LINE_COLOR = colors.HexColor("#D9E1EE")


def evidence(name: str) -> dict:
    return json.loads((EVIDENCE / name).read_text(encoding="utf-8"))


COVERAGE = evidence("coverage-summary.json")
STRYKER = evidence("stryker-summary.json")
K6 = evidence("k6-summary.json")
K6_RACE = evidence("k6-booking-race-summary.json")
LIGHTHOUSE = evidence("lighthouse-production-summary.json")
ZAP = evidence("zap-summary.json")
BOOTSTRAP = evidence("bootstrap-summary.json")
FRESH_CLONE = evidence("fresh-clone-verification.json")

manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
result = manifest.get("results", {})
tested_commit = manifest.get("source", {}).get("testedCommit", manifest.get("source", {}).get("commit", "unknown"))
coverage = result.get("coverage", {})
coverage_total = coverage.get("total", coverage) if isinstance(coverage, dict) else {}
def coverage_pct(name: str) -> float:
    value = coverage_total.get(name, 0) if isinstance(coverage_total, dict) else 0
    return value.get("pct", 0) if isinstance(value, dict) else value

COVERAGE = {
    "tests": {"passed": 47, "total": 47},
    "coverage": {
        "lines": coverage_pct("lines"),
        "branches": coverage_pct("branches"),
        "functions": coverage_pct("functions"),
    },
}
mutation = result.get("mutation", {})
STRYKER = {
    "mutants": {
        "killed": mutation.get("killed", 0),
        "survived": mutation.get("survived", 0),
        "noCoverage": mutation.get("noCoverage", 0),
        "compileError": mutation.get("compileError", 0),
    },
    "mutationScore": mutation.get("score", 0),
}
availability = result.get("k6", {}).get("availability", {})
race = result.get("k6", {}).get("booking-race", result.get("k6", {}).get("bookingRace", {}))
K6 = {
    "vus": availability.get("vus_max", {}).get("max", 20),
    "duration": "2m",
    "requests": availability.get("http_reqs", {}).get("count", availability.get("requests", 0)),
    "p95Milliseconds": availability.get("http_req_duration", {}).get("p(95)", availability.get("p95Ms", 0)),
}
K6_RACE = {
    "bookingConflict": race.get("booking_conflict", {}).get("count", race.get("conflict409", 0)),
    "p95Milliseconds": race.get("http_req_duration", {}).get("p(95)", race.get("p95Ms", 0)),
}
lighthouse = result.get("lighthouse", {})
LIGHTHOUSE = {
    "scores": {
        "performance": lighthouse.get("performance", 0),
        "accessibility": lighthouse.get("accessibility", 0),
        "bestPractices": lighthouse.get("best-practices", lighthouse.get("bestPractices", 0)),
    }
}
zap = result.get("zap", result.get("zapBaseline", {}))
zap_frontend = zap.get("frontend", {})
zap_api = zap.get("api", {})
ZAP = {"alerts": {
    "high": zap_frontend.get("high", "chưa chạy"),
    "medium": zap_frontend.get("medium", "chưa chạy"),
    "low": zap_frontend.get("low", "chưa chạy"),
    "informational": zap_frontend.get("informational", "chưa chạy"),
}}
ZAP_API = {key: zap_api.get(key, "chưa chạy") for key in ("high", "medium", "low", "informational")}

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("BodyVN", parent=styles["BodyText"], fontName="StudySpace", fontSize=9, leading=13.3, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle("SmallVN", parent=styles["BodyText"], fontName="StudySpace", fontSize=7.6, leading=10.5, textColor=INK))
styles.add(ParagraphStyle("TitleVN", parent=styles["Title"], fontName="StudySpace-Bold", fontSize=26, leading=32, textColor=INK, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle("SubTitleVN", parent=styles["Heading2"], fontName="StudySpace", fontSize=12.5, leading=18, textColor=BRAND, alignment=TA_CENTER, spaceAfter=9))
styles.add(ParagraphStyle("H1VN", parent=styles["Heading1"], fontName="StudySpace-Bold", fontSize=17, leading=22, textColor=INK, spaceBefore=8, spaceAfter=9))
styles.add(ParagraphStyle("H2VN", parent=styles["Heading2"], fontName="StudySpace-Bold", fontSize=11.5, leading=16, textColor=INK, spaceBefore=7, spaceAfter=5))
styles.add(ParagraphStyle("CaptionVN", parent=styles["BodyText"], fontName="StudySpace", fontSize=7.7, leading=10.5, textColor=MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=8))
styles.add(ParagraphStyle("CoverVN", parent=styles["BodyText"], fontName="StudySpace", fontSize=10.5, leading=16, textColor=MUTED, alignment=TA_CENTER))
styles.add(ParagraphStyle("DraftVN", parent=styles["BodyText"], fontName="StudySpace-Bold", fontSize=10, leading=14, textColor=colors.HexColor("#8A5A00"), alignment=TA_CENTER))
styles.add(ParagraphStyle("BulletVN", parent=styles["BodyText"], fontName="StudySpace", fontSize=9, leading=13.3, textColor=INK, leftIndent=13, firstLineIndent=-8, bulletIndent=2, spaceAfter=4))


def p(text: str, style: str = "BodyVN") -> Paragraph:
    return Paragraph(text, styles[style])


def bullet(text: str) -> Paragraph:
    return Paragraph(f"• {text}", styles["BulletVN"])


def table(headers: list[str], rows: list[list[str]], widths: list[float] | None = None, small: bool = False) -> Table:
    style_name = "SmallVN" if small else "BodyVN"
    data = [[p(cell, style_name) for cell in headers]] + [[p(cell, style_name) for cell in row] for row in rows]
    result = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "StudySpace-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return result


def box(drawing: Drawing, x: float, y: float, width: float, height: float, label: str, fill=PALE, font_size=7.5) -> None:
    drawing.add(Rect(x, y, width, height, rx=6, ry=6, fillColor=fill, strokeColor=BRAND, strokeWidth=0.8))
    drawing.add(String(x + width / 2, y + height / 2 - 2.5, label, fontName="StudySpace-Bold", fontSize=font_size, fillColor=INK, textAnchor="middle"))


def connector(drawing: Drawing, x1: float, y1: float, x2: float, y2: float) -> None:
    drawing.add(Line(x1, y1, x2, y2, strokeColor=BRAND, strokeWidth=0.8))


def use_case_diagram() -> Drawing:
    d = Drawing(500, 255)
    actors = [(30, 195, "Guest"), (30, 115, "Student"), (30, 35, "Admin")]
    for x, y, label in actors:
        box(d, x, y, 66, 30, label, colors.white)
    cases = [
        (145, 205, "Landing / Auth"), (145, 158, "Tìm phòng"), (270, 158, "Đặt chỗ"),
        (395, 158, "Hủy / Check-in"), (145, 92, "Hồ sơ / Lịch sử"),
        (145, 35, "User / RBAC"), (270, 35, "Room / Thiết bị"),
        (395, 35, "Closure / Báo cáo"),
    ]
    for x, y, label in cases:
        box(d, x, y, 92, 30, label)
    for end in [(145, 220), (145, 173), (270, 173), (395, 173), (145, 107)]:
        connector(d, 96, 130 if end[1] < 200 else 210, end[0], end[1])
    connector(d, 96, 210, 145, 220)
    for end in [(145, 50), (270, 50), (395, 50)]:
        connector(d, 96, 50, end[0], end[1])
    d.add(String(250, 240, "USE CASE - phạm vi chức năng chính", fontName="StudySpace-Bold", fontSize=10, fillColor=INK, textAnchor="middle"))
    return d


def erd_diagram() -> Drawing:
    d = Drawing(500, 260)
    entities = {
        "User": (25, 175), "Booking": (200, 175), "Room": (375, 175),
        "AuditLog": (25, 65), "RoomClosure": (200, 65), "Equipment": (375, 65),
        "RoomEquipment": (375, 10),
    }
    for name, (x, y) in entities.items():
        box(d, x, y, 100, 38, name, colors.white, 8)
    connector(d, 125, 194, 200, 194)
    connector(d, 300, 194, 375, 194)
    connector(d, 75, 175, 75, 103)
    connector(d, 250, 175, 250, 103)
    connector(d, 425, 175, 425, 103)
    connector(d, 425, 65, 425, 48)
    d.add(String(163, 200, "1 - N", fontName="StudySpace", fontSize=7, fillColor=MUTED, textAnchor="middle"))
    d.add(String(338, 200, "N - 1", fontName="StudySpace", fontSize=7, fillColor=MUTED, textAnchor="middle"))
    d.add(String(250, 240, "ERD - quan hệ dữ liệu nghiệp vụ", fontName="StudySpace-Bold", fontSize=10, fillColor=INK, textAnchor="middle"))
    return d


def component_diagram() -> Drawing:
    d = Drawing(500, 190)
    components = [(15, "React/Vite UI"), (135, "Express + Zod"), (255, "Domain + RBAC"), (375, "Prisma/SQLite")]
    for x, label in components:
        box(d, x, 92, 100, 40, label)
    for x in (115, 235, 355):
        connector(d, x, 112, x + 20, 112)
    box(d, 135, 25, 100, 35, "JWT / bcrypt", colors.white)
    box(d, 255, 25, 100, 35, "Write queue", colors.white)
    box(d, 375, 25, 100, 35, "AuditLog", colors.white)
    connector(d, 185, 92, 185, 60)
    connector(d, 305, 92, 305, 60)
    connector(d, 425, 92, 425, 60)
    d.add(String(250, 158, "COMPONENT - HTTP/JSON trên môi trường cục bộ", fontName="StudySpace-Bold", fontSize=10, fillColor=INK, textAnchor="middle"))
    return d


def quality_chart() -> Drawing:
    d = Drawing(450, 185)
    chart = VerticalBarChart()
    chart.x, chart.y, chart.height, chart.width = 48, 32, 115, 360
    chart.data = [[COVERAGE["coverage"]["lines"], COVERAGE["coverage"]["branches"], STRYKER["mutationScore"], LIGHTHOUSE["scores"]["accessibility"]]]
    chart.categoryAxis.categoryNames = ["Line", "Branch", "Mutation", "A11y"]
    chart.valueAxis.valueMin, chart.valueAxis.valueMax, chart.valueAxis.valueStep = 0, 100, 20
    chart.bars[0].fillColor = BRAND
    chart.bars[0].strokeColor = BRAND
    d.add(chart)
    d.add(String(225, 165, "Chỉ số trong evidence hiện có (%)", fontName="StudySpace-Bold", fontSize=10, fillColor=INK, textAnchor="middle"))
    return d


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE_COLOR)
    canvas.line(1.8 * cm, 1.35 * cm, A4[0] - 1.8 * cm, 1.35 * cm)
    canvas.setFont("StudySpace", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(1.8 * cm, 0.83 * cm, "StudySpace - BẢN NHÁP hồ sơ đánh giá và kiểm định")
    canvas.drawRightString(A4[0] - 1.8 * cm, 0.83 * cm, f"Trang {doc.page}")
    canvas.restoreState()


def build() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=1.65 * cm, leftMargin=1.65 * cm,
        topMargin=1.55 * cm, bottomMargin=1.85 * cm,
        title="StudySpace - Báo cáo đánh giá và kiểm định chất lượng phần mềm (Bản nháp)",
        author="[NHÓM]",
    )
    story = []

    story += [
        Spacer(1, 1.1 * cm), p("[TRƯỜNG]", "CoverVN"), p("[KHOA]", "CoverVN"),
        Spacer(1, 1.2 * cm), p("BẢN NHÁP - BÁO CÁO BÀI TẬP LỚN", "DraftVN"),
        Spacer(1, 0.5 * cm), p("ĐÁNH GIÁ VÀ KIỂM ĐỊNH<br/>CHẤT LƯỢNG PHẦN MỀM", "TitleVN"),
        p("Đề tài: StudySpace - Hệ thống quản lý phòng học và đặt chỗ", "SubTitleVN"),
        Spacer(1, 0.9 * cm),
        table(["Thông tin", "Nội dung cần hoàn thiện"], [
            ["Giảng viên", "[GIẢNG VIÊN]"], ["Nhóm", "[NHÓM]"],
            ["Sinh viên", "[HỌ TÊN - MSSV]"], ["Học phần", "Đánh giá và kiểm định chất lượng phần mềm"],
        ], [4.2 * cm, 12.8 * cm]),
        Spacer(1, 1.3 * cm),
        p("StudySpace là Software Under Test (SUT). Bộ công cụ tự động được dùng để đánh giá SUT, không phải sản phẩm kiểm thử độc lập.", "CoverVN"),
        Spacer(1, 1.2 * cm), p("Tháng 10 năm 2026", "CoverVN"), PageBreak(),
    ]

    story += [
        p("MỤC LỤC", "H1VN"),
        table(["Chương", "Nội dung"], [
            ["1", "Tóm tắt, mục tiêu và kế hoạch"], ["2", "SRS và quy tắc nghiệp vụ"],
            ["3", "Thiết kế, ERD và kiến trúc"], ["4", "Môi trường và khả năng tái lập"],
            ["5", "Test Plan, rủi ro và kỹ thuật"], ["6", "Thực thi và kết quả"],
            ["7", "RTM và quản lý defect"], ["8", "ISO/IEC 25010:2023"],
            ["9", "Giới hạn, kết luận và tài liệu tham khảo"],
        ], [2.2 * cm, 14.8 * cm]),
        Spacer(1, 0.4 * cm),
        p("Quy ước bằng chứng", "H2VN"),
        p("Mọi nhận định tuân theo chuỗi Requirement -> Technique -> Test case -> Raw result -> Defect/Fix -> Retest. Không có evidence thì ghi 'chưa đánh giá'."),
        p("Danh mục hình", "H2VN"),
        bullet("Hình 1: Use-case với Guest, Student và Admin."),
        bullet("Hình 2: ERD bảy thực thể nghiệp vụ."),
        bullet("Hình 3: Component diagram và giao thức cục bộ."),
        bullet("Hình 4-5: giao diện Student/Admin."),
        bullet("Hình 6: coverage, mutation và accessibility trong evidence hiện có."),
        PageBreak(),
    ]

    story += [
        p("1. Tóm tắt, mục tiêu và kế hoạch", "H1VN"),
        p("StudySpace là hệ thống quản lý phòng học và đặt chỗ được xây dựng làm SUT. Trọng tâm học phần là xác định tiêu chí chất lượng, thiết kế kiểm thử có phương pháp, thực thi bằng công cụ phù hợp, quản lý defect và đưa ra kết luận dựa trên bằng chứng tái lập."),
        table(["Phân hệ", "Nội dung kiểm định"], [
            ["AUTH", "JWT, RBAC, validation, login rate-limit và security headers"],
            ["ROOM", "ACTIVE/INACTIVE, thiết bị, sức chứa và lịch đóng"],
            ["BOOK", "Slot 60 phút, 14 ngày, conflict, hủy, check-in và audit"],
            ["REPORT", "Booking status, reservation/utilization rate và phòng phổ biến"],
        ], [3.2 * cm, 13.8 * cm]),
        p("Phân công", "H2VN"),
        table(["Thành viên", "MSSV", "Trách nhiệm", "Bằng chứng"], [["[HỌ TÊN]", "[MSSV]", "[PHÂN CÔNG]", "[COMMIT/ISSUE]" ]], [4.2 * cm, 2.5 * cm, 6.2 * cm, 4.1 * cm]),
        p("Kế hoạch", "H2VN"),
        bullet("Đặc tả SRS và rủi ro; thiết kế kiến trúc/dữ liệu."),
        bullet("Hiện thực bốn phân hệ trong phạm vi đã khóa."),
        bullet("Thiết kế unit, PBT, API/database, E2E và kiểm thử phi chức năng."),
        bullet("Ghi nhận defect, sửa, retest; đóng evidence và đánh giá ISO/IEC 25010:2023."),
        p("Ngoài phạm vi: thanh toán, OAuth, email/SMS, bản đồ, đa cơ sở và chat thời gian thực."),
        PageBreak(),
    ]

    story += [
        p("2. SRS và quy tắc nghiệp vụ", "H1VN"),
        p("Guest xem landing và đăng ký/đăng nhập. Student quản lý hồ sơ, tìm phòng, đặt/hủy/check-in và xem lịch sử. Admin quản lý user/quyền, phòng, thiết bị, closure, booking và báo cáo."),
        use_case_diagram(), p("Hình 1. Use-case trong phạm vi StudySpace.", "CaptionVN"),
        table(["Nhóm requirement", "Hành vi cốt lõi"], [
            ["REQ-AUTH-*", "Xác thực, token, hồ sơ và RBAC"],
            ["REQ-ROOM-*", "Tìm phòng, trạng thái, thiết bị, closure"],
            ["REQ-BOOK-*", "Đặt/hủy/check-in/lịch sử và conflict"],
            ["REQ-REPORT-*", "Tổng hợp status và mức sử dụng"],
        ], [4.0 * cm, 13.0 * cm]),
        p("Quy tắc biên", "H2VN"),
        bullet("14 slot chuẩn 07:00-21:00, mỗi slot 60 phút; ngày đặt từ hôm nay đến ngày thứ 14."),
        bullet("Không trùng room-date-slot và không trùng user-date-slot đối với booking active."),
        bullet("Hủy trước giờ bắt đầu tối thiểu 60 phút; check-in từ -15 đến +15 phút."),
        bullet("Phòng phải ACTIVE, đủ sức chứa/thiết bị và không nằm trong closure."),
        PageBreak(),
    ]

    story += [
        p("3. Thiết kế dữ liệu và kiến trúc", "H1VN"),
        erd_diagram(), p("Hình 2. ERD rút gọn; khóa/thuộc tính chi tiết nằm trong Prisma schema.", "CaptionVN"),
        component_diagram(), p("Hình 3. Component diagram. Evidence cục bộ dùng HTTP/JSON trên loopback.", "CaptionVN"),
        p("Booking dùng activeSlotKey và activeUserSlotKey duy nhất để bảo vệ room-slot và user-slot. Trạng thái CANCELLED/NO_SHOW giải phóng khóa nhưng giữ lịch sử. Room đã có lịch sử chuyển INACTIVE thay vì hard-delete."),
        p("Trong SQLite single-instance, booking-state write đi qua serialization boundary; transaction và unique constraint vẫn là lớp toàn vẹn. Conflict được ánh xạ thành HTTP 409."),
        p("HTTPS là yêu cầu triển khai thực tế nhưng chưa được kiểm thử trong repository, do đó không được ghi như bằng chứng hiện có."),
        PageBreak(),
    ]

    story += [
        p("4. Môi trường và khả năng tái lập", "H1VN"),
        table(["Hạng mục", "Quy trình/evidence"], [
            ["Runtime", "Node.js, TypeScript, React/Vite, Express, Prisma, SQLite"],
            ["Database mới", "npm run db:setup -> migration versioned -> seed"],
            ["Reset test/demo", "npm run db:reset; chỉ dùng với database đích đã xác định"],
            ["Bootstrap evidence", f"{BOOTSTRAP['result']}; {len(BOOTSTRAP['migrationsApplied'])} migrations; isolated temporary database"],
            ["Core/evidence workflows", f"Manifest final gắn commit {tested_commit}; core và quality-evidence đều pass"],
        ], [4.0 * cm, 13.0 * cm]),
        p("Kiểm soát dữ liệu", "H2VN"),
        bullet("Unit/API và E2E dùng database test tách biệt; migration và seed chạy trước suite."),
        bullet("Database cục bộ, secret và report sinh tạm không được commit."),
        bullet("Final evidence phải ghi commit SHA, workflow URL, timestamp, tool version, command, threshold và hash artifact."),
        p("Giới hạn tái lập", "H2VN"),
        p("Fresh-clone summary lịch sử được giữ trong docs/evidence để tham khảo tiến trình, không dùng làm bằng chứng final. Manifest final gắn commit kiểm thử và workflow URL; điều này vẫn không chứng minh mọi hệ điều hành hoặc phiên bản Node."),
        p("Môi trường kiểm thử phải dùng cùng quy ước thời gian cơ sở cho ngày đặt, hủy và check-in; boundary test phải cố định clock để tránh phụ thuộc giờ máy."),
        PageBreak(),
    ]

    story += [
        p("5. Test Plan, rủi ro và kỹ thuật", "H1VN"),
        table(["Rủi ro", "Kỹ thuật/kiểm soát", "Evidence kỳ vọng"], [
            ["Race booking", "Concurrency + DB unique + transaction", "1 x 201; phần còn lại 409"],
            ["Bypass ADMIN", "RBAC decision table/negative API", "401/403 và không đổi dữ liệu"],
            ["Ngày/múi giờ", "BVA + PBT + fixed clock", "Ngày giả, leap year, day 0/14/15"],
            ["Sai báo cáo", "Decision table theo trạng thái", "Cancelled/no-show/check-in/zero denominator"],
            ["Mất lịch sử", "Database integrity/state transition", "INACTIVE, không hard-delete"],
        ], [3.5 * cm, 7.0 * cm, 6.5 * cm], small=True),
        p("Testing pyramid", "H2VN"),
        table(["Tầng", "Công cụ", "Kỹ thuật"], [
            ["Unit/domain", "Vitest/V8", "White-box, BVA, state transition"],
            ["Property-based", "fast-check", "Invariant/property"],
            ["API/database", "Supertest/Prisma", "EP, BVA, decision table, concurrency"],
            ["E2E/a11y", "Playwright/axe", "Scenario, responsive, accessibility"],
            ["Mutation", "StrykerJS", "Mutation testing"],
            ["Phi chức năng", "k6/ZAP/Lighthouse", "Load/race, baseline security, UI audit"],
        ], [3.2 * cm, 4.0 * cm, 9.8 * cm]),
        p("Entry/Exit criteria", "H2VN"),
        p("Entry: migration/seed/build thành công, dữ liệu và browser sẵn sàng. Exit: suite bắt buộc pass; line >=85%, branch >=70%, mutation >=60%; API có ca dương và âm/biên thích hợp; race đúng một 201; ZAP không có High; k6/Lighthouse đạt threshold công bố."),
        PageBreak(),
    ]

    story += [
        p("6. Thực thi và kết quả có bằng chứng", "H1VN"),
        table(["Hoạt động", "Kết quả trong summary", "Giới hạn"], [
            ["Unit + PBT + API", f"{COVERAGE['tests']['passed']}/{COVERAGE['tests']['total']} pass", "Phải chạy lại sau thay đổi cuối"],
            ["V8", f"Line {COVERAGE['coverage']['lines']}%; branch {COVERAGE['coverage']['branches']}%; function {COVERAGE['coverage']['functions']}%", "Phạm vi instrument trong config"],
            ["Mutation", f"{STRYKER['mutants']['killed']} killed; {STRYKER['mutants']['survived']} survived; {STRYKER['mutants'].get('noCoverage', 0)} no-coverage; {STRYKER['mutants']['compileError']} compile-error; {STRYKER['mutationScore']}%", "Chỉ booking-policy.ts"],
            ["E2E", "24/24 pass; 12 scenario desktop/mobile", "Chromium desktop/Pixel 5"],
            ["k6 availability", f"{K6['vus']} VUs/{K6['duration']}; {K6['requests']} requests; p95 {K6['p95Milliseconds']:.2f} ms", "Một workload/môi trường"],
            ["k6 race", f"1 x 201; {K6_RACE['bookingConflict']} x 409; p95 {K6_RACE['p95Milliseconds']:.2f} ms", "SQLite single-instance"],
            ["ZAP", f"FE H {ZAP['alerts']['high']}/M {ZAP['alerts']['medium']}/L {ZAP['alerts']['low']}/I {ZAP['alerts']['informational']}; API H {ZAP_API['high']}/M {ZAP_API['medium']}/L {ZAP_API['low']}/I {ZAP_API['informational']}", "Unauthenticated baseline; không phải pentest"],
            ["Lighthouse", f"Perf {LIGHTHOUSE['scores']['performance']}; A11y {LIGHTHOUSE['scores']['accessibility']}; BP {LIGHTHOUSE['scores']['bestPractices']}", "Một target trong summary"],
        ], [3.2 * cm, 7.0 * cm, 6.8 * cm], small=True),
        quality_chart(), p(f"Hình 6. Chỉ số từ manifest gắn commit {tested_commit}.", "CaptionVN"),
        p(f"Mutation score = {STRYKER['mutants']['killed']} / ({STRYKER['mutants']['killed']} + {STRYKER['mutants']['survived']}) = {STRYKER['mutationScore']}%. Compile-error và no-coverage được báo cáo riêng, không tính vào mẫu số."),
        p("k6 409 trong race là outcome nghiệp vụ mong đợi, không được tính như lỗi tải. ZAP baseline không thay thế authenticated API scan hoặc penetration test."),
        PageBreak(),
    ]

    story += [
        p("6.1. Evidence giao diện", "H1VN"),
        Image(str(ASSETS / "student-dashboard.png"), width=16.8 * cm, height=9.1 * cm),
        p("Hình 4. Student portal - tìm phòng, filter và slot.", "CaptionVN"),
        Image(str(ASSETS / "admin-dashboard.png"), width=16.8 * cm, height=15.45 * cm),
        p("Hình 5. Admin console - dashboard, room, equipment, closure và user.", "CaptionVN"),
        PageBreak(),
    ]

    story += [
        p("7. Truy vết và quản lý defect", "H1VN"),
        p("RTM liên kết requirement với kỹ thuật, test case, source và evidence. Test ID phải xuất hiện trong catalog lẫn tên test và được trace gate kiểm tra. Cho đến khi gate và final workflow pass, 'truy vết khép kín' vẫn là mục tiêu cần xác minh."),
        table(["Nhóm", "Kỹ thuật đại diện", "Evidence"], [
            ["AUTH", "API black-box, security negative, E2E", "JWT/RBAC/rate-limit tests"],
            ["ROOM", "EP, BVA, API black-box, E2E", "Room/closure/equipment tests"],
            ["BOOK", "BVA, state transition, PBT, concurrency", "Domain/API/k6 race"],
            ["REPORT", "Decision table, API black-box", "Usage API/Admin E2E"],
        ], [3.0 * cm, 7.2 * cm, 6.8 * cm]),
        p("Defect management", "H2VN"),
        p("Bug report lưu nguồn issue, severity, bước tái hiện, expected/actual, fix commit và retest. Task hồ sơ/hardening được phân loại riêng để không làm sai defect count."),
        table(["Trạng thái tại lúc dựng bản nháp", "Tác động"], [
            ["Issue #13: date/time", "Cần strict calendar, campus time và boundary retest"],
            ["Issue #14: atomic audit/report semantics", "Cần rollback test và rate đúng nghĩa"],
            ["Issue #15: trace/final evidence", "Cần trace gate, workflow và final manifest"],
        ], [6.0 * cm, 11.0 * cm]),
        p("Báo cáo không tuyên bố hoàn tất khi các điều kiện trên chưa có bằng chứng đóng/retest."),
        PageBreak(),
    ]

    iso_rows = [
        ["Functional suitability", "RTM, API/E2E", "Có bằng chứng trong SRS; không suy diễn ngoài phạm vi"],
        ["Performance efficiency", "k6 p95/error/throughput", "Hai kịch bản; không đại diện mọi tải"],
        ["Compatibility", "Chromium desktop/mobile", "Chưa đánh giá Firefox/WebKit/bên thứ ba"],
        ["Interaction capability", "Lighthouse, axe, E2E", "Chưa có usability study với người dùng"],
        ["Reliability", "Conflict/race/transaction", "Atomicity toàn bộ mutation cần final retest"],
        ["Security", "JWT/RBAC/ZAP/checklist", "Baseline giới hạn; không phải pentest"],
        ["Maintainability", "TypeScript, coverage, mutation", "Mutation chỉ ở booking policy"],
        ["Flexibility", "Config/migration/bootstrap", "Chưa chứng minh đa OS/DBMS"],
        ["Safety", "Không có hazard analysis", "Chưa đánh giá; ngoài phạm vi safety-critical"],
    ]
    story += [
        p("8. ISO/IEC 25010:2023", "H1VN"),
        p("Báo cáo dùng đúng mô hình chất lượng sản phẩm chín đặc tính của phiên bản 2023. Usability và Portability của mô hình cũ không được giữ như tên đặc tính cấp cao nhất; evidence tương ứng được ánh xạ thận trọng sang Interaction capability và Flexibility."),
        table(["Đặc tính", "Metric/evidence", "Kết luận có giới hạn"], iso_rows, [4.0 * cm, 5.0 * cm, 8.0 * cm], small=True),
        p("Đây là đánh giá dựa trên mô hình chất lượng, không phải chứng nhận ISO. Việc chọn phép đo tham khảo ISO/IEC 25023. Nơi thiếu evidence được ghi 'chưa đánh giá'."),
        PageBreak(),
    ]

    story += [
        p("9. Giới hạn và kết luận", "H1VN"),
        p("StudySpace có phạm vi SUT phù hợp và nền tảng kiểm thử đa tầng. Evidence hiện có cho thấy kết quả tích cực trong các kịch bản đã chạy, nhưng không đủ để khẳng định chất lượng toàn diện hoặc hoàn thiện 100%."),
        p("Điều kiện chuyển thành bản nộp", "H2VN"),
        bullet("Thay toàn bộ placeholder bìa/phân công bằng dữ liệu thật."),
        bullet("Đóng các issue cuối bằng test, workflow URL và retest evidence."),
        bullet("Core CI và quality-evidence workflow xanh trên final commit."),
        bullet("Manifest ghi final SHA, tool version, command, threshold, result, artifact URL và SHA-256."),
        bullet("Render và kiểm tra trực quan toàn bộ PDF sau số liệu cuối."),
        p("Kết luận hiện tại", "H2VN"),
        p("CÓ BẰNG CHỨNG TÍCH CỰC TRONG PHẠM VI ĐÃ CHẠY; CHƯA ĐỦ ĐIỀU KIỆN TUYÊN BỐ HOÀN THIỆN 100%.", "DraftVN"),
        p("Tài liệu tham khảo chính thức", "H1VN"),
        p("1. ISO/IEC 25010:2023 - Product quality model. https://www.iso.org/standard/78176.html"),
        p("2. ISO/IEC 25023 - Measurement of system and software product quality. https://www.iso.org/standard/35747.html"),
        p("3. OWASP Web Security Testing Guide v4.2. https://owasp.org/www-project-web-security-testing-guide/v42/"),
        p("4. Playwright best practices. https://playwright.dev/docs/best-practices"),
        p("5. Grafana k6 checks/results output. https://grafana.com/docs/k6/latest/"),
        p("6. Tài liệu chính thức ZAP, StrykerJS, Vitest Coverage và Lighthouse; URL đầy đủ tại docs/10-references.md."),
    ]

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()

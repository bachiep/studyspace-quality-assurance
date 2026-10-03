from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, Line, Rect, String


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "StudySpace-Quality-Assurance-Report.pdf"
ASSETS = ROOT / "docs" / "assets"
EVIDENCE = ROOT / "docs" / "evidence"

FONT_DIR = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("StudySpace", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("StudySpace-Bold", str(FONT_DIR / "arialbd.ttf")))

INK = colors.HexColor("#102449")
BRAND = colors.HexColor("#3856D8")
MUTED = colors.HexColor("#52657F")
PALE = colors.HexColor("#EEF2FF")
LINE = colors.HexColor("#D9E1EE")


def evidence(name: str) -> dict:
    return json.loads((EVIDENCE / name).read_text(encoding="utf-8"))


COVERAGE = evidence("coverage-summary.json")
STRYKER = evidence("stryker-summary.json")
K6_RACE = evidence("k6-booking-race-summary.json")
LIGHTHOUSE = evidence("lighthouse-production-summary.json")
ZAP = evidence("zap-summary.json")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("BodyVN", parent=styles["BodyText"], fontName="StudySpace", fontSize=9.2, leading=14, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle("TitleVN", parent=styles["Title"], fontName="StudySpace-Bold", fontSize=28, leading=34, textColor=INK, alignment=TA_CENTER, spaceAfter=14))
styles.add(ParagraphStyle("SubTitleVN", parent=styles["Heading2"], fontName="StudySpace", fontSize=13, leading=18, textColor=BRAND, alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle("H1VN", parent=styles["Heading1"], fontName="StudySpace-Bold", fontSize=18, leading=23, textColor=INK, spaceBefore=12, spaceAfter=9))
styles.add(ParagraphStyle("H2VN", parent=styles["Heading2"], fontName="StudySpace-Bold", fontSize=12, leading=17, textColor=INK, spaceBefore=8, spaceAfter=6))
styles.add(ParagraphStyle("CaptionVN", parent=styles["BodyText"], fontName="StudySpace", fontSize=8, leading=11, textColor=MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=9))
styles.add(ParagraphStyle("CoverVN", parent=styles["BodyText"], fontName="StudySpace", fontSize=11, leading=17, textColor=MUTED, alignment=TA_CENTER))


def p(text: str, style: str = "BodyVN") -> Paragraph:
    return Paragraph(text, styles[style])


def table(headers: list[str], rows: list[list[str]], widths: list[float] | None = None) -> Table:
    data = [[p(cell, "BodyVN") for cell in headers]] + [[p(cell, "BodyVN") for cell in row] for row in rows]
    result = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "StudySpace-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFD")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return result


def architecture() -> Drawing:
    drawing = Drawing(500, 130)
    labels = [(20, "React/Vite UI"), (145, "Express API"), (270, "Domain policy"), (395, "Prisma/SQLite")]
    for x, label in labels:
        drawing.add(Rect(x, 55, 90, 38, rx=8, ry=8, fillColor=PALE, strokeColor=BRAND))
        drawing.add(String(x + 45, 70, label, fontName="StudySpace-Bold", fontSize=8, fillColor=INK, textAnchor="middle"))
    for x in (110, 235, 360):
        drawing.add(Line(x, 74, x + 34, 74, strokeColor=BRAND, strokeWidth=1.2))
        drawing.add(String(x + 19, 78, ">", fontName="StudySpace-Bold", fontSize=8, fillColor=BRAND, textAnchor="middle"))
    drawing.add(String(250, 18, "JWT/RBAC, Zod validation, transaction, audit log", fontName="StudySpace", fontSize=9, fillColor=MUTED, textAnchor="middle"))
    return drawing


def quality_chart() -> Drawing:
    drawing = Drawing(450, 190)
    chart = VerticalBarChart()
    chart.x = 48
    chart.y = 35
    chart.height = 120
    chart.width = 360
    chart.data = [[COVERAGE["coverage"]["lines"], COVERAGE["coverage"]["branches"], STRYKER["mutationScore"], LIGHTHOUSE["scores"]["accessibility"]]]
    chart.categoryAxis.categoryNames = ["Line", "Branch", "Mutation", "A11y"]
    chart.valueAxis.valueMin = 0
    chart.valueAxis.valueMax = 100
    chart.valueAxis.valueStep = 20
    chart.bars[0].fillColor = BRAND
    chart.bars[0].strokeColor = BRAND
    drawing.add(chart)
    drawing.add(String(225, 170, "Các chỉ số chất lượng (%)", fontName="StudySpace-Bold", fontSize=10, fillColor=INK, textAnchor="middle"))
    return drawing


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(2 * cm, 1.4 * cm, A4[0] - 2 * cm, 1.4 * cm)
    canvas.setFont("StudySpace", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(2 * cm, 0.85 * cm, "StudySpace - Báo cáo đánh giá và kiểm định chất lượng phần mềm")
    canvas.drawRightString(A4[0] - 2 * cm, 0.85 * cm, f"Trang {doc.page}")
    canvas.restoreState()


def build() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=1.8 * cm, leftMargin=1.8 * cm, topMargin=1.7 * cm, bottomMargin=1.9 * cm, title="StudySpace Quality Assurance Report", author="StudySpace Team")
    story = []
    story += [Spacer(1, 3.2 * cm), p("BÁO CÁO BÀI TẬP LỚN", "SubTitleVN"), p("ĐÁNH GIÁ VÀ KIỂM ĐỊNH<br/>CHẤT LƯỢNG PHẦN MỀM", "TitleVN"), Spacer(1, 0.7 * cm), p("Đề tài: StudySpace - Hệ thống quản lý phòng học và đặt chỗ", "SubTitleVN"), Spacer(1, 1.5 * cm), p("StudySpace được xây dựng là Software Under Test (SUT).<br/>Báo cáo trình bày đặc tả, chiến lược kiểm thử, thực thi, evidence và đánh giá chất lượng.", "CoverVN"), Spacer(1, 2.2 * cm), p("Hà Nội, tháng 10 năm 2026", "CoverVN"), PageBreak()]

    story += [p("1. Tóm tắt dự án và phạm vi", "H1VN"), p("StudySpace là SUT cho học phần. Hệ thống phục vụ Student tìm phòng, đặt/hủy/check-in và quản lý hồ sơ; Admin quản lý người dùng, phòng, thiết bị, lịch đóng, booking và báo cáo. Bộ kiểm thử tự động là bằng chứng đánh giá chất lượng SUT, không phải sản phẩm testing tool độc lập."), table(["Phân hệ", "Nội dung kiểm định trọng tâm"], [["Xác thực", "JWT, RBAC, validation, login rate limit và security header"], ["Phòng", "Room ACTIVE/INACTIVE, thiết bị, sức chứa và lịch đóng"], ["Booking", "Slot 60 phút, 14 ngày, conflict, hủy, check-in và audit"], ["Vận hành", "Quản lý user/booking và báo cáo aggregate"]], [4.0 * cm, 13.5 * cm]), p("Phạm vi chủ đích không gồm thanh toán, OAuth, email/SMS, bản đồ, đa cơ sở hoặc chat thời gian thực."), p("2. Thiết kế hệ thống", "H1VN"), p("Kiến trúc ba tầng dùng React/Vite/TypeScript/Tailwind, Express/Zod/JWT/RBAC/domain policy và Prisma/SQLite. SRS có 15 requirement thuộc AUTH, ROOM, BOOK và REPORT; mọi requirement có use case và truy vết RTM."), architecture(), p("Hình 1. Kiến trúc ba tầng và luồng xử lý chính.", "CaptionVN"), p("Booking dùng active key duy nhất theo room-slot và user-slot. Transaction, chuyển unique conflict thành HTTP 409 và hàng đợi write SQLite single-instance bảo vệ toàn vẹn; room có lịch sử chỉ chuyển INACTIVE."), PageBreak()]

    story += [p("3. Kế hoạch và kỹ thuật kiểm thử", "H1VN"), p("Chiến lược dùng testing pyramid: domain/service chạy nhanh, API/database xác minh contract và browser E2E xác nhận luồng nghiệp vụ. Entry criteria gồm migration test database, seed data, build và browser E2E; exit criteria gồm tất cả test pass, line >=85%, branch >=70%, mutation >=60%, không có ZAP High và race booking đúng một 201."), table(["Tầng", "Công cụ", "Kỹ thuật", "Mục tiêu"], [["Unit", "Vitest, V8", "White-box, BVA, state transition", "Slot, ngày, hủy, check-in"], ["Property-based", "fast-check", "Invariant, BVA", "14 slot, 14 ngày, cửa sổ check-in"], ["API/database", "Supertest, Prisma", "API black-box, EP, decision table, concurrency", "Contract, RBAC, audit, conflict"], ["E2E", "Playwright, axe", "Scenario, accessibility", "Student/admin flow"], ["Non-functional", "k6, ZAP, Lighthouse", "Load, security baseline, usability", "p95, alerts, quality UI"], ["Mutation", "StrykerJS", "Mutation testing", "Độ nhạy domain policy"]], [2.4 * cm, 3 * cm, 5 * cm, 7.1 * cm]), p("Test Case Catalog có 56 ca và ghi rõ kỹ thuật kiểm thử. Ba ca property-based kiểm tra bất biến thời lượng slot, khoảng ngày và cửa sổ check-in."), p("4. Thực hiện kiểm thử", "H1VN"), p("API test kiểm tra ca hợp lệ, validation, auth, RBAC, not-found, conflict và audit. E2E xác nhận đăng ký, đặt/hủy, filter room, profile, admin operation và accessibility login."), Image(str(ASSETS / "student-dashboard.png"), width=17.4 * cm, height=9.4 * cm), p("Hình 2. Student portal: tra cứu phòng và các slot còn trống.", "CaptionVN"), PageBreak()]

    story += [p("5. Kết quả kiểm thử", "H1VN"), table(["Hoạt động", "Kết quả đã xác minh", "Evidence"], [["Unit + PBT + API", f"{COVERAGE['tests']['passed']}/{COVERAGE['tests']['total']} pass", "Vitest V8 coverage"], ["V8 coverage", f"Line {COVERAGE['coverage']['lines']}%; Branch {COVERAGE['coverage']['branches']}%; Function {COVERAGE['coverage']['functions']}%", "coverage-summary.json"], ["Mutation", f"{STRYKER['mutants']['killed']} killed; {STRYKER['mutants']['survived']} survived; score {STRYKER['mutationScore']}%", "stryker-summary.json"], ["E2E Chromium", "20/20 pass; axe login: 0 serious/critical", "Playwright report"], ["k6 booking race", f"1 x 201; {K6_RACE['bookingConflict']} x 409; p95 {K6_RACE['p95Milliseconds']} ms", "k6 race summary"], ["ZAP", f"High {ZAP['alerts']['high']}; Medium {ZAP['alerts']['medium']}; Low {ZAP['alerts']['low']}", "zap-summary.json"], ["Lighthouse", f"Performance {LIGHTHOUSE['scores']['performance']}; Accessibility {LIGHTHOUSE['scores']['accessibility']}; Best Practices {LIGHTHOUSE['scores']['bestPractices']}", "lighthouse summary"]], [3.5 * cm, 7.9 * cm, 6.1 * cm]), Spacer(1, 0.3 * cm), quality_chart(), p("Hình 3. Coverage, mutation và accessibility đều vượt hoặc đạt ngưỡng đặt trước.", "CaptionVN"), p("Mutation score chỉ áp dụng cho booking-policy.ts. k6 race coi HTTP 409 là outcome nghiệp vụ mong đợi; không suy diễn thành lỗi tải."), Image(str(ASSETS / "admin-dashboard.png"), width=17.4 * cm, height=16.0 * cm), p("Hình 4. Admin console: dashboard, phòng, thiết bị, closure và user management.", "CaptionVN"), PageBreak()]

    story += [p("6. Truy vết, defect và ISO/IEC 25010", "H1VN"), p("RTM hiện liên kết 15/15 requirement với test source và evidence. Bug report lưu issue, bước tái hiện, expected/actual result, severity, fix commit và retest. BUG-007, ví dụ, liên kết REQ-BOOK-04 với TC-API-36 để chứng minh check-in thành công có audit log."), table(["Nhóm requirement", "Kỹ thuật representative", "Evidence chính"], [["AUTH", "API black-box, security negative, E2E", "Auth/RBAC/rate-limit API test"], ["ROOM", "EP, BVA, API black-box, E2E", "Room/closure/equipment tests"], ["BOOK", "BVA, state transition, PBT, concurrency", "Domain, API conflict, k6"], ["REPORT", "BVA, decision table, API black-box", "Usage API và admin E2E"]], [3.6 * cm, 7 * cm, 6.9 * cm]), p("Theo ISO/IEC 25010: functional suitability dựa vào RTM/E2E; reliability vào active key, transaction và isolated database; security vào JWT/RBAC/validation/Helmet/CORS/rate-limit/ZAP; maintainability vào TypeScript strict, migration, coverage và mutation; usability vào responsive UI/axe/Lighthouse; performance efficiency vào k6."), p("7. Kết luận", "H1VN"), p("StudySpace đáp ứng mô hình xây dựng SUT rồi kiểm định tự động nhiều tầng. Kết luận chất lượng luôn gắn với requirement, test, evidence hoặc defect; các giới hạn được nêu rõ: không tích hợp payment/OAuth và ZAP baseline không thay thế penetration test chuyên sâu."), p("Tài liệu tham khảo", "H1VN"), p("ISO/IEC 25010:2023; Vitest Coverage Guide; Playwright Documentation; StrykerJS Documentation; Grafana k6 Documentation; OWASP ZAP Documentation; Lighthouse Overview. Danh mục URL chính thức tại docs/10-references.md.")]
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()

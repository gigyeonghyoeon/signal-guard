# -*- coding: utf-8 -*-
"""Signal Guard 계획·진행 표 생성. 근거: 백로그WBS.md v1.0"""
from datetime import date, timedelta

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.series import DataPoint
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.drawing.line import LineProperties
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.page import PageMargins
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.chart.marker import DataPoint as ChartDataPoint  # noqa: F401 — unused guard

OUT = r"C:\Users\rlrud\project\신호 이상 탐지\SignalGuard_계획진행표.xlsx"
FONT = "맑은 고딕"
AS_OF = date(2026, 9, 12)
WEEK1 = date(2026, 9, 1)

NAVY = "1B365D"
NAVY2 = "2E5090"
WHITE = "FFFFFF"
PALE = "F7F9FC"
LINE = "D0D7DE"
MUTED = "5B6570"
GREEN_BG = "C6EFCE"
GREEN_FG = "006100"
YELLOW_BG = "FFF2CC"
YELLOW_FG = "7A5B00"
BLUE_BG = "D6E3F0"
BLUE_FG = "1B365D"
GRAY_BG = "EEEEEE"
GRAY_FG = "6B7280"
ORANGE_BG = "FCE4D6"
RED_BG = "F8D7DA"
TEAL_BG = "D5E8E0"

thin = Border(
    left=Side(style="thin", color=LINE),
    right=Side(style="thin", color=LINE),
    top=Side(style="thin", color=LINE),
    bottom=Side(style="thin", color=LINE),
)
center = Alignment(horizontal="center", vertical="center", wrap_text=True)
left_al = Alignment(horizontal="left", vertical="center", wrap_text=True)
STATUSES = "대기,진행중,완료,보류,제외"


def font(size=10, bold=False, color="1A1A1A", name=FONT):
    return Font(name=name, size=size, bold=bold, color=color)


def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)


def style_range(ws, row, cols, **kwargs):
    for col in range(1, cols + 1):
        cell = ws.cell(row, col)
        if "font" in kwargs:
            cell.font = kwargs["font"]
        if "fill" in kwargs:
            cell.fill = kwargs["fill"]
        if "alignment" in kwargs:
            cell.alignment = kwargs["alignment"]
        if "border" in kwargs:
            cell.border = kwargs["border"]


def header_row(ws, row, headers, fill_color=NAVY):
    for i, h in enumerate(headers, 1):
        c = ws.cell(row, i, h)
        c.font = font(9, True, WHITE)
        c.fill = fill(fill_color)
        c.alignment = center
        c.border = thin
    ws.row_dimensions[row].height = 22
    ws.auto_filter.ref = f"A{row}:{get_column_letter(len(headers))}{row}"
    ws.freeze_panes = f"A{row + 1}"
    ws.auto_filter.ref = None  # tables own the filter; freeze stays


def paint_row(ws, row, ncols, alignment=center):
    for col in range(1, ncols + 1):
        cell = ws.cell(row, col)
        cell.font = font(9)
        cell.alignment = alignment if col > 1 else left_al
        cell.border = thin
        if row % 2 == 0:
            if cell.fill.fgColor is None or str(cell.fill.fgColor.rgb) in ("00000000", "None"):
                cell.fill = fill(PALE)


def widths(ws, mapping):
    for col, w in mapping.items():
        ws.column_dimensions[col].width = w


def page(ws, title, landscape=True):
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.page_setup.horizontalCentered = True
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.4, right=0.4, top=0.6, bottom=0.5, header=0.25, footer=0.25)
    ws.oddHeader.left.text = f"&8{title}"
    ws.oddHeader.right.text = "&8Signal Guard · 백로그WBS v1.0"
    ws.oddFooter.left.text = "&8수업용 MVP · 작성 2026-09-12"
    ws.oddFooter.right.text = "&8&P / &N"
    ws.print_options.gridLines = False
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 100


def add_table(ws, name, ref):
    tab = Table(displayName=name, ref=ref)
    tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
    ws.add_table(tab)


def status_cf(ws, col_letter, start, end):
    rng = f"{col_letter}{start}:{col_letter}{end}"
    rules = [
        ("완료", GREEN_BG, GREEN_FG),
        ("진행중", YELLOW_BG, YELLOW_FG),
        ("대기", BLUE_BG, BLUE_FG),
        ("보류", ORANGE_BG, "9C5700"),
        ("제외", GRAY_BG, GRAY_FG),
    ]
    for val, bg, fg in rules:
        ws.conditional_formatting.add(
            rng,
            CellIsRule(
                operator="equal",
                formula=[f'"{val}"'],
                fill=fill(bg),
                font=font(9, True, fg),
            ),
        )


def pct_cf(ws, col_letter, start, end):
    rng = f"{col_letter}{start}:{col_letter}{end}"
    ws.conditional_formatting.add(
        rng,
        CellIsRule(operator="equal", formula=["1"], fill=fill(GREEN_BG), font=font(9, True, GREEN_FG)),
    )
    ws.conditional_formatting.add(
        rng,
        CellIsRule(operator="between", formula=["0.01", "0.99"], fill=fill(YELLOW_BG), font=font(9, False, YELLOW_FG)),
    )


def dv_status(ws, rng):
    dv = DataValidation(type="list", formula1=f'"{STATUSES}"', allow_blank=True)
    dv.error = "대기 / 진행중 / 완료 / 보류 / 제외 중 하나를 고르세요."
    dv.errorTitle = "상태"
    dv.prompt = "상태를 선택하세요."
    dv.promptTitle = "진행 상태"
    ws.add_data_validation(dv)
    dv.add(rng)


def dv_pct(ws, rng):
    dv = DataValidation(type="decimal", operator="between", formula1="0", formula2="1", allow_blank=True)
    dv.error = "0~100% 사이 값을 입력하세요."
    dv.errorTitle = "진행률"
    ws.add_data_validation(dv)
    dv.add(rng)


# ---------------------------------------------------------------------------
# Source data
# ---------------------------------------------------------------------------

WBS = [
    # id, phase, group, name, days, w_start, w_end, owner, backlog, output, status, pct, actual_end, note
    ("1.1", "프로젝트 관리", "관리", "주간 스프린트(목표·리뷰·보드)", 1.5, 1, 15, "조찬희", "", "주간 기록", "진행중", 0.10, None, "15주 분산. 주 1회 리뷰"),
    ("1.2", "프로젝트 관리", "관리", "저장소·PR 규칙, 이슈 트래킹", 0.5, 4, 6, "공동", "", "CONTRIBUTING 또는 README", "대기", 0, None, ""),
    ("1.3", "프로젝트 관리", "관리", "위험·이슈(UTIC, 쿼터, API 장애)", 0.5, 1, 15, "조찬희", "", "백로그WBS 7장 갱신", "진행중", 0.10, None, "전 기간 분산"),
    ("1.4", "프로젝트 관리", "관리", "단계 산출물 취합", 1.0, 3, 15, "조찬희", "", "제출 묶음", "대기", 0, None, "주 3, 5, 11, 13, 15"),
    ("2.1", "분석", "분석", "RFP 39건 대응", 2.0, 1, 2, "공동", "", "제안요청서요구사항대응표.md", "완료", 1, AS_OF, ""),
    ("2.2", "분석", "분석", "범위·목표·데이터 정의", 2.0, 1, 2, "공동", "", "프로젝트정의서.md", "완료", 1, AS_OF, ""),
    ("2.3", "분석", "분석", "기능/비기능 요구 ID", 2.5, 2, 3, "공동", "", "요구사항정의서.md", "완료", 1, AS_OF, ""),
    ("2.4", "분석", "분석", "유스케이스·사용자 스토리", 2.0, 3, 3, "조찬희", "", "유스케이스사용자스토리.md", "완료", 1, AS_OF, ""),
    ("2.5", "분석", "분석", "제품 백로그·WBS", 1.5, 3, 3, "조찬희", "", "백로그WBS.md", "완료", 1, AS_OF, "본 진행표의 근거"),
    ("3.1", "설계", "설계", "스택 확정, 논리 구성도", 1.0, 4, 4, "공동", "", "아키텍처 1장", "대기", 0, None, "SFR-001, 미결 1. 주 5 말 게이트"),
    ("3.2", "설계", "설계", "용량 산정 (표본×주기×보관)", 0.5, 4, 4, "기경현", "", "구성도 부록", "대기", 0, None, "FR-SYS-002, NFR-PER-003"),
    ("3.3", "설계", "설계", "화면 IA·와이어 (6개 필수 화면)", 2.0, 4, 4, "조찬희", "", "화면설계", "대기", 0, None, "FR-MON, 요구사항 12장"),
    ("3.4", "설계", "설계", "개념·논리 ERD, 원본/제공 분리", 2.0, 4, 5, "기경현", "", "ERD", "대기", 0, None, "FR-STO-001, FR-CTL-001"),
    ("3.5", "설계", "설계", "REST API 명세서 (권한 포함)", 1.5, 5, 5, "기경현", "", "API 명세", "대기", 0, None, "IF-INT-001"),
    ("3.6", "설계", "설계", "검증 규칙 명세서 (R01–R12)", 1.5, 5, 5, "기경현", "", "규칙 명세", "대기", 0, None, "FR-VAL, 미결 6"),
    ("3.7", "설계", "설계", "클릭 가능한 프로토타입 (핵심 3화면)", 1.5, 5, 5, "조찬희", "", "프로토타입", "대기", 0, None, "용량 초과 시 정적 와이어로 축소"),
    ("3.8", "설계", "설계", "설계 리뷰·미결 1~7 확정", 1.0, 5, 5, "공동", "", "리뷰 기록", "대기", 0, None, "요구사항 13장. S1 시작 조건"),
    ("4.1.1", "구현", "4.1 기반 환경", "저장소·실행 환경", 1.0, 6, 6, "기경현", "EN-ENV-01", "README 기동 절차", "대기", 0, None, "S1"),
    ("4.1.2", "구현", "4.1 기반 환경", "스키마·마이그레이션", 2.0, 6, 6, "기경현", "EN-DB-01", "원본/제공/계획/이슈 테이블", "대기", 0, None, "S1 · 설계 ERD 선행"),
    ("4.1.3", "구현", "4.1 기반 환경", "API 골격·인증 미들웨어", 1.0, 6, 6, "기경현", "EN-API-01", "헬스체크, 401/403", "대기", 0, None, "S1"),
    ("4.1.4", "구현", "4.1 기반 환경", "시드 계정·교차로·계획", 1.0, 6, 6, "기경현", "EN-SEED-01", "시연용 데이터", "대기", 0, None, "S1"),
    ("4.1.5", "구현", "4.1 기반 환경", "프론트 셸·라우팅·메뉴", 1.5, 6, 6, "조찬희", "EN-FE-01", "로그인 후 빈 대시보드 골격", "대기", 0, None, "S1"),
    ("4.1.6", "구현", "4.1 기반 환경", "로그인·RBAC 연동", 1.5, 6, 6, "공동", "US-ADM-01", "역할별 메뉴", "대기", 0, None, "S1 Must 3SP"),
    ("4.2.1", "구현", "4.2 수집", "맵 수집·인천 마스터", 1.0, 7, 7, "기경현", "US-COL-01", "교차로 마스터", "대기", 0, None, "S2"),
    ("4.2.2", "구현", "4.2 수집", "상태 배치 수집·수신 시각", 2.0, 7, 7, "기경현", "US-COL-02", "원본 수신", "대기", 0, None, "S2"),
    ("4.2.3", "구현", "4.2 수집", "센티초→초, 점등 코드 정규화", 0.5, 7, 7, "기경현", "US-COL-04", "정규화 상태", "대기", 0, None, "S2"),
    ("4.2.4", "구현", "4.2 수집", "쿼터 가드·사용량 API", 1.0, 7, 7, "기경현", "US-COL-05", "일 5,000 한도", "대기", 0, None, "S2"),
    ("4.2.5", "구현", "4.2 수집", "재시도·부분 실패 우선", 1.0, 8, 8, "기경현", "US-COL-03", "실패 큐", "대기", 0, None, "S3"),
    ("4.2.6", "구현", "4.2 수집", "수집 대상·주기 설정 UI", 1.0, 7, 7, "조찬희", "US-ADM-03", "최소 목록 추가·제외", "대기", 0, None, "S2. 화면은 S6에서 다듬을 수 있음"),
    ("4.3.1", "구현", "4.3 계획", "정규화 계획 스키마·적재", 1.0, 8, 8, "기경현", "US-PLN-01", "signal_plan", "대기", 0, None, "S3"),
    ("4.3.2", "구현", "4.3 계획", "시드/수동/추정 대체", 1.0, 8, 8, "기경현", "US-PLN-03", "승인 전 계획", "대기", 0, None, "S3 · UTIC 미승인 대비"),
    ("4.3.3", "구현", "4.3 계획", "계획 조회·편집 화면", 1.5, 10, 10, "조찬희", "US-PLN-05", "계획 화면", "대기", 0, None, "S5. S3에 읽기 초안"),
    ("4.3.4", "구현", "4.3 계획", "ID 매핑 확정 UI", 1.0, 11, 11, "공동", "US-PLN-04", "매핑 테이블", "대기", 0, None, "S6 2순위. 커트 가능(시드 매핑)"),
    ("4.3.5", "구현", "4.3 계획", "UTIC 일 1회 수집", 2.0, 11, 14, "기경현", "US-PLN-02", "TOD·SIGNALMAP", "보류", 0, None, "Should. 승인 후에만 커밋. 미승인은 결함 아님"),
    ("4.4.1", "구현", "4.4 검지", "엔진 골격·설정 임계값", 2.0, 8, 8, "기경현", "US-VAL-01", "규칙 엔진", "대기", 0, None, "S3"),
    ("4.4.2", "구현", "4.4 검지", "등급 INFO~CRITICAL", 0.5, 8, 8, "기경현", "US-VAL-04", "오류 등급", "대기", 0, None, "S3"),
    ("4.4.3", "구현", "4.4 검지", "R01–R04, R07–R09, R11–R12", 2.0, 9, 9, "기경현", "US-VAL-02", "품질·일관성", "대기", 0, None, "S4. R06·R03·R08·R10 우선"),
    ("4.4.4", "구현", "4.4 검지", "계획 대조 R05, R10", 2.0, 9, 9, "기경현", "US-VAL-03", "계획 대비 상태", "대기", 0, None, "S4"),
    ("4.4.5", "구현", "4.4 검지", "자동 정보 통제·로그", 2.0, 9, 9, "기경현", "US-VAL-05", "제공 계층만 수정", "대기", 0, None, "S4 · 원본 불변"),
    ("4.4.6", "구현", "4.4 검지", "해결 불가 이슈 생성/갱신", 1.0, 10, 10, "기경현", "US-VAL-06", "이슈", "대기", 0, None, "S5"),
    ("4.4.7", "구현", "4.4 검지", "규칙 단위 테스트", 1.5, 9, 10, "기경현", "R01–R12", "정상/경계/오류", "대기", 0, None, "S4–S5"),
    ("4.5.1", "구현", "4.5 관제", "종합 대시보드 지표·차트", 2.5, 10, 10, "조찬희", "US-MON-01", "대시보드", "대기", 0, None, "S5"),
    ("4.5.2", "구현", "4.5 관제", "오류 목록·필터·배지", 1.5, 10, 10, "조찬희", "US-MON-03", "이슈 목록", "대기", 0, None, "S5"),
    ("4.5.3", "구현", "4.5 관제", "교차로 상세·타이머 UX", 2.0, 11, 11, "조찬희", "US-MON-02", "상세 화면", "대기", 0, None, "S6 1순위 시연 Must"),
    ("4.5.4", "구현", "4.5 관제", "폴링 (푸시 대체)", 0.5, 10, 11, "조찬희", "FR-MON-003-1", "주기 갱신", "대기", 0, None, "Must 대체. 푸시 없으면 폴링"),
    ("4.5.5", "구현", "4.5 관제", "웹소켓 푸시", 1.5, 11, 15, "공동", "US-MON-04", "실시간 푸시", "제외", 0, None, "Could. Must 동결 후. 미포함은 결함 아님"),
    ("4.5.6", "구현", "4.5 관제", "지도 관제", 2.0, 15, 15, "조찬희", "US-MON-05", "지도", "제외", 0, None, "Could. 15주 여유"),
    ("4.6.1", "구현", "4.6 통제", "이슈 상태 전이·이력 API/화면", 1.5, 10, 11, "공동", "US-ISS-01", "이슈 생명주기", "대기", 0, None, "S5 API 우선, 화면은 S6 가능"),
    ("4.6.2", "구현", "4.6 통제", "원본 vs 제공 병기", 1.0, 11, 11, "조찬희", "US-CTL-05", "조회 화면", "대기", 0, None, "S6 1순위 · 원본 불변 확인"),
    ("4.6.3", "구현", "4.6 통제", "제공 값 대체·제공 차단", 1.0, 11, 11, "기경현", "US-CTL-01", "정보 통제", "대기", 0, None, "S6 1순위"),
    ("4.6.4", "구현", "4.6 통제", "계획 수정 후 재검증", 1.0, 11, 11, "기경현", "US-CTL-02", "계획 통제", "대기", 0, None, "S6 1순위"),
    ("4.6.5", "구현", "4.6 통제", "현장 통제 요청 기록", 1.0, 11, 11, "기경현", "US-CTL-03", "요청 이력(실전송 없음)", "대기", 0, None, "S6 1순위"),
    ("4.6.6", "구현", "4.6 통제", "감시 제외", 0.5, 11, 12, "기경현", "US-CTL-04", "유지보수 제외", "보류", 0, None, "Should. S6 여유 또는 S-T1 전"),
    ("4.7.1", "구현", "4.7 통계", "시간/일/주/월 집계 배치", 1.5, 11, 11, "기경현", "US-RPT-01", "집계 테이블", "대기", 0, None, "S6 2순위"),
    ("4.7.2", "구현", "4.7 통계", "통계 화면", 1.0, 11, 11, "조찬희", "US-RPT-01", "통계 UI", "대기", 0, None, "S6 2순위"),
    ("4.7.3", "구현", "4.7 통계", "CSV 내보내기", 0.5, 11, 11, "조찬희", "US-RPT-02", "CSV", "대기", 0, None, "S6 3순위 커트 가능"),
    ("4.8.1", "구현", "4.8 계정·설정", "계정 CRUD 화면", 0.5, 11, 11, "조찬희", "US-ADM-02", "계정 관리", "대기", 0, None, "S6 3순위. 시드 2개로 시연 가능"),
    ("4.8.2", "구현", "4.8 계정·설정", "임계값 설정 화면", 0.5, 11, 11, "조찬희", "US-ADM-04", "규칙 설정", "대기", 0, None, "S6 2순위"),
    ("4.8.3", "구현", "4.8 계정·설정", "쿼터 사용량 표시", 0.5, 7, 7, "조찬희", "US-COL-05", "설정 화면 숫자", "대기", 0, None, "S2"),
    ("5.1", "테스트", "시험", "테스트 계획·케이스 (UC/US/FR)", 1.5, 12, 12, "조찬희", "", "테스트 계획서", "대기", 0, None, "S-T1"),
    ("5.2", "테스트", "시험", "규칙 단위·경계값", 1.5, 12, 12, "기경현", "", "규칙 결과", "대기", 0, None, "원본 불변·R06 0건 포함"),
    ("5.3", "테스트", "시험", "API·권한(403)·원본 불변", 1.5, 12, 12, "기경현", "", "API 결과", "대기", 0, None, ""),
    ("5.4", "테스트", "시험", "E2E (시나리오 5.1~5.4)", 1.5, 12, 13, "조찬희", "", "E2E 결과", "대기", 0, None, ""),
    ("5.5", "테스트", "시험", "성능 3초 (대시보드·목록·상세·통계)", 0.5, 13, 13, "공동", "", "NFR-PER-001", "대기", 0, None, "S-T2"),
    ("5.6", "테스트", "시험", "보안 점검표 (해시, 시크릿, 입력)", 0.5, 13, 13, "기경현", "", "NFR-SEC", "대기", 0, None, ""),
    ("5.7", "테스트", "시험", "결함 등록·수정·회귀", 1.0, 13, 13, "공동", "", "결함 목록", "대기", 0, None, "치명/주요 0"),
    ("6.1", "안정화·인도", "인도", "잔여 결함·Should 여유분", 2.0, 14, 14, "공동", "", "동결 빌드", "대기", 0, None, "S-R1. 신규 Must 없음"),
    ("6.2", "안정화·인도", "인도", "사용자·운영 매뉴얼, 복구 절차", 1.5, 14, 14, "조찬희", "", "매뉴얼", "대기", 0, None, ""),
    ("6.3", "안정화·인도", "인도", "설치 가이드 (시드·키·기동)", 1.0, 14, 14, "기경현", "", "설치 가이드", "대기", 0, None, ""),
    ("6.4", "안정화·인도", "인도", "시연 스크립트 (5.1~5.4)", 1.0, 15, 15, "조찬희", "", "시연 대본", "대기", 0, None, "S-R2"),
    ("6.5", "안정화·인도", "인도", "완료 보고·발표 자료", 1.5, 15, 15, "조찬희", "", "발표", "대기", 0, None, ""),
    ("6.6", "안정화·인도", "인도", "재설치 검증", 0.5, 15, 15, "기경현", "", "점검", "대기", 0, None, "M7 통과 조건"),
]

BACKLOG = [
    # p, id, kind, epic, name, sp, sprint, owner, sub, pred, status, pct, note
    (1, "EN-ENV-01", "EN", "기반", "Git 저장소, 브랜치 규칙, 로컬/Docker 기동", 3, "S1", "기경현", "", "—", "대기", 0, "README 기동 절차"),
    (1, "EN-DB-01", "EN", "기반", "논리 엔터티 스키마·마이그레이션", 5, "S1", "기경현", "", "설계 ERD", "대기", 0, "원본/제공/계획/이슈 테이블"),
    (1, "EN-API-01", "EN", "기반", "REST 골격, 인증 미들웨어, 오류 형식", 3, "S1", "기경현", "", "EN-ENV-01", "대기", 0, "헬스체크, 401/403"),
    (1, "EN-SEED-01", "EN", "기반", "인천 표본 시드, 계획 시드, 관리자/운영자 계정", 3, "S1", "기경현", "", "EN-DB-01", "대기", 0, "시연용 데이터"),
    (1, "EN-FE-01", "EN", "기반", "앱 셸, 라우팅, 역할별 메뉴, 공통 레이아웃", 3, "S1", "조찬희", "", "EN-API-01", "대기", 0, "로그인 후 빈 대시보드 골격"),
    (10, "US-ADM-01", "Must", "E7 계정·설정", "로그인·RBAC", 3, "S1", "공동", "", "EN-API-01, EN-FE-01", "대기", 0, "운영자는 설정 메뉴 없음"),
    (20, "US-COL-01", "Must", "E1 수집", "교차로 맵 수집", 3, "S2", "기경현", "조찬희", "EN-DB-01, US-ADM-03", "대기", 0, ""),
    (21, "US-COL-02", "Must", "E1 수집", "실시간 상태 수집", 5, "S2", "기경현", "", "US-COL-01", "대기", 0, "원본 JSON 별도 저장"),
    (22, "US-COL-04", "Must", "E1 수집", "수신 정규화", 2, "S2", "기경현", "", "US-COL-02", "대기", 0, "센티초→초"),
    (23, "US-ADM-03", "Must", "E7 계정·설정", "수집 대상·주기", 3, "S2", "기경현", "조찬희", "US-ADM-01", "대기", 0, "S2 최소 UI, S6 다듬기 가능"),
    (24, "US-COL-05", "Must", "E1 수집", "쿼터 준수", 3, "S2", "기경현", "조찬희", "US-COL-02", "대기", 0, "일 5,000 · 자르지 않음"),
    (25, "US-COL-03", "Must", "E1 수집", "실패 재시도", 3, "S3", "기경현", "", "US-COL-02", "대기", 0, ""),
    (30, "US-PLN-01", "Must", "E2 계획", "정규화 계획 저장", 3, "S3", "기경현", "", "EN-DB-01", "대기", 0, ""),
    (31, "US-PLN-03", "Must", "E2 계획", "승인 전 계획 대체", 3, "S3", "기경현", "조찬희", "US-PLN-01, EN-SEED-01", "대기", 0, "시드/수동/추정"),
    (32, "US-VAL-01", "Must", "E3 검지", "설정 기반 규칙 엔진", 5, "S3", "기경현", "", "US-COL-04", "대기", 0, ""),
    (33, "US-VAL-04", "Must", "E3 검지", "오류 등급", 2, "S3", "기경현", "", "US-VAL-01", "대기", 0, "INFO~CRITICAL"),
    (40, "US-VAL-02", "Must", "E3 검지", "품질·일관성 검증", 5, "S4", "기경현", "", "US-VAL-01", "대기", 0, "R01–R04, R07–R09, R11–R12"),
    (41, "US-VAL-03", "Must", "E3 검지", "계획 대비 상태 대조", 5, "S4", "기경현", "", "US-VAL-01, US-PLN-03", "대기", 0, "R05, R10"),
    (42, "US-VAL-05", "Must", "E3 검지", "자동보정", 5, "S4", "기경현", "조찬희", "US-VAL-02", "대기", 0, "제공 계층만. 원본 불변"),
    (50, "US-VAL-06", "Must", "E3 검지", "이슈 생성", 3, "S5", "기경현", "", "US-VAL-02", "대기", 0, ""),
    (51, "US-MON-01", "Must", "E4 관제", "종합 대시보드", 5, "S5", "조찬희", "기경현", "US-VAL-04, US-VAL-05", "대기", 0, ""),
    (52, "US-MON-03", "Must", "E4 관제", "오류·이슈 목록", 3, "S5", "조찬희", "기경현", "US-VAL-06", "대기", 0, ""),
    (53, "US-ISS-01", "Must", "E5 통제", "이슈 생명주기", 3, "S5", "공동", "", "US-VAL-06", "대기", 0, "초과 1SP → 화면은 상태 변경만 / S6"),
    (60, "US-PLN-05", "Must", "E2 계획", "계획 화면", 3, "S5", "조찬희", "기경현", "US-PLN-01", "대기", 0, ""),
    (61, "US-MON-02", "Must", "E4 관제", "교차로 상세", 5, "S6", "조찬희", "기경현", "US-COL-02, US-VAL-04", "대기", 0, "S6 1순위 시연 Must"),
    (62, "US-CTL-05", "Must", "E5 통제", "원본/제공 조회", 3, "S6", "조찬희", "기경현", "US-VAL-05", "대기", 0, "S6 1순위"),
    (63, "US-CTL-01", "Must", "E5 통제", "정보 통제", 3, "S6", "기경현", "조찬희", "US-ISS-01, US-CTL-05", "대기", 0, "S6 1순위"),
    (64, "US-CTL-02", "Must", "E5 통제", "계획 통제·재검증", 3, "S6", "기경현", "조찬희", "US-PLN-05, US-ISS-01", "대기", 0, "S6 1순위"),
    (65, "US-CTL-03", "Must", "E5 통제", "현장 통제 요청", 3, "S6", "기경현", "조찬희", "US-ISS-01", "대기", 0, "S6 1순위 · 실전송 없음"),
    (66, "US-PLN-04", "Must", "E2 계획", "교차로 ID 매핑", 3, "S6", "기경현", "조찬희", "US-PLN-01", "대기", 0, "S6 2순위. 커트 6순위"),
    (70, "US-RPT-01", "Must", "E6 통계", "집계 통계", 3, "S6", "기경현", "조찬희", "US-VAL-06", "대기", 0, "S6 2순위"),
    (71, "US-RPT-02", "Must", "E6 통계", "CSV 내보내기", 2, "S6", "조찬희", "기경현", "US-RPT-01", "대기", 0, "S6 3순위 커트 5순위"),
    (72, "US-ADM-02", "Must", "E7 계정·설정", "계정 CRUD", 2, "S6", "조찬희", "기경현", "US-ADM-01", "대기", 0, "S6 3순위 커트 4순위"),
    (73, "US-ADM-04", "Must", "E7 계정·설정", "임계값 설정", 2, "S6", "조찬희", "기경현", "US-VAL-01", "대기", 0, "S6 2순위"),
    (80, "US-PLN-02", "Should", "E2 계획", "UTIC 계획 수집", 5, "조건부", "기경현", "", "승인", "보류", 0, "승인 후 S6 또는 14주. 미승인은 결함 아님"),
    (81, "US-CTL-04", "Should", "E5 통제", "감시 제외", 2, "조건부", "기경현", "조찬희", "US-ISS-01", "보류", 0, "S6 여유 또는 S-T1 전. 커트 3순위"),
    (90, "US-MON-04", "Could", "E4 관제", "실시간 푸시", 3, "버퍼", "공동", "", "Must 동결", "제외", 0, "아니면 폴링만. 커트 1순위"),
    (91, "US-MON-05", "Could", "E4 관제", "지도 관제", 5, "버퍼", "조찬희", "", "15주 여유", "제외", 0, "미포함은 결함 아님. 커트 1순위"),
]

SPRINTS = [
    # id, weeks, phase, goal, must_sp, chanhee, kyunghyun, commits, demo, status
    ("S0", "1–3", "분석", "분석 산출물 고정", None, "문서 주도", "데이터·RFP", "정의서 4종 + 백로그WBS", "범위·UC/US·본 백로그가 저장소에 있다", "완료"),
    ("S-D1", "4", "설계", "스택·IA·ERD 초안", None, "화면 IA·와이어", "아키텍처·ERD", "3.1–3.4", "스택 후보·화면 6개·ERD 초안", "대기"),
    ("S-D2", "5", "설계", "API·규칙·프로토타입, 미결 확정", None, "프로토타입 3화면", "API·규칙 명세", "3.5–3.8", "주 5 말 게이트: 스택·표본·계획 대체·푸시/지도·임계 기본값", "대기"),
    ("S1", "6", "구현", "기동·로그인", 3, "셸, 로그인 UI", "환경, DB, API, 시드", "EN-ENV/DB/API/SEED/FE, US-ADM-01", "관리자/운영자 로그인, 운영자는 설정 메뉴 없음", "대기"),
    ("S2", "7", "구현", "인천 수집이 DB에 쌓인다", 16, "대상 설정·쿼터 표시", "COL-01,02,04,05, ADM-03 API", "US-COL-01/02/04/05, US-ADM-03 (16SP)", "표본 상태가 주기적으로 쌓이고 원본이 별도 저장된다", "대기"),
    ("S3", "8", "구현", "시드 계획 + 엔진이 돈다", 16, "계획 조회 초안, 대시보드 레이아웃", "COL-03, PLN-01,03, VAL-01,04", "US-COL-03, PLN-01/03, VAL-01/04 (16SP)", "시드 계획이 붙은 교차로에서 엔진이 등급을 남긴다", "대기"),
    ("S4", "9", "구현", "규칙이 오류를 가른다", 15, "목록 목업→실데이터", "VAL-02,03,05", "US-VAL-02/03/05 (15SP)", "급변·중복·계획 불일치가 이슈 또는 보정으로 갈리고 원본은 그대로다", "대기"),
    ("S5", "10", "구현", "대시보드에서 이슈를 본다", 17, "MON-01,03, PLN-05", "VAL-06, ISS-01 API", "US-VAL-06, MON-01/03, ISS-01, PLN-05 (17SP)", "오류 수·자동보정·미처리 이슈, 목록에서 ACK. ISS UI는 축소 가능", "대기"),
    ("S6", "11", "구현", "통제·통계·설정으로 MVP 동결", 29, "상세·통제 UI·CSV", "CTL API, 집계, 매핑", "1순위 MON-02, CTL-05/01/02/03 · 2순위 RPT-01, PLN-04, ADM-04 · 3순위 커트", "관리자 차단·계획 수정·현장 요청, 운영자 거부, 원본/제공 병기. 금요일 기능 동결", "대기"),
    ("S-T1", "12", "테스트", "케이스 실행", None, "E2E·계획서", "단위·API", "5.1–5.4", "필수 스토리 테스트 착수", "대기"),
    ("S-T2", "13", "테스트", "성능·보안, 치명 0", None, "회귀", "결함", "5.5–5.7", "필수 100%, 치명/주요 0 (NFR-QUR-003)", "대기"),
    ("S-R1", "14", "안정화", "매뉴얼·설치", None, "매뉴얼", "설치 가이드", "6.1–6.3", "동결 빌드 + 재설치 절차", "대기"),
    ("S-R2", "15", "안정화", "시연·발표", None, "발표·시연 대본", "재설치 검증", "6.4–6.6", "시연 시나리오 5.1~5.4 성공", "대기"),
]

MILESTONES = [
    ("M1", 3, "분석 완료", "정의서 4종 + 백로그WBS", "완료", AS_OF, "2026-09-12 산출물 고정"),
    ("M2", 5, "설계 완료", "스택·ERD·API·규칙·화면, 미결 확정", "대기", None, "S1 시작 게이트"),
    ("M3", 7, "수집 수직 슬라이스", "실API 또는 픽스처로 원본/정규화가 쌓임", "대기", None, "S2 말"),
    ("M4", 9, "검지 데모", "R 다수 + 자동보정/이슈 분기, 원본 불변", "대기", None, "S4 말"),
    ("M5", 11, "MVP 기능 동결", "시연 Must 스토리 Done. 이후 신규 Must 없음", "대기", None, "S6 금요일"),
    ("M6", 13, "시험 완료", "필수 테스트 100%, 치명/주요 0", "대기", None, "S-T2 말"),
    ("M7", 15, "인도", "재설치·시연·발표", "대기", None, "S-R2 말"),
]

RISKS = [
    ("UTIC 미승인", "실제 TOD 없음 → 계획 대조 약화", "US-PLN-03 시드/수동. US-PLN-02 커밋 안 함", "Should로 격리", "진행중", "기경현", "현재 승인 대기"),
    ("API 쿼터·504", "수집 공백, 시연 실패", "쿼터 가드, 픽스처 시연, UI 타이머", "S2에서 픽스처 경로 유지", "대기", "기경현", "일 5,000건"),
    ("S6 용량 초과", "통제 미완, 시연 공백", "3.5 커트. 시연 Must 5개 우선", "12주 잔여 1주", "대기", "조찬희", "S6 Must ≈29SP / 용량 16"),
    ("스택 미확정", "S1 지연", "5주 게이트에서 강제 결정", "S-D2", "대기", "공동", "React/Vue, Spring/Node"),
    ("규칙 범위 과다", "S4 지연", "R06, R03, R08, R10을 먼저", "4.4.7", "대기", "기경현", ""),
    ("2인 병목 (BE)", "FE 대기", "S3부터 목업 API, 시드로 화면 진행", "EN-SEED", "대기", "공동", "S2는 BE 편중 → FE는 설정·쿼터·레이아웃"),
]

GANTT = [
    # kind, item, owner, start, end, status, note
    ("단계", "분석", "공동", 1, 3, "완료", "산출물 5종"),
    ("단계", "설계", "공동", 4, 5, "대기", "주 5 말 게이트"),
    ("단계", "구현 (S1–S6)", "공동", 6, 11, "대기", "11주 말 기능 동결"),
    ("단계", "테스트", "공동", 12, 13, "대기", "필수 100% · 치명/주요 0"),
    ("단계", "안정화·인도", "공동", 14, 15, "대기", "시연·발표"),
    ("관리", "주간 스프린트 리뷰", "조찬희", 1, 15, "진행중", "주 1회"),
    ("관리", "위험·UTIC/쿼터 추적", "조찬희", 1, 15, "진행중", ""),
    ("스프린트", "S0 분석 산출물 고정", "조찬희", 1, 3, "완료", ""),
    ("스프린트", "S-D1 스택·IA·ERD", "공동", 4, 4, "대기", ""),
    ("스프린트", "S-D2 API·규칙·프로토타입", "공동", 5, 5, "대기", ""),
    ("스프린트", "S1 기동·로그인", "공동", 6, 6, "대기", "Must 3SP"),
    ("스프린트", "S2 인천 수집", "기경현", 7, 7, "대기", "Must 16SP"),
    ("스프린트", "S3 계획+엔진", "기경현", 8, 8, "대기", "Must 16SP"),
    ("스프린트", "S4 검지 분기", "기경현", 9, 9, "대기", "Must 15SP"),
    ("스프린트", "S5 대시보드·이슈", "조찬희", 10, 10, "대기", "Must 17SP"),
    ("스프린트", "S6 통제·동결", "공동", 11, 11, "대기", "29SP → 커트"),
    ("스프린트", "S-T1 케이스 실행", "공동", 12, 12, "대기", ""),
    ("스프린트", "S-T2 성능·보안", "공동", 13, 13, "대기", ""),
    ("스프린트", "S-R1 매뉴얼·설치", "공동", 14, 14, "대기", ""),
    ("스프린트", "S-R2 시연·발표", "조찬희", 15, 15, "대기", ""),
    ("마일스톤", "M1 분석 완료", "조찬희", 3, 3, "완료", ""),
    ("마일스톤", "M2 설계 완료", "공동", 5, 5, "대기", "S1 게이트"),
    ("마일스톤", "M3 수집 슬라이스", "기경현", 7, 7, "대기", ""),
    ("마일스톤", "M4 검지 데모", "기경현", 9, 9, "대기", ""),
    ("마일스톤", "M5 MVP 기능 동결", "공동", 11, 11, "대기", ""),
    ("마일스톤", "M6 시험 완료", "공동", 13, 13, "대기", ""),
    ("마일스톤", "M7 인도", "조찬희", 15, 15, "대기", ""),
]


def week_start(n: int) -> date:
    return WEEK1 + timedelta(days=7 * (n - 1))


def week_end(n: int) -> date:
    return week_start(n) + timedelta(days=6)


def build():
    wb = Workbook()

    # ===== 사용안내 =====
    ws = wb.active
    ws.title = "사용안내"
    page(ws, "사용안내", landscape=False)
    ws.sheet_view.showGridLines = False
    widths(ws, {"A": 3, "B": 22, "C": 78, "D": 22})

    ws.merge_cells("B2:D2")
    ws["B2"] = "Signal Guard 계획·진행 표"
    ws["B2"].font = font(18, True, NAVY)
    ws.merge_cells("B3:D3")
    ws["B3"] = "실시간 교통신호 상태정보 오류검지 시스템 · 15주 수업 MVP"
    ws["B3"].font = font(11, False, MUTED)

    meta = [
        (5, "근거", "백로그WBS.md v1.0 (2026-09-12), 프로젝트정의서 12장"),
        (6, "작성", "조찬희 (기획·FE·PM), 기경현 (BE·데이터)"),
        (7, "기준일", "2026-09-12 — 분석 산출물 완료(M1). 설계(주 4) 미착수"),
        (8, "쓰는 법", "매주 리뷰에서 WBS·백로그의 상태/진행률만 고치면 대시보드·간트가 수식으로 갱신됩니다."),
    ]
    for r, k, v in meta:
        ws.cell(r, 2, k).font = font(10, True, NAVY)
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        ws.cell(r, 3, v).font = font(10)
        ws.cell(r, 2).fill = fill(PALE)
        ws.cell(r, 3).fill = fill(PALE)
        ws.cell(r, 4).fill = fill(PALE)

    ws["B10"] = "시트 구성"
    ws["B10"].font = font(12, True, NAVY)
    sheets_help = [
        ("대시보드", "전체 진척·단계별 인일·Must SP·마일스톤. 숫자 칸은 수식이므로 직접 고치지 마세요."),
        ("주차별계획", "15주 간트. 상태 열만 고치면 막대 색이 바뀝니다. 1주차 시작일은 대시보드 C8에서 바꿉니다."),
        ("WBS", "작업 패키지 단위 진행. 주간 리뷰의 주 입력 시트입니다."),
        ("제품백로그", "EN + US 33건. Must 96SP가 용량(6주×16)과 같습니다."),
        ("스프린트", "S0 ~ S-R2 목표·담당·완료 시 데모·커밋 목록."),
        ("마일스톤", "M1–M7 게이트. M1은 분석 산출물 완료로 표시했습니다."),
        ("위험", "UTIC·쿼터·S6 용량 등 버퍼와 완화."),
        ("집계", "차트·대시보드용 피벗. 편집하지 마세요."),
    ]
    headers = ["시트", "역할"]
    ws.cell(11, 2, "시트").font = font(9, True, WHITE)
    ws.cell(11, 3, "역할").font = font(9, True, WHITE)
    ws.cell(11, 2).fill = fill(NAVY)
    ws.merge_cells("C11:D11")
    ws.cell(11, 3).fill = fill(NAVY)
    ws.cell(11, 4).fill = fill(NAVY)
    for i, (name, role) in enumerate(sheets_help):
        r = 12 + i
        ws.cell(r, 2, name).font = font(10, True)
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        ws.cell(r, 3, role).font = font(10)
        ws.cell(r, 2).border = thin
        ws.cell(r, 3).border = thin
        ws.cell(r, 4).border = thin
        if i % 2 == 0:
            ws.cell(r, 2).fill = fill(PALE)
            ws.cell(r, 3).fill = fill(PALE)
            ws.cell(r, 4).fill = fill(PALE)

    ws["B22"] = "상태 값 (드롭다운)"
    ws["B22"].font = font(12, True, NAVY)
    legend = [
        ("완료", GREEN_BG, GREEN_FG, "수용 기준·산출물이 DoD를 만족. FE+BE 스토리는 둘 다 Done."),
        ("진행중", YELLOW_BG, YELLOW_FG, "이번 스프린트에서 작업 중. 진행률(0~100%)을 같이 적습니다."),
        ("대기", BLUE_BG, BLUE_FG, "아직 스프린트에 넣지 않았거나 선행이 안 끝남."),
        ("보류", ORANGE_BG, "9C5700", "Should/조건부. 승인·여유 주가 생기면 대기→진행중으로 바꿉니다."),
        ("제외", GRAY_BG, GRAY_FG, "Could 또는 커트. 대시보드 분모에서 빠집니다. 결함이 아닙니다."),
    ]
    ws.cell(23, 2, "상태").font = font(9, True, WHITE)
    ws.cell(23, 2).fill = fill(NAVY)
    ws.merge_cells("C23:D23")
    ws.cell(23, 3, "의미").font = font(9, True, WHITE)
    ws.cell(23, 3).fill = fill(NAVY)
    ws.cell(23, 4).fill = fill(NAVY)
    for i, (st, bg, fg, meaning) in enumerate(legend):
        r = 24 + i
        ws.cell(r, 2, st).font = font(10, True, fg)
        ws.cell(r, 2).fill = fill(bg)
        ws.cell(r, 2).alignment = center
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        ws.cell(r, 3, meaning).font = font(10)
        ws.cell(r, 2).border = thin
        ws.cell(r, 3).border = thin
        ws.cell(r, 4).border = thin

    ws["B31"] = "용량이 넘칠 때 자르는 순서 (위일수록 시연에 덜 치명적)"
    ws["B31"].font = font(12, True, NAVY)
    cuts = [
        "1. US-MON-05, US-MON-04 (선택 — 이미 백로그 밖 취급 가능)",
        "2. US-PLN-02 (UTIC 승인 없으면 자동 제외)",
        "3. US-CTL-04 감시 제외",
        "4. US-ADM-02 계정 CRUD (시드 계정 2개로 시연 가능)",
        "5. US-RPT-02 CSV (화면 조회만으로 발표 가능)",
        "6. US-PLN-04 ID 매핑 (시드에서 미리 매핑하면 대조 가능)",
    ]
    for i, t in enumerate(cuts):
        ws.merge_cells(start_row=32 + i, start_column=2, end_row=32 + i, end_column=4)
        ws.cell(32 + i, 2, t).font = font(10)
    ws.merge_cells("B39:D40")
    ws["B39"] = (
        "자르지 않는 것: 수집, 시드 계획, 규칙 엔진, 자동보정/이슈 분기, 대시보드, "
        "이슈 생명주기, 정보·계획 통제, 현장 요청 기록, 원본 불변, 로그인 RBAC, 쿼터."
    )
    ws["B39"].font = font(10, True, GREEN_FG)
    ws["B39"].alignment = Alignment(wrap_text=True, vertical="center")
    ws["B39"].fill = fill(GREEN_BG)

    ws.merge_cells("B42:D43")
    ws["B42"] = (
        "DoD 요약: 수용 기준 확인, FE는 API 연동, 권한 일치, 원본 수신을 덮어쓰는 경로 없음, "
        "PR 리뷰 1회 이상 메인 병합, 시크릿 없음. 분석·설계는 산출물이 저장소에 있고 팀 리뷰를 통과하면 Done."
    )
    ws["B42"].alignment = Alignment(wrap_text=True, vertical="top")
    ws["B42"].font = font(10, False, MUTED)

    # ===== 대시보드 =====
    dash = wb.create_sheet("대시보드", 0)
    page(dash, "대시보드")
    widths(dash, {c: 14 for c in "ABCDEFGHIJKLMNO"})
    dash.column_dimensions["A"].width = 3
    dash.column_dimensions["B"].width = 18
    dash.column_dimensions["C"].width = 16
    dash.column_dimensions["D"].width = 14
    dash.column_dimensions["E"].width = 14
    dash.column_dimensions["F"].width = 14
    dash.column_dimensions["G"].width = 14
    dash.column_dimensions["H"].width = 16
    dash.column_dimensions["I"].width = 16
    dash.column_dimensions["J"].width = 18

    dash.merge_cells("B2:J2")
    dash["B2"] = "Signal Guard 계획·진행 대시보드"
    dash["B2"].font = font(18, True, NAVY)
    dash.merge_cells("B3:J3")
    dash["B3"] = "출처: 백로그WBS.md v1.0 · 분석 10인일 완료 · 구현 Must 96SP = 6주 × 16SP"
    dash["B3"].font = font(10, False, MUTED)

    labels = [
        (5, "프로젝트", "실시간 교통신호 상태정보 오류검지 시스템"),
        (6, "팀", "조찬희 (기획·FE·PM)  /  기경현 (BE·데이터)"),
        (7, "기준일", AS_OF),
        (8, "1주차 시작일", WEEK1),
        (9, "현재 주차", '=MAX(1,MIN(15,INT((C7-C8)/7)+1))'),
        (10, "현재 단계", '=IF(C9<=3,"분석 (S0)",IF(C9<=5,"설계 (S-D1/D2)",IF(C9<=11,"구현 (S1–S6)",IF(C9<=13,"테스트 (S-T)","안정화 (S-R)"))))'),
    ]
    for r, k, v in labels:
        dash.cell(r, 2, k).font = font(9, True, WHITE)
        dash.cell(r, 2).fill = fill(NAVY)
        dash.cell(r, 2).alignment = center
        dash.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
        cell = dash.cell(r, 3, v)
        cell.font = font(11, True)
        cell.alignment = left_al
        for col in range(3, 6):
            dash.cell(r, col).fill = fill(PALE)
            dash.cell(r, col).border = thin
        dash.cell(r, 2).border = thin
    dash["C7"].number_format = "YYYY-MM-DD"
    dash["C8"].number_format = "YYYY-MM-DD"
    dash["C8"].fill = fill(YELLOW_BG)
    dash["C8"].font = font(11, True, YELLOW_FG)
    dash.merge_cells("F8:J8")
    dash["F8"] = "노란 칸만 수정 → 현재 주차·간트 날짜가 따라갑니다."
    dash["F8"].font = font(9, False, YELLOW_FG)

    # KPI row titles
    dash["B12"] = "핵심 지표 (수식 · WBS/백로그와 연동)"
    dash["B12"].font = font(12, True, NAVY)
    dash.merge_cells("B12:J12")

    kpi_headers = ["전체 인일 진척", "분석", "설계", "구현(제외 제외)", "테스트", "인도", "Must SP", "Must 완료"]
    for i, h in enumerate(kpi_headers):
        c = dash.cell(13, 3 + i, h)
        c.font = font(8, True, WHITE)
        c.fill = fill(NAVY2)
        c.alignment = center
        c.border = thin
    dash.cell(13, 2, "").fill = fill(NAVY2)

    # C14 overall = 집계! weighted
    kpis = [
        (2, "진척률", "=집계!C21", "0%"),
        (3, "값", '=TEXT(집계!B15,"0.0")&" / "&TEXT(집계!B14,"0.0")&"인일"', "@"),
    ]
    dash.cell(14, 2, "진척").font = font(9, True, WHITE)
    dash.cell(14, 2).fill = fill(NAVY)
    dash.cell(14, 2).alignment = center
    dash.cell(14, 2).border = thin

    formulas = [
        ("C14", "=집계!C21"),  # overall pct
        ("D14", "=집계!C10"),  # 분석
        ("E14", "=집계!C11"),  # 설계
        ("F14", "=집계!C12"),  # 구현
        ("G14", "=집계!C13"),  # 테스트
        ("H14", "=집계!C14"),  # 인도 — wait 집계 rows need careful design
        ("I14", '=집계!E8'),   # must sp done / total later
        ("J14", '=집계!E7'),
    ]
    # I'll design 집계 sheet first in mind:
    # Row 8: phase table starting row 8
    # Let me fix KPI to point at well-defined 집계 cells after I write 집계.

    dash.row_dimensions[14].height = 28
    dash.row_dimensions[15].height = 18

    # Placeholder cells — filled after 집계 layout is known. Using explicit 집계 refs:
    # 집계 layout:
    # A8:L8 headers for phases
    # A9:L14 six phases
    # A16 Must SP total, B16 done, C16 pct
    # A18 overall days planned, B18 earned, C18 pct
    refs = {
        "C14": "=집계!C20",  # overall
        "D14": "=집계!C9",
        "E14": "=집계!C10",
        "F14": "=집계!C11",
        "G14": "=집계!C12",
        "H14": "=집계!C13",
        "I14": "=집계!C16",  # must pct
        "J14": '=TEXT(집계!B16,"0")&" / "&TEXT(집계!A16,"0")&" SP"',
    }
    for addr, fml in refs.items():
        dash[addr] = fml
        dash[addr].font = font(14, True, NAVY)
        dash[addr].alignment = center
        dash[addr].border = thin
        dash[addr].fill = fill("EAF1F8")
    for addr in ("C14", "D14", "E14", "F14", "G14", "H14", "I14"):
        dash[addr].number_format = "0%"

    dash["C15"] = '=TEXT(집계!B20,"0.0")&" / "&TEXT(집계!A20,"0.0")&"인일"'
    dash["D15"] = '=TEXT(집계!B9,"0.0")&"/"&TEXT(집계!A9,"0.0")'
    dash["E15"] = '=TEXT(집계!B10,"0.0")&"/"&TEXT(집계!A10,"0.0")'
    dash["F15"] = '=TEXT(집계!B11,"0.0")&"/"&TEXT(집계!A11,"0.0")'
    dash["G15"] = '=TEXT(집계!B12,"0.0")&"/"&TEXT(집계!A12,"0.0")'
    dash["H15"] = '=TEXT(집계!B13,"0.0")&"/"&TEXT(집계!A13,"0.0")'
    dash["I15"] = "Must 완료율"
    dash["J15"] = "완료 SP / 계획 SP"
    for col in range(3, 11):
        dash.cell(15, col).font = font(8, False, MUTED)
        dash.cell(15, col).alignment = center
        dash.cell(15, col).border = thin

    dash["B17"] = "단계별 인일 (계획 vs 획득)"
    dash["B17"].font = font(12, True, NAVY)
    dash.merge_cells("B17:E17")
    dash["G17"] = "구현 스프린트 Must SP"
    dash["G17"].font = font(12, True, NAVY)
    dash.merge_cells("G17:J17")

    dash["B19"] = "이번 주 초점"
    dash["B19"].font = font(12, True, NAVY)
    dash.merge_cells("B20:J22")
    dash["B20"] = (
        '=IF(C9<=3,'
        '"분석 산출물은 완료(M1)입니다. 남은 분석 주가 있으면 미결 목록만 정리하고, 주 4 설계 게이트(스택·표본 수·계획 대체·임계 기본값) 안건을 미리 적으세요.",'
        'IF(C9=4,"S-D1: 스택·화면 IA 6개·ERD 초안. 조찬희=와이어, 기경현=아키텍처·용량.",'
        'IF(C9=5,"S-D2 게이트: API·규칙 R01–R12·프로토타입 3화면. 미결 1~7을 닫아야 S1을 시작합니다.",'
        'IF(C9=6,"S1 데모: 관리자/운영자 로그인, 운영자는 설정 메뉴 없음. EN 기반+US-ADM-01.",'
        'IF(C9=7,"S2 데모: 인천 표본 상태가 쌓이고 쿼터 숫자가 보이며 원본이 별도 저장된다.",'
        'IF(C9=8,"S3 데모: 시드 계획이 붙은 교차로에서 엔진이 등급을 남긴다.",'
        'IF(C9=9,"S4 데모: 급변·중복·계획 불일치가 이슈/보정으로 갈리고 원본은 그대로다.",'
        'IF(C9=10,"S5 데모: 대시보드에 오류 수·자동보정·미처리 이슈, 목록에서 ACK.",'
        'IF(C9=11,"S6 통합+커트. 시연 Must(상세·정보/계획 통제·현장 요청·원본 병기)를 남기고 금요일 기능 동결.",'
        'IF(C9=12,"S-T1: 테스트 계획·규칙 단위·API 권한·원본 불변·E2E 착수.",'
        'IF(C9=13,"S-T2: 성능 3초·보안 점검·치명/주요 0. M6 게이트.",'
        'IF(C9=14,"S-R1: 잔여 결함, 매뉴얼, 설치 가이드. 신규 Must 없음.",'
        '"S-R2: 시연 대본 5.1~5.4, 발표, 재설치 검증. M7 인도."))))))))))))'
    )
    dash["B20"].alignment = Alignment(wrap_text=True, vertical="top")
    dash["B20"].font = font(11)
    dash["B20"].fill = fill(TEAL_BG)
    for col in range(2, 11):
        dash.cell(20, col).fill = fill(TEAL_BG)
        dash.cell(20, col).border = thin
        dash.cell(21, col).fill = fill(TEAL_BG)
        dash.cell(21, col).border = thin
        dash.cell(22, col).fill = fill(TEAL_BG)
        dash.cell(22, col).border = thin

    dash["B24"] = "마일스톤"
    dash["B24"].font = font(12, True, NAVY)
    mh = ["ID", "주", "이름", "통과 조건", "상태", "실적일"]
    for i, h in enumerate(mh):
        c = dash.cell(25, 2 + i, h)
        c.font = font(9, True, WHITE)
        c.fill = fill(NAVY)
        c.alignment = center
        c.border = thin
    for i in range(7):
        r = 26 + i
        dash.cell(r, 2, f"=마일스톤!A{i+2}")
        dash.cell(r, 3, f"=마일스톤!B{i+2}")
        dash.cell(r, 4, f"=마일스톤!C{i+2}")
        dash.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
        dash.cell(r, 5, f"=마일스톤!D{i+2}")
        dash.cell(r, 7, f"=마일스톤!E{i+2}")
        dash.cell(r, 8, f"=마일스톤!F{i+2}")
        dash.cell(r, 8).number_format = "YYYY-MM-DD"
        for col in range(2, 9):
            dash.cell(r, col).font = font(9)
            dash.cell(r, col).alignment = center if col != 5 else left_al
            dash.cell(r, col).border = thin
            if i % 2 == 0:
                dash.cell(r, col).fill = fill(PALE)
    status_cf(dash, "G", 26, 32)
    dash.merge_cells("I25:J32")
    dash["I25"] = (
        "용량 메모\n"
        "· 분석 12 / 설계 8 / 구현 36 / 테스트 8 / 안정화 8 ≈ 72인일\n"
        "· 구현 속도 16 SP/주 × 6주 = 96 SP (Must와 동일)\n"
        "· S5는 17SP(1점 초과) → ISS 화면 축소\n"
        "· S6는 29SP → 통합+커트. 시연 Must 5개는 남김\n"
        "· US-PLN-02는 승인 전 커밋하지 않음"
    )
    dash["I25"].alignment = Alignment(wrap_text=True, vertical="top")
    dash["I25"].font = font(9, False, MUTED)

    dash["B34"] = "역할별 구현 주 부하 (백로그 주 담당 기준, Must+EN)"
    dash["B34"].font = font(12, True, NAVY)
    dash.merge_cells("B34:J34")

    # charts will be added after 집계 exists
    dash["B46"] = "주간 갱신 체크"
    dash["B46"].font = font(12, True, NAVY)
    checks = [
        "WBS에서 이번 주 패키지 상태를 진행중/완료로 바꾼다",
        "제품백로그에서 닫은 US/EN을 완료로 바꾸고 진행률 100%를 넣는다",
        "스프린트 시트의 실제완료SP와 상태를 맞춘다",
        "마일스톤 게이트를 통과했으면 상태와 실적일을 적는다",
        "위험 시트에 UTIC 승인·쿼터 소진을 한 줄 갱신한다",
        "대시보드 현재 주차·진척률이 직관과 맞는지 확인한다",
    ]
    for i, t in enumerate(checks):
        dash.cell(47 + i, 2, "□")
        dash.cell(47 + i, 2).font = font(12, True, NAVY)
        dash.cell(47 + i, 2).alignment = center
        dash.merge_cells(start_row=47 + i, start_column=3, end_row=47 + i, end_column=8)
        dash.cell(47 + i, 3, t).font = font(10)

    dash["B19"].font = font(12, True, NAVY)

    # ===== WBS =====
    wbs = wb.create_sheet("WBS")
    page(wbs, "WBS")
    wbs_headers = [
        "WBS ID", "단계", "분류", "패키지", "인일", "시작주", "종료주",
        "담당", "백로그", "산출물", "상태", "진행률", "실적종료", "비고",
    ]
    header_row(wbs, 1, wbs_headers)
    wbs.freeze_panes = "A2"
    wbs.auto_filter.ref = f"A1:N{len(WBS)+1}"
    widths(wbs, {
        "A": 10, "B": 14, "C": 16, "D": 32, "E": 8, "F": 8, "G": 8,
        "H": 10, "I": 14, "J": 26, "K": 10, "L": 10, "M": 12, "N": 42,
    })
    wbs.row_dimensions[1].height = 24
    for i, row in enumerate(WBS, 2):
        (wid, phase, group, name, days, ws_, we, owner, bl, out, st, pct, end, note) = row
        vals = [wid, phase, group, name, days, ws_, we, owner, bl, out, st, pct, end, note]
        for col, v in enumerate(vals, 1):
            cell = wbs.cell(i, col, v)
            cell.font = font(9)
            cell.border = thin
            cell.alignment = center if col not in (4, 10, 14) else left_al
        wbs.cell(i, 5).number_format = "0.0"
        wbs.cell(i, 12).number_format = "0%"
        wbs.cell(i, 13).number_format = "YYYY-MM-DD"
        if st == "완료":
            wbs.cell(i, 11).fill = fill(GREEN_BG)
        elif st == "진행중":
            wbs.cell(i, 11).fill = fill(YELLOW_BG)
        elif st == "제외":
            wbs.cell(i, 11).fill = fill(GRAY_BG)
        elif st == "보류":
            wbs.cell(i, 11).fill = fill(ORANGE_BG)
        wbs.row_dimensions[i].height = 18
    last_wbs = 1 + len(WBS)
    add_table(wbs, "WBSTable", f"A1:N{last_wbs}")
    dv_status(wbs, f"K2:K{last_wbs}")
    dv_pct(wbs, f"L2:L{last_wbs}")
    status_cf(wbs, "K", 2, last_wbs)
    pct_cf(wbs, "L", 2, last_wbs)
    wbs.auto_filter.ref = f"A1:N{last_wbs}"

    # ===== 백로그 =====
    bl = wb.create_sheet("제품백로그")
    page(bl, "제품백로그")
    bl_headers = [
        "P", "ID", "구분", "에픽", "항목", "SP", "목표스프린트",
        "주담당", "부담당", "선행", "상태", "진행률", "비고",
    ]
    header_row(bl, 1, bl_headers)
    bl.freeze_panes = "A2"
    widths(bl, {
        "A": 6, "B": 14, "C": 10, "D": 16, "E": 34, "F": 6, "G": 12,
        "H": 10, "I": 10, "J": 28, "K": 10, "L": 10, "M": 40,
    })
    for i, row in enumerate(BACKLOG, 2):
        for col, v in enumerate(row, 1):
            cell = bl.cell(i, col, v)
            cell.font = font(9)
            cell.border = thin
            cell.alignment = center if col not in (5, 10, 13) else left_al
        bl.cell(i, 12).number_format = "0%"
        kind = row[2]
        if kind == "Must":
            bl.cell(i, 3).fill = fill("E2EFDA")
        elif kind == "Should":
            bl.cell(i, 3).fill = fill(YELLOW_BG)
        elif kind == "Could":
            bl.cell(i, 3).fill = fill(GRAY_BG)
        elif kind == "EN":
            bl.cell(i, 3).fill = fill(BLUE_BG)
        bl.row_dimensions[i].height = 18
    last_bl = 1 + len(BACKLOG)
    add_table(bl, "BacklogTable", f"A1:M{last_bl}")
    dv_status(bl, f"K2:K{last_bl}")
    dv_pct(bl, f"L2:L{last_bl}")
    status_cf(bl, "K", 2, last_bl)
    pct_cf(bl, "L", 2, last_bl)
    bl.auto_filter.ref = f"A1:M{last_bl}"

    # ===== 스프린트 =====
    sp = wb.create_sheet("스프린트")
    page(sp, "스프린트")
    sp_headers = [
        "스프린트", "주차", "단계", "목표", "Must SP", "조찬희", "기경현",
        "커밋 항목", "완료 시 데모", "상태", "실제완료SP",
    ]
    header_row(sp, 1, sp_headers)
    sp.freeze_panes = "A2"
    widths(sp, {
        "A": 12, "B": 8, "C": 10, "D": 28, "E": 10, "F": 24, "G": 28,
        "H": 42, "I": 44, "J": 10, "K": 12,
    })
    for i, row in enumerate(SPRINTS, 2):
        for col, v in enumerate(row, 1):
            cell = sp.cell(i, col, v)
            cell.font = font(9)
            cell.border = thin
            cell.alignment = left_al if col in (4, 6, 7, 8, 9) else center
        sp.row_dimensions[i].height = 36
        if row[0] in ("S1", "S2", "S3", "S4", "S5", "S6"):
            sp.cell(i, 1).font = font(9, True, NAVY)
        if row[-1] == "완료":
            sp.cell(i, 10).fill = fill(GREEN_BG)
    last_sp = 1 + len(SPRINTS)
    # actual SP formula for impl sprints from backlog
    for i, row in enumerate(SPRINTS, 2):
        sid = row[0]
        sp.cell(i, 11, f'=SUMIFS(제품백로그!F:F,제품백로그!G:G,A{i},제품백로그!K:K,"완료")')
        sp.cell(i, 11).number_format = "0"
        sp.cell(i, 11).font = font(9)
        sp.cell(i, 11).alignment = center
        sp.cell(i, 11).border = thin
    add_table(sp, "SprintTable", f"A1:K{last_sp}")
    dv_status(sp, f"J2:J{last_sp}")
    status_cf(sp, "J", 2, last_sp)
    sp.auto_filter.ref = f"A1:K{last_sp}"

    # ===== 마일스톤 =====
    ms = wb.create_sheet("마일스톤")
    page(ms, "마일스톤", landscape=False)
    ms_headers = ["ID", "주차", "이름", "통과 조건", "상태", "실적일", "비고"]
    header_row(ms, 1, ms_headers)
    ms.freeze_panes = "A2"
    widths(ms, {"A": 8, "B": 8, "C": 20, "D": 48, "E": 10, "F": 14, "G": 28})
    for i, row in enumerate(MILESTONES, 2):
        for col, v in enumerate(row, 1):
            cell = ms.cell(i, col, v)
            cell.font = font(9)
            cell.border = thin
            cell.alignment = left_al if col in (3, 4, 7) else center
        ms.cell(i, 6).number_format = "YYYY-MM-DD"
        ms.row_dimensions[i].height = 22
    last_ms = 1 + len(MILESTONES)
    add_table(ms, "MilestoneTable", f"A1:G{last_ms}")
    dv_status(ms, f"E2:E{last_ms}")
    status_cf(ms, "E", 2, last_ms)
    ms.auto_filter.ref = f"A1:G{last_ms}"

    # ===== 위험 =====
    rk = wb.create_sheet("위험")
    page(rk, "위험")
    rk_headers = ["위험", "영향", "완화", "버퍼", "상태", "담당", "비고"]
    header_row(rk, 1, rk_headers)
    rk.freeze_panes = "A2"
    widths(rk, {"A": 18, "B": 28, "C": 40, "D": 22, "E": 10, "F": 10, "G": 28})
    for i, row in enumerate(RISKS, 2):
        for col, v in enumerate(row, 1):
            cell = rk.cell(i, col, v)
            cell.font = font(9)
            cell.border = thin
            cell.alignment = left_al if col <= 4 or col == 7 else center
        rk.row_dimensions[i].height = 32
    last_rk = 1 + len(RISKS)
    add_table(rk, "RiskTable", f"A1:G{last_rk}")
    dv_status(rk, f"E2:E{last_rk}")
    status_cf(rk, "E", 2, last_rk)
    rk.auto_filter.ref = f"A1:G{last_rk}"

    # ===== 주차별계획 Gantt =====
    gt = wb.create_sheet("주차별계획", 1)
    page(gt, "주차별계획")
    gt_headers = ["구분", "항목", "담당", "시작주", "종료주", "상태", "비고"] + [f"W{n}" for n in range(1, 16)]
    header_row(gt, 1, gt_headers)
    # date subheader row 2
    gt.cell(2, 1, "계획 기간")
    gt.cell(2, 1).font = font(8, True, WHITE)
    gt.cell(2, 1).fill = fill(NAVY2)
    gt.merge_cells("A2:G2")
    for col in range(1, 8):
        gt.cell(2, col).fill = fill(NAVY2)
        gt.cell(2, col).border = thin
        gt.cell(2, col).font = font(8, True, WHITE)
    for n in range(1, 16):
        cell = gt.cell(2, 7 + n)
        cell.value = f'=대시보드!$C$8+7*({n}-1)'
        cell.number_format = "M/D"
        cell.font = font(8, False, WHITE)
        cell.fill = fill(NAVY2)
        cell.alignment = center
        cell.border = thin
    gt.freeze_panes = "H3"
    widths(gt, {"A": 12, "B": 26, "C": 10, "D": 8, "E": 8, "F": 10, "G": 28})
    for n in range(1, 16):
        gt.column_dimensions[get_column_letter(7 + n)].width = 4.6

    for i, row in enumerate(GANTT, 3):
        kind, item, owner, start, end, st, note = row
        vals = [kind, item, owner, start, end, st, note]
        for col, v in enumerate(vals, 1):
            cell = gt.cell(i, col, v)
            cell.font = font(9, True if kind == "단계" else False)
            cell.border = thin
            cell.alignment = left_al if col in (2, 7) else center
        if kind == "단계":
            for col in range(1, 8):
                gt.cell(i, col).fill = fill("EAF1F8")
        if kind == "마일스톤":
            gt.cell(i, 2).font = font(9, True, NAVY)
        for n in range(1, 16):
            col = 7 + n
            # mark if week in [start, end]
            cell = gt.cell(i, col)
            cell.value = f'=IF(AND({get_column_letter(col)}$1>={get_column_letter(4)}{i},{get_column_letter(col)}$1<={get_column_letter(5)}{i}),IF($F{i}="완료","●",IF($F{i}="진행중","▶",IF($F{i}="제외","·","■"))),"")'
            cell.alignment = center
            cell.font = font(8)
            cell.border = thin
        gt.row_dimensions[i].height = 18
    last_gt = 2 + len(GANTT)
    # week number row is row 1 cols H-V. Formulas in row 3+ refer to row 1 which has W1..W15 text not numbers.
    # Fix: put numeric week in row 1 for H-V, labels as W1... actually header_row wrote W1..W15.
    # Gantt formula uses H$1 as week number — so overwrite H1:V1 with 1..15 and put W labels in a comment? 
    # Better: use columns D/E start/end compared to COLUMN()-7
    for i in range(3, 3 + len(GANTT)):
        for n in range(1, 16):
            col = 7 + n
            cell = gt.cell(i, col)
            cell.value = f'=IF(AND({n}>=$D{i},{n}<=$E{i}),IF($F{i}="완료","●",IF($F{i}="진행중","▶",IF($F{i}="제외",".",IF($F{i}="보류","◇","■")))),"")'

    # color gantt by status via formula CF on H3:V
    gantt_range = f"H3:V{2 + len(GANTT)}"
    gt.conditional_formatting.add(
        gantt_range,
        FormulaRule(formula=['AND(H3="●",TRUE)'], fill=fill(GREEN_BG), font=font(8, True, GREEN_FG)),
    )
    gt.conditional_formatting.add(
        gantt_range,
        FormulaRule(formula=['AND(H3="▶",TRUE)'], fill=fill(YELLOW_BG), font=font(8, True, YELLOW_FG)),
    )
    gt.conditional_formatting.add(
        gantt_range,
        FormulaRule(formula=['AND(H3="■",TRUE)'], fill=fill(BLUE_BG), font=font(8, True, BLUE_FG)),
    )
    gt.conditional_formatting.add(
        gantt_range,
        FormulaRule(formula=['AND(H3="◇",TRUE)'], fill=fill(ORANGE_BG), font=font(8, True, "9C5700")),
    )
    gt.conditional_formatting.add(
        gantt_range,
        FormulaRule(formula=['AND(H3=".",TRUE)'], fill=fill(GRAY_BG), font=font(8, False, GRAY_FG)),
    )
    # highlight current week column using dashboard C9 — applied on header row 1
    for n in range(1, 16):
        col = get_column_letter(7 + n)
        gt.conditional_formatting.add(
            f"{col}1:{col}{2 + len(GANTT)}",
            FormulaRule(formula=[f"{col}$1=대시보드!$C$9"], fill=fill("FFF4CC")),
        )
    # Wait, W1 header is text "W1" so current-week CF on row1 won't match C9 number.
    # Put week numbers in row 1 for H-V instead of W1.. and keep title in row 2 dates.
    for n in range(1, 16):
        cell = gt.cell(1, 7 + n, n)
        cell.font = font(9, True, WHITE)
        cell.fill = fill(NAVY)
        cell.alignment = center
        cell.border = thin
        cell.number_format = '"W"0'

    dv_status(gt, f"F3:F{2 + len(GANTT)}")
    status_cf(gt, "F", 3, 2 + len(GANTT))
    gt.auto_filter.ref = f"A1:G{2 + len(GANTT)}"
    gt.row_dimensions[1].height = 20
    gt.row_dimensions[2].height = 18

    gt.merge_cells(f"A{3+len(GANTT)+1}:V{3+len(GANTT)+1}")
    legend_row = 3 + len(GANTT) + 1
    gt.cell(legend_row, 1, "범례  ● 완료   ▶ 진행중   ■ 계획(대기)   ◇ 보류   · 제외    |  노란 세로띠 = 대시보드의 현재 주차.  상태(F열)만 바꾸면 막대가 바뀝니다.")
    gt.cell(legend_row, 1).font = font(9, False, MUTED)

    # ===== 집계 (hidden-ish, keep visible but last) =====
    agg = wb.create_sheet("집계")
    page(agg, "집계")
    widths(agg, {"A": 16, "B": 14, "C": 12, "D": 14, "E": 14, "F": 12, "G": 12, "H": 14})
    agg["A1"] = "집계 (대시보드·차트 원본). 직접 편집하지 말고 WBS/백로그 상태를 바꾸세요."
    agg["A1"].font = font(10, True, MUTED)
    agg.merge_cells("A1:H1")

    agg["A3"] = "단계별 인일"
    agg["A3"].font = font(11, True, NAVY)
    for i, h in enumerate(["단계", "계획인일", "획득인일", "진척률", "완료건", "전체건"], 1):
        c = agg.cell(8, i, h)
        c.font = font(9, True, WHITE)
        c.fill = fill(NAVY)
        c.alignment = center
        c.border = thin

    phases = ["프로젝트 관리", "분석", "설계", "구현", "테스트", "안정화·인도"]
    # rows 9-14
    for i, ph in enumerate(phases):
        r = 9 + i
        agg.cell(r, 1, ph).font = font(9)
        agg.cell(r, 1).border = thin
        # planned days excluding 제외
        agg.cell(r, 2, f'=SUMIFS(WBS!E:E,WBS!B:B,A{r},WBS!K:K,"<>제외")')
        # earned = 완료 days + 진행중*pct
        agg.cell(
            r,
            3,
            f'=SUMIFS(WBS!E:E,WBS!B:B,A{r},WBS!K:K,"완료")'
            f'+SUMPRODUCT((WBS!$B$2:$B$200=A{r})*(WBS!$K$2:$K$200="진행중")*(WBS!$E$2:$E$200)*(WBS!$L$2:$L$200))',
        )
        agg.cell(r, 4, f'=IF(A{r}="","",IF(B{r}=0,0,C{r}/B{r}))')
        agg.cell(r, 5, f'=COUNTIFS(WBS!B:B,A{r},WBS!K:K,"완료")')
        agg.cell(r, 6, f'=COUNTIFS(WBS!B:B,A{r},WBS!K:K,"<>제외")')
        for col in range(1, 7):
            agg.cell(r, col).border = thin
            agg.cell(r, col).font = font(9)
            agg.cell(r, col).alignment = center if col > 1 else left_al
        agg.cell(r, 2).number_format = "0.0"
        agg.cell(r, 3).number_format = "0.0"
        agg.cell(r, 4).number_format = "0%"

    # Map dashboard D14..H14 to 분석,설계,구현,테스트,인도 = rows 10,11,12,13,14
    # C9 in 집계 is 프로젝트 관리 pct — dashboard D14 should be 분석 = C10
    # I already set:
    # D14=C9 that's WRONG if C9 is 프로젝트 관리
    # Fix dashboard refs:
    # D14 분석 = 집계!C10? Wait 집계 column C is 획득인일, D is 진척률
    # I used C9 as pct but C is earned days. BUG.
    # Dashboard should use column D (진척률):
    # D14 분석 = 집계!D10
    # Let me fix dashboard KPI refs after this.

    # Overall row 20: A20 planned, B20 earned, C20 pct
    agg["A16"] = '=SUMIF(제품백로그!C:C,"Must",제품백로그!F:F)'  # must sp total
    agg["B16"] = '=SUMIFS(제품백로그!F:F,제품백로그!C:C,"Must",제품백로그!K:K,"완료")+SUMPRODUCT((제품백로그!$C$2:$C$80="Must")*(제품백로그!$K$2:$K$80="진행중")*(제품백로그!$F$2:$F$80)*(제품백로그!$L$2:$L$80))'
    agg["C16"] = "=IF(A16=0,0,B16/A16)"
    agg["A16"].number_format = "0"
    agg["B16"].number_format = "0.0"
    agg["C16"].number_format = "0%"
    agg["D16"] = "Must SP (계획 / 획득 / 진척)"
    agg["D16"].font = font(9, False, MUTED)

    agg["A18"] = "EN SP 합(참고, 속도에 흡수)"
    agg["B18"] = '=SUMIF(제품백로그!C:C,"EN",제품백로그!F:F)'
    agg["C18"] = '=SUMIFS(제품백로그!F:F,제품백로그!C:C,"EN",제품백로그!K:K,"완료")'

    agg["A20"] = "=SUM(B9:B14)"
    agg["B20"] = "=SUM(C9:C14)"
    agg["C20"] = "=IF(A20=0,0,B20/A20)"
    agg["D20"] = "전체 인일"
    for addr in ("A20", "B20"):
        agg[addr].number_format = "0.0"
    agg["C20"].number_format = "0%"
    agg["A20"].font = font(11, True, NAVY)
    agg["B20"].font = font(11, True, NAVY)
    agg["C20"].font = font(11, True, NAVY)

    # Sprint SP plan for chart — from sprint sheet E column, impl only
    agg["A23"] = "스프린트 Must SP 계획"
    agg["A23"].font = font(11, True, NAVY)
    agg["A24"] = "스프린트"
    agg["B24"] = "계획SP"
    agg["C24"] = "완료SP"
    for col in range(1, 4):
        agg.cell(24, col).font = font(9, True, WHITE)
        agg.cell(24, col).fill = fill(NAVY)
        agg.cell(24, col).border = thin
        agg.cell(24, col).alignment = center
    impl_sprints = ["S1", "S2", "S3", "S4", "S5", "S6"]
    for i, sid in enumerate(impl_sprints):
        r = 25 + i
        agg.cell(r, 1, sid)
        agg.cell(r, 2, f'=IFERROR(INDEX(스프린트!E:E,MATCH(A{r},스프린트!A:A,0)),0)')
        agg.cell(r, 3, f'=SUMIFS(제품백로그!F:F,제품백로그!G:G,A{r},제품백로그!K:K,"완료")')
        for col in range(1, 4):
            agg.cell(r, col).border = thin
            agg.cell(r, col).font = font(9)
            agg.cell(r, col).alignment = center
    agg["A31"] = "용량"
    agg["B31"] = 16
    agg["C31"] = "주당 16 SP"

    # Owner load
    agg["E23"] = "담당별 Must+EN SP (주 담당)"
    agg["E23"].font = font(11, True, NAVY)
    agg["E24"] = "담당"
    agg["F24"] = "SP"
    for col, h in enumerate(["담당", "SP"], 5):
        agg.cell(24, col, h)
        agg.cell(24, col).font = font(9, True, WHITE)
        agg.cell(24, col).fill = fill(NAVY)
        agg.cell(24, col).border = thin
    owners = ["조찬희", "기경현", "공동"]
    for i, ow in enumerate(owners):
        r = 25 + i
        agg.cell(r, 5, ow)
        agg.cell(r, 6, f'=SUMIFS(제품백로그!F:F,제품백로그!H:H,E{r},제품백로그!C:C,"<>Could",제품백로그!C:C,"<>Should")')
        for col in range(5, 7):
            agg.cell(r, col).border = thin
            agg.cell(r, col).font = font(9)
            agg.cell(r, col).alignment = center

    # Epic SP
    agg["A33"] = "에픽별 Must SP"
    agg["A33"].font = font(11, True, NAVY)
    epics = ["E1 수집", "E2 계획", "E3 검지", "E4 관제", "E5 통제", "E6 통계", "E7 계정·설정", "기반"]
    agg["A34"] = "에픽"
    agg["B34"] = "계획SP"
    agg["C34"] = "완료SP"
    for col in range(1, 4):
        agg.cell(34, col).font = font(9, True, WHITE)
        agg.cell(34, col).fill = fill(NAVY)
        agg.cell(34, col).border = thin
    for i, ep in enumerate(epics):
        r = 35 + i
        agg.cell(r, 1, ep)
        agg.cell(r, 2, f'=SUMIFS(제품백로그!F:F,제품백로그!D:D,A{r},제품백로그!C:C,"Must")+SUMIFS(제품백로그!F:F,제품백로그!D:D,A{r},제품백로그!C:C,"EN")')
        agg.cell(r, 3, f'=SUMIFS(제품백로그!F:F,제품백로그!D:D,A{r},제품백로그!K:K,"완료")')
        for col in range(1, 4):
            agg.cell(r, col).border = thin
            agg.cell(r, col).font = font(9)

    # Fix dashboard KPI to use 진척률 column D of 집계
    # 분석 row 10, 설계 11, 구현 12, 테스트 13, 인도 14, overall C20 is pct... C20 is pct yes
    dash["C14"] = "=집계!C20"
    dash["D14"] = "=집계!D10"  # 분석
    dash["E14"] = "=집계!D11"
    dash["F14"] = "=집계!D12"
    dash["G14"] = "=집계!D13"
    dash["H14"] = "=집계!D14"
    dash["I14"] = "=집계!C16"
    dash["C15"] = '=TEXT(집계!B20,"0.0")&" / "&TEXT(집계!A20,"0.0")&"인일"'
    dash["D15"] = '=TEXT(집계!C10,"0.0")&"/"&TEXT(집계!B10,"0.0")'
    dash["E15"] = '=TEXT(집계!C11,"0.0")&"/"&TEXT(집계!B11,"0.0")'
    dash["F15"] = '=TEXT(집계!C12,"0.0")&"/"&TEXT(집계!B12,"0.0")'
    dash["G15"] = '=TEXT(집계!C13,"0.0")&"/"&TEXT(집계!B13,"0.0")'
    dash["H15"] = '=TEXT(집계!C14,"0.0")&"/"&TEXT(집계!B14,"0.0")'

    # Charts
    chart1 = BarChart()
    chart1.type = "col"
    chart1.grouping = "clustered"
    chart1.title = "단계별 인일 (계획 vs 획득)"
    chart1.y_axis.title = "인일"
    chart1.x_axis.title = "단계"
    data = Reference(agg, min_col=2, min_row=8, max_col=3, max_row=14)
    cats = Reference(agg, min_col=1, min_row=9, max_row=14)
    chart1.add_data(data, titles_from_data=True)
    chart1.set_categories(cats)
    chart1.shape = 4
    chart1.style = 10
    chart1.y_axis.scaling.min = 0
    chart1.legend.position = "b"
    chart1.height = 7
    chart1.width = 12
    dash.add_chart(chart1, "B36")

    chart2 = BarChart()
    chart2.type = "col"
    chart2.grouping = "clustered"
    chart2.title = "구현 스프린트 Must SP (계획 vs 완료)"
    chart2.y_axis.title = "스토리 포인트"
    chart2.x_axis.title = "스프린트"
    data2 = Reference(agg, min_col=2, min_row=24, max_col=3, max_row=30)
    cats2 = Reference(agg, min_col=1, min_row=25, max_row=30)
    chart2.add_data(data2, titles_from_data=True)
    chart2.set_categories(cats2)
    chart2.style = 10
    chart2.legend.position = "b"
    chart2.height = 7
    chart2.width = 10
    # capacity line — skip, add note
    dash.add_chart(chart2, "G36")

    dash["B45"] = "차트 출처: 집계 시트 (WBS 인일 · 제품백로그 SP). 완료로 바꾸면 주황/획득 막대가 올라갑니다. 가로 점선 용량 16SP는 S2–S6 기준."
    dash["B45"].font = font(8, False, MUTED)
    dash.merge_cells("B45:J45")

    # current week highlight note on dashboard
    dash.merge_cells("F5:J6")
    dash["F5"] = (
        "S6 Must 잔여 ≈ 29SP (용량 16을 초과).\n"
        "1순위: MON-02, CTL-05, CTL-01, CTL-02, CTL-03\n"
        "3순위 커트: RPT-02, ADM-02, CTL-04, PLN-02"
    )
    dash["F5"].alignment = Alignment(wrap_text=True, vertical="top")
    dash["F5"].font = font(9)
    dash["F5"].fill = fill(ORANGE_BG)
    for col in range(6, 11):
        dash.cell(5, col).fill = fill(ORANGE_BG)
        dash.cell(6, col).fill = fill(ORANGE_BG)
        dash.cell(5, col).border = thin
        dash.cell(6, col).border = thin

    # print area / tab colors
    dash.sheet_properties.tabColor = NAVY
    gt.sheet_properties.tabColor = "2E5090"
    wbs.sheet_properties.tabColor = "3D6B4F"
    bl.sheet_properties.tabColor = "7A5B00"
    sp.sheet_properties.tabColor = "5B3A8F"
    ms.sheet_properties.tabColor = "1B365D"
    rk.sheet_properties.tabColor = "9C2A2A"
    agg.sheet_properties.tabColor = "888888"
    wb["사용안내"].sheet_properties.tabColor = "6B7280"

    # defined name for week1
    from openpyxl.workbook.defined_name import DefinedName
    wb.defined_names.add(DefinedName(name="Week1Start", attr_text="대시보드!$C$8"))
    wb.defined_names.add(DefinedName(name="AsOf", attr_text="대시보드!$C$7"))

    # freeze dashboard
    dash.freeze_panes = "B5"
    dash.sheet_view.showGridLines = False
    dash.print_area = "B2:J54"
    dash.page_setup.fitToHeight = 1

    # reorder: 대시보드, 사용안내, 주차별계획, WBS, 제품백로그, 스프린트, 마일스톤, 위험, 집계
    order = ["대시보드", "사용안내", "주차별계획", "WBS", "제품백로그", "스프린트", "마일스톤", "위험", "집계"]
    for i, name in enumerate(order):
        wb.move_sheet(name, offset=i - wb.sheetnames.index(name))

    wb.save(OUT)
    print("Wrote", OUT)
    print("WBS rows", len(WBS), "Backlog", len(BACKLOG), "Sprints", len(SPRINTS))


if __name__ == "__main__":
    build()

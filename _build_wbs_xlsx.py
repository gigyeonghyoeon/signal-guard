# -*- coding: utf-8 -*-
"""Signal Guard WBS 엑셀 생성. 근거: 백로그WBS.md v1.0 4장."""
from datetime import date

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.page import PageMargins

from _wbs_data import CAPACITY, MILESTONES, TREE

OUT = r"C:\Users\rlrud\project\신호 이상 탐지\SignalGuard_WBS.xlsx"
FONT = "맑은 고딕"
AS_OF = date(2026, 9, 12)
WEEK1 = date(2026, 9, 1)

NAVY, NAVY2, WHITE, PALE, LINE, MUTED = "1B365D", "2E5090", "FFFFFF", "F7F9FC", "D0D7DE", "5B6570"
GREEN_BG, GREEN_FG = "C6EFCE", "006100"
YELLOW_BG, YELLOW_FG = "FFF2CC", "7A5B00"
BLUE_BG, BLUE_FG = "D6E3F0", "1B365D"
GRAY_BG, GRAY_FG = "EEEEEE", "6B7280"
ORANGE_BG, ORANGE_FG = "FCE4D6", "9C5700"
L1_BG, L2_BG = "DCE6F1", "EEF3F9"

W1 = "표지!$C$15"   # 1주차 시작일
CW = "표지!$C$16"   # 현재 주차

_side = Side(style="thin", color=LINE)
thin = Border(left=_side, right=_side, top=_side, bottom=_side)
center = Alignment(horizontal="center", vertical="center", wrap_text=True)
left_al = Alignment(horizontal="left", vertical="center", wrap_text=True)
top_al = Alignment(horizontal="left", vertical="top", wrap_text=True)


def font(size=10, bold=False, color="1A1A1A"):
    return Font(name=FONT, size=size, bold=bold, color=color)


def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)


def widths(ws, mapping):
    for col, w in mapping.items():
        ws.column_dimensions[col].width = w


def page(ws, title, landscape=True, fit_height=0):
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = fit_height
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.horizontalCentered = True
    ws.page_margins = PageMargins(left=0.35, right=0.35, top=0.55, bottom=0.45, header=0.2, footer=0.2)
    ws.oddHeader.left.text = f"&8{title}"
    ws.oddHeader.right.text = "&8Signal Guard WBS v1.0"
    ws.oddFooter.left.text = "&8실시간 교통신호 상태정보 오류검지 시스템 · 2026-09-12"
    ws.oddFooter.right.text = "&8&P / &N"
    ws.sheet_view.showGridLines = False
    ws.print_options.gridLines = False


def head(ws, row, headers, start_col=1, size=9, bg=NAVY, height=24):
    for i, h in enumerate(headers, start_col):
        c = ws.cell(row, i, h)
        c.font = font(size, True, WHITE)
        c.fill = fill(bg)
        c.alignment = center
        c.border = thin
    ws.row_dimensions[row].height = height


def status_cf(ws, rng):
    for val, bg, fg in (("완료", GREEN_BG, GREEN_FG), ("진행중", YELLOW_BG, YELLOW_FG),
                        ("대기", BLUE_BG, BLUE_FG), ("보류", ORANGE_BG, ORANGE_FG),
                        ("제외", GRAY_BG, GRAY_FG)):
        ws.conditional_formatting.add(rng, CellIsRule(
            operator="equal", formula=[f'"{val}"'], fill=fill(bg), font=font(9, True, fg)))


# ---------------------------------------------------------------------------
# 1. 트리를 평면 행 목록으로 전개
# ---------------------------------------------------------------------------
ROWS = []       # (id, kind, level, name, phase, activity, leaf_or_None)
PHASE_IDX = []  # (phase_name, row_index_in_ROWS)
ACT_IDX = []

for pid, pname, children in TREE:
    PHASE_IDX.append((pname, len(ROWS)))
    ROWS.append((pid, "단계", 1, pname, pname, "", None))
    for child in children:
        if len(child) == 3 and isinstance(child[2], list):
            aid, aname, leaves = child
            ACT_IDX.append((aname, len(ROWS)))
            ROWS.append((aid, "활동", 2, aname, pname, aname, None))
            for lf in leaves:
                ROWS.append((lf[0], "작업", 3, lf[1], pname, aname, lf))
        else:
            ROWS.append((child[0], "작업", 2, child[1], pname, "", child))

FIRST = 5
LAST = FIRST + len(ROWS) - 1
DATA = f"${FIRST}:${LAST}"


def R(letter):
    """WBS 데이터 영역의 열 절대 참조 (예: $F$5:$F$90)."""
    return f"${letter}${FIRST}:${letter}${LAST}"


def desc_range(idx):
    """ROWS[idx] 하위 후손이 차지하는 엑셀 행 범위."""
    lvl = ROWS[idx][2]
    end = idx
    for j in range(idx + 1, len(ROWS)):
        if ROWS[j][2] <= lvl:
            break
        end = j
    return FIRST + idx + 1, FIRST + end


def build():
    wb = Workbook()

    # =====================================================================
    # 표지
    # =====================================================================
    cv = wb.active
    cv.title = "표지"
    page(cv, "표지", landscape=False, fit_height=1)
    widths(cv, {"A": 3, "B": 20, "C": 26, "D": 58})

    cv.merge_cells("B2:D2")
    cv["B2"] = "작업분류체계 (WBS)"
    cv["B2"].font = font(22, True, NAVY)
    cv.merge_cells("B3:D3")
    cv["B3"] = "실시간 교통신호 상태정보 오류검지 시스템 · Signal Guard · 15주 MVP"
    cv["B3"].font = font(11, False, MUTED)
    cv.row_dimensions[2].height = 30

    def block(row, title):
        cv.merge_cells(start_row=row, start_column=2, end_row=row, end_column=4)
        cv.cell(row, 2, title).font = font(12, True, WHITE)
        for col in (2, 3, 4):
            cv.cell(row, col).fill = fill(NAVY)
            cv.cell(row, col).border = thin
        cv.row_dimensions[row].height = 20

    def kv(row, key, value, merge=True, num=None, input_cell=False):
        cv.cell(row, 2, key).font = font(10, True, NAVY)
        cv.cell(row, 2).fill = fill(PALE)
        cv.cell(row, 2).alignment = left_al
        cv.cell(row, 2).border = thin
        if merge:
            cv.merge_cells(start_row=row, start_column=3, end_row=row, end_column=4)
        c = cv.cell(row, 3, value)
        c.font = font(10, True) if input_cell else font(10)
        c.alignment = left_al
        for col in (3, 4):
            cv.cell(row, col).border = thin
            if input_cell:
                cv.cell(row, col).fill = fill(YELLOW_BG)
        if num:
            c.number_format = num
        cv.row_dimensions[row].height = 18

    block(5, "문서 정보")
    kv(6, "문서명", "실시간 교통신호 상태정보 오류검지 시스템 작업분류체계")
    kv(7, "프로젝트", "Signal Guard (수업 프로젝트 · 15주 · 2인)")
    kv(8, "버전 / 작성일", "1.1 / 2026-09-12")
    kv(9, "작성", "조찬희 (기획·프론트엔드·PM), 기경현 (백엔드·데이터)")
    kv(10, "근거 문서", "백로그WBS.md v1.0 4장, 프로젝트정의서.md 12장, 요구사항정의서.md")
    kv(11, "범위", "6단계 / 활동 8개 / 작업패키지 72개 (확정 68 · 보류 2 · 제외 2)")
    kv(12, "v1.1 변경", "주간 가용량을 넘지 않도록 인일 재추정 + 기간 분산 — 초과 10주 해소")

    block(13, "기준값  (노란 칸만 고치면 날짜·간트·현재 주차가 따라갑니다)")
    kv(14, "기준일", AS_OF, num="YYYY-MM-DD", input_cell=True)
    kv(15, "1주차 시작일", WEEK1, num="YYYY-MM-DD", input_cell=True)
    kv(16, "현재 주차", "=MAX(1,MIN(15,INT((C14-C15)/7)+1))")
    kv(17, "확정 계획 인일 / 팀 가용", f'=TEXT(요약!D14,"0.0")&"인일  /  "&TEXT(SUM(요약!D36:D50),"0.0")&"인일 가용"')
    kv(18, "획득 인일 / 진척률", '=TEXT(요약!E14,"0.0")&"인일  ·  "&TEXT(요약!F14,"0%")')

    block(20, "시트 구성")
    for i, (nm, role) in enumerate([
        ("WBS", "본체. 단계 → 활동 → 작업패키지 3계층. 상태·진행률만 입력하면 나머지는 수식."),
        ("간트", "15주 주차별 막대. WBS를 그대로 참조하므로 따로 고칠 것이 없습니다."),
        ("요약", "단계별·담당별·주차별 인일 집계와 차트, 마일스톤, 검증 결과."),
        ("표지", "문서 정보와 기준값. 1주차 시작일을 바꾸면 전체 날짜가 이동합니다."),
    ]):
        r = 21 + i
        cv.cell(r, 2, nm).font = font(10, True)
        cv.cell(r, 2).alignment = center
        cv.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        cv.cell(r, 3, role).font = font(10)
        cv.cell(r, 3).alignment = left_al
        for col in (2, 3, 4):
            cv.cell(r, col).border = thin
            if i % 2 == 0:
                cv.cell(r, col).fill = fill(PALE)
        cv.row_dimensions[r].height = 26

    block(26, "WBS 작성 규칙")
    for i, t in enumerate([
        "① 100% 규칙 — 상위 단계의 인일은 하위 작업패키지 합계와 정확히 같다 (요약 시트에서 자동 검증).",
        "② 최하위 단위는 작업패키지(Work Package)다. 0.5~2.5인일로 쪼개 한 주 안에 끝낼 수 있게 한다.",
        "③ 작업패키지는 산출물 하나로 완료를 확인한다. 완료 판정은 백로그WBS.md 2.4 DoD를 따른다.",
        "④ 구현 작업패키지는 제품 백로그(US/EN) 한 건과 연결한다 — 추적은 '관련 백로그' 열.",
        "⑤ 인일은 수업일 기준. 분석·설계·테스트·안정화 주 4인일, 구현 주 6인일이 팀 가용량이다.",
        "⑥ 제외(Could)·보류(Should) 항목은 확정 계획 합계와 주차별 부하에서 빠진다 — 여유 주에만 넣는다.",
        "⑦ 어느 주도 팀 가용량을 넘지 않게 기간을 쪼갠다. v1.1에서 인일을 재추정하고 초과 10주를 해소했다.",
    ]):
        r = 27 + i
        cv.merge_cells(start_row=r, start_column=2, end_row=r, end_column=4)
        cv.cell(r, 2, t).font = font(10)
        cv.cell(r, 2).alignment = left_al
        cv.row_dimensions[r].height = 17

    block(34, "상태 값 (WBS 시트 드롭다운)")
    for i, (st, bg, fg, mean) in enumerate([
        ("완료", GREEN_BG, GREEN_FG, "산출물이 저장소에 있고 DoD를 만족. 진행률 100%."),
        ("진행중", YELLOW_BG, YELLOW_FG, "이번 주 작업 중. 진행률(0~100%)을 같이 적는다."),
        ("대기", BLUE_BG, BLUE_FG, "선행이 끝나지 않았거나 아직 착수 전."),
        ("보류", ORANGE_BG, ORANGE_FG, "Should·조건부. 승인이나 여유 주가 생기면 대기로 바꾼다."),
        ("제외", GRAY_BG, GRAY_FG, "Could 또는 범위 커트. 계획·진척 분모에서 빠진다."),
    ]):
        r = 35 + i
        c = cv.cell(r, 2, st)
        c.font = font(10, True, fg)
        c.fill = fill(bg)
        c.alignment = center
        cv.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        cv.cell(r, 3, mean).font = font(10)
        cv.cell(r, 3).alignment = left_al
        for col in (2, 3, 4):
            cv.cell(r, col).border = thin
        cv.row_dimensions[r].height = 17

    cv.merge_cells("B41:D42")
    cv["B41"] = ("주간 리뷰 절차: WBS 시트의 상태·진행률 두 열만 고친다 → 요약 시트의 단계별 진척과 "
                 "주차별 부하가 갱신된다 → 초과(빨간 칸)가 보이면 백로그WBS.md 3.5 커트 순서를 적용한다.")
    cv["B41"].font = font(10, True, GREEN_FG)
    cv["B41"].fill = fill(GREEN_BG)
    cv["B41"].alignment = top_al
    for col in (2, 3, 4):
        for r in (41, 42):
            cv.cell(r, col).fill = fill(GREEN_BG)
            cv.cell(r, col).border = thin

    # =====================================================================
    # WBS
    # =====================================================================
    ws = wb.create_sheet("WBS")
    page(ws, "WBS")
    widths(ws, {"A": 9, "B": 7, "C": 44, "D": 11, "E": 13, "F": 7, "G": 7, "H": 7,
                "I": 11, "J": 11, "K": 9, "L": 15, "M": 22, "N": 15, "O": 9, "P": 8,
                "Q": 9, "R": 26})
    ws.merge_cells("A1:R1")
    ws["A1"] = "작업분류체계 (WBS) — 단계 · 활동 · 작업패키지"
    ws["A1"].font = font(16, True, NAVY)
    ws.row_dimensions[1].height = 26
    ws.merge_cells("A2:R2")
    ws["A2"] = ('=" 확정 계획 "&TEXT(요약!D14,"0.0")&"인일  |  작업패키지 "'
                f'&TEXT(COUNTIFS({R("B")},"작업"),"0")&"개  |  진척 "&TEXT(요약!F14,"0%")'
                '&"  |  현재 "&TEXT(표지!C16,"0")&"주차  |  주 최대 부하 "'
                '&TEXT(MAX(요약!C36:C50),"0.0")&"인일  |  파란 배경 행은 수식(합계)이므로 직접 고치지 마세요."')
    ws["A2"].font = font(10, False, MUTED)
    ws.row_dimensions[2].height = 18

    head(ws, 4, ["WBS ID", "구분", "작업 항목", "단계", "활동", "인일", "시작주", "종료주",
                 "시작일", "종료일", "담당", "선행 작업", "산출물", "관련 백로그", "상태",
                 "진행률", "획득인일", "비고"], height=30)
    ws.freeze_panes = "D5"
    ws.sheet_properties.outlinePr.summaryBelow = False

    leaf_status_cells = []
    for i, (wid, kind, lvl, name, phase, act, lf) in enumerate(ROWS):
        r = FIRST + i
        ws.cell(r, 1, wid)
        ws.cell(r, 2, kind)
        ws.cell(r, 3, name)
        ws.cell(r, 4, phase)
        ws.cell(r, 5, act)
        ws.cell(r, 9, f'={W1}+7*(G{r}-1)')
        ws.cell(r, 10, f'={W1}+7*(H{r}-1)+6')

        if kind == "작업":
            ws.cell(r, 6, lf[2])
            ws.cell(r, 7, lf[3])
            ws.cell(r, 8, lf[4])
            ws.cell(r, 11, lf[5])
            ws.cell(r, 12, lf[6])
            ws.cell(r, 13, lf[7])
            ws.cell(r, 14, lf[8])
            ws.cell(r, 15, lf[9])
            ws.cell(r, 16, lf[10])
            ws.cell(r, 17, f'=IF(OR($O{r}="제외",$O{r}="보류"),0,$F{r}*$P{r})')
            ws.cell(r, 18, lf[11])
            leaf_status_cells.append(f"O{r}")
        else:
            key_col, key_ref = ("$D", f"$D{r}") if lvl == 1 else ("$E", f"$E{r}")
            crit = (f'{R("B")},"작업",{R(key_col[1])},{key_ref},'
                    f'{R("O")},"<>제외",{R("O")},"<>보류"')
            ws.cell(r, 6, f'=SUMIFS({R("F")},{crit})')
            ws.cell(r, 17, f'=SUMIFS({R("Q")},{crit})')
            d0, d1 = desc_range(i)
            ws.cell(r, 7, f'=MIN(G{d0}:G{d1})')
            ws.cell(r, 8, f'=MAX(H{d0}:H{d1})')
            ws.cell(r, 15, f'=IF($F{r}=0,"-",IF($Q{r}>=$F{r},"완료",IF($Q{r}>0,"진행중","대기")))')
            ws.cell(r, 16, f'=IF($F{r}=0,0,$Q{r}/$F{r})')
            ws.cell(r, 11, "공동" if lvl == 1 else "")
            ws.cell(r, 18, f'=TEXT(COUNTIFS({R("B")},"작업",{R(key_col[1])},{key_ref}),"0")&"개 작업패키지 합계"')

        for col in range(1, 19):
            c = ws.cell(r, col)
            c.border = thin
            c.font = font(9, kind != "작업")
            c.alignment = left_al if col in (3, 12, 13, 18) else center
        ws.cell(r, 3).alignment = Alignment(horizontal="left", vertical="center",
                                            wrap_text=True, indent=(lvl - 1) * 2)
        ws.cell(r, 6).number_format = "0.0"
        ws.cell(r, 17).number_format = "0.0"
        ws.cell(r, 16).number_format = "0%"
        ws.cell(r, 9).number_format = "MM-DD"
        ws.cell(r, 10).number_format = "MM-DD"
        ws.row_dimensions[r].height = 24 if kind == "작업" else 20

        if lvl == 1:
            for col in range(1, 19):
                ws.cell(r, col).fill = fill(L1_BG)
                ws.cell(r, col).font = font(11, True, NAVY)
        elif lvl == 2 and kind == "활동":
            for col in range(1, 19):
                ws.cell(r, col).fill = fill(L2_BG)
                ws.cell(r, col).font = font(10, True, NAVY2)
        else:
            ws.row_dimensions[r].outlineLevel = 2 if lvl == 3 else 1
            if lf[9] == "제외":
                for col in range(1, 19):
                    ws.cell(r, col).font = font(9, False, GRAY_FG)
        if kind == "활동":
            ws.row_dimensions[r].outlineLevel = 1

    dv = DataValidation(type="list", formula1='"대기,진행중,완료,보류,제외"', allow_blank=False)
    dv.errorTitle, dv.error = "상태", "대기 / 진행중 / 완료 / 보류 / 제외 중에서 고르세요."
    dv.promptTitle, dv.prompt = "진행 상태", "주간 리뷰에서 이 칸과 진행률만 고칩니다."
    ws.add_data_validation(dv)
    dvp = DataValidation(type="decimal", operator="between", formula1="0", formula2="1", allow_blank=True)
    dvp.errorTitle, dvp.error = "진행률", "0%~100% 사이 값을 넣으세요."
    ws.add_data_validation(dvp)
    for addr in leaf_status_cells:
        dv.add(addr)
        dvp.add(addr.replace("O", "P"))

    status_cf(ws, f"O{FIRST}:O{LAST}")
    ws.conditional_formatting.add(f"P{FIRST}:P{LAST}", CellIsRule(
        operator="equal", formula=["1"], fill=fill(GREEN_BG), font=font(9, True, GREEN_FG)))
    ws.conditional_formatting.add(f"P{FIRST}:P{LAST}", CellIsRule(
        operator="between", formula=["0.001", "0.999"], fill=fill(YELLOW_BG), font=font(9, False, YELLOW_FG)))
    ws.auto_filter.ref = f"A4:R{LAST}"
    ws.print_title_rows = "4:4"

    # =====================================================================
    # 간트
    # =====================================================================
    gt = wb.create_sheet("간트")
    page(gt, "간트")
    widths(gt, {"A": 9, "B": 40, "C": 9, "D": 7, "E": 7, "F": 9, "G": 8})
    for n in range(1, 16):
        gt.column_dimensions[get_column_letter(7 + n)].width = 4.4
    gt.merge_cells("A1:V1")
    gt["A1"] = "주차별 일정 (15주)"
    gt["A1"].font = font(16, True, NAVY)
    gt.row_dimensions[1].height = 26
    gt.merge_cells("A2:V2")
    gt["A2"] = "범례   ● 완료    ▶ 진행중    ■ 계획    ◇ 보류    · 제외        노란 세로 띠 = 현재 주차 (표지 기준일 기준)"
    gt["A2"].font = font(9, False, MUTED)

    head(gt, 3, ["WBS ID", "작업 항목", "담당", "시작주", "종료주", "상태", "진행률"], height=22)
    for n in range(1, 16):
        c = gt.cell(3, 7 + n, n)
        c.font = font(9, True, WHITE)
        c.fill = fill(NAVY)
        c.alignment = center
        c.border = thin
        c.number_format = '"W"0'
    gt.merge_cells("A4:G4")
    gt.cell(4, 1, "주 시작일 →")
    for col in range(1, 8):
        gt.cell(4, col).fill = fill(NAVY2)
        gt.cell(4, col).font = font(8, True, WHITE)
        gt.cell(4, col).border = thin
        gt.cell(4, col).alignment = center
    for n in range(1, 16):
        c = gt.cell(4, 7 + n, f'={W1}+7*({n}-1)')
        c.number_format = "M/D"
        c.font = font(8, False, WHITE)
        c.fill = fill(NAVY2)
        c.alignment = center
        c.border = thin
    gt.freeze_panes = "H5"
    gt.sheet_properties.outlinePr.summaryBelow = False

    g_first = 5
    for i, (wid, kind, lvl, name, phase, act, lf) in enumerate(ROWS):
        r = g_first + i
        src = FIRST + i
        for col, ref in ((1, "A"), (2, "C"), (3, "K"), (4, "G"), (5, "H"), (6, "O"), (7, "P")):
            gt.cell(r, col, f"=WBS!{ref}{src}")
        gt.cell(r, 7).number_format = "0%"
        for col in range(1, 8):
            c = gt.cell(r, col)
            c.border = thin
            c.font = font(9, kind != "작업")
            c.alignment = left_al if col == 2 else center
        gt.cell(r, 2).alignment = Alignment(horizontal="left", vertical="center",
                                            wrap_text=True, indent=(lvl - 1) * 2)
        if lvl == 1:
            for col in range(1, 8):
                gt.cell(r, col).fill = fill(L1_BG)
                gt.cell(r, col).font = font(10, True, NAVY)
        elif kind == "활동":
            for col in range(1, 8):
                gt.cell(r, col).fill = fill(L2_BG)
                gt.cell(r, col).font = font(9, True, NAVY2)
        else:
            gt.row_dimensions[r].outlineLevel = 2 if lvl == 3 else 1
        if kind == "활동":
            gt.row_dimensions[r].outlineLevel = 1
        for n in range(1, 16):
            c = gt.cell(r, 7 + n, f'=IF(AND({n}>=$D{r},{n}<=$E{r}),'
                                   f'IF($F{r}="완료","●",IF($F{r}="진행중","▶",'
                                   f'IF($F{r}="제외",".",IF($F{r}="보류","◇","■")))),"")')
            c.alignment = center
            c.font = font(9)
            c.border = thin
        gt.row_dimensions[r].height = 18

    g_last = g_first + len(ROWS) - 1
    m_first = g_last + 2
    gt.merge_cells(f"A{m_first}:V{m_first}")
    gt.cell(m_first, 1, "마일스톤").font = font(12, True, NAVY)
    for i, (mid, wk, nm, cond, wbsid, st) in enumerate(MILESTONES):
        r = m_first + 1 + i
        gt.cell(r, 1, mid)
        gt.cell(r, 2, f"{nm} — {cond}")
        gt.cell(r, 3, f"WBS {wbsid}")
        gt.cell(r, 4, wk)
        gt.cell(r, 5, wk)
        gt.cell(r, 6, st)
        for col in range(1, 8):
            c = gt.cell(r, col)
            c.border = thin
            c.font = font(9, True, NAVY)
            c.alignment = left_al if col == 2 else center
            c.fill = fill(PALE)
        for n in range(1, 16):
            c = gt.cell(r, 7 + n, f'=IF({n}=$D{r},IF($F{r}="완료","◆","◇"),"")')
            c.alignment = center
            c.font = font(10, True, NAVY)
            c.border = thin

    grng = f"H{g_first}:V{m_first + len(MILESTONES)}"
    for sym, bg, fg, bold in (("●", GREEN_BG, GREEN_FG, True), ("▶", YELLOW_BG, YELLOW_FG, True),
                              ("■", BLUE_BG, BLUE_FG, True), ("◇", ORANGE_BG, ORANGE_FG, True),
                              (".", GRAY_BG, GRAY_FG, False), ("◆", NAVY, WHITE, True)):
        gt.conditional_formatting.add(grng, CellIsRule(
            operator="equal", formula=[f'"{sym}"'], fill=fill(bg), font=font(9, bold, fg)))
    for n in range(1, 16):
        col = get_column_letter(7 + n)
        gt.conditional_formatting.add(
            f"{col}3:{col}{m_first + len(MILESTONES)}",
            FormulaRule(formula=[f"AND({col}$3={CW},{col}3=\"\")"], fill=fill("FFF9E6")))
    status_cf(gt, f"F{g_first}:F{m_first + len(MILESTONES)}")
    gt.print_title_rows = "3:4"

    # =====================================================================
    # 요약
    # =====================================================================
    sm = wb.create_sheet("요약")
    page(sm, "요약")
    widths(sm, {"A": 3, "B": 16, "C": 12, "D": 12, "E": 11, "F": 9, "G": 9, "H": 3,
                "I": 13, "J": 13, "K": 13, "L": 13, "M": 13, "N": 13})
    sm.merge_cells("B1:N1")
    sm["B1"] = "WBS 요약 · 인일 집계"
    sm["B1"].font = font(16, True, NAVY)
    sm.row_dimensions[1].height = 26

    kpis = [
        ("확정 계획 인일", "=D14", "0.0"),
        ("획득 인일", "=E14", "0.0"),
        ("진척률", "=F14", "0%"),
        ("작업패키지", f'=COUNTIFS(WBS!{R("B")},"작업")', "0"),
        ("완료", f'=COUNTIFS(WBS!{R("B")},"작업",WBS!{R("O")},"완료")', "0"),
        ("현재 주차", "=표지!C16", '"W"0'),
    ]
    for i, (label, fml, nf) in enumerate(kpis):
        col = 2 + i
        c = sm.cell(3, col, label)
        c.font = font(9, True, WHITE)
        c.fill = fill(NAVY2)
        c.alignment = center
        c.border = thin
        v = sm.cell(4, col, fml)
        v.font = font(15, True, NAVY)
        v.alignment = center
        v.border = thin
        v.fill = fill("EAF1F8")
        v.number_format = nf
    sm.row_dimensions[4].height = 30

    # 단계별
    sm["B6"] = "단계별 집계"
    sm["B6"].font = font(12, True, NAVY)
    head(sm, 7, ["단계", "작업패키지", "계획 인일", "획득 인일", "진척률", "시작주", "종료주"], start_col=2)
    phases = [p[0] for p in PHASE_IDX]
    for i, ph in enumerate(phases):
        r = 8 + i
        crit = f'WBS!{R("B")},"작업",WBS!{R("D")},$B{r}'
        sm.cell(r, 2, ph)
        excl = f'WBS!{R("O")},"<>제외",WBS!{R("O")},"<>보류"'
        sm.cell(r, 3, f'=COUNTIFS({crit},{excl})')
        sm.cell(r, 4, f'=SUMIFS(WBS!{R("F")},{crit},{excl})')
        sm.cell(r, 5, f'=SUMIFS(WBS!{R("Q")},{crit},{excl})')
        sm.cell(r, 6, f'=IF(D{r}=0,0,E{r}/D{r})')
        sm.cell(r, 7, f"=WBS!G{FIRST + PHASE_IDX[i][1]}")
        sm.cell(r, 8, f"=WBS!H{FIRST + PHASE_IDX[i][1]}")
        for col in range(2, 9):
            c = sm.cell(r, col)
            c.border = thin
            c.font = font(9)
            c.alignment = left_al if col == 2 else center
            if i % 2 == 0:
                c.fill = fill(PALE)
        sm.cell(r, 4).number_format = "0.0"
        sm.cell(r, 5).number_format = "0.0"
        sm.cell(r, 6).number_format = "0%"
    r = 14
    sm.cell(r, 2, "합계")
    sm.cell(r, 3, "=SUM(C8:C13)")
    sm.cell(r, 4, "=SUM(D8:D13)")
    sm.cell(r, 5, "=SUM(E8:E13)")
    sm.cell(r, 6, "=IF(D14=0,0,E14/D14)")
    sm.cell(r, 7, 1)
    sm.cell(r, 8, 15)
    for col in range(2, 9):
        c = sm.cell(r, col)
        c.border = thin
        c.font = font(10, True, WHITE)
        c.fill = fill(NAVY)
        c.alignment = left_al if col == 2 else center
    sm.cell(r, 4).number_format = "0.0"
    sm.cell(r, 5).number_format = "0.0"
    sm.cell(r, 6).number_format = "0%"

    # 담당별
    sm["B16"] = "담당별 부하 (작업패키지 인일)"
    sm["B16"].font = font(12, True, NAVY)
    head(sm, 17, ["담당", "작업패키지", "계획 인일", "획득 인일", "진척률", "비중"], start_col=2)
    for i, ow in enumerate(["조찬희", "기경현", "공동"]):
        r = 18 + i
        crit = (f'WBS!{R("B")},"작업",WBS!{R("K")},$B{r},'
                f'WBS!{R("O")},"<>제외",WBS!{R("O")},"<>보류"')
        sm.cell(r, 2, ow)
        sm.cell(r, 3, f'=COUNTIFS({crit})')
        sm.cell(r, 4, f'=SUMIFS(WBS!{R("F")},{crit})')
        sm.cell(r, 5, f'=SUMIFS(WBS!{R("Q")},{crit})')
        sm.cell(r, 6, f'=IF(D{r}=0,0,E{r}/D{r})')
        sm.cell(r, 7, f'=IF($D$21=0,0,D{r}/$D$21)')
        for col in range(2, 8):
            c = sm.cell(r, col)
            c.border = thin
            c.font = font(9)
            c.alignment = left_al if col == 2 else center
        sm.cell(r, 4).number_format = "0.0"
        sm.cell(r, 5).number_format = "0.0"
        sm.cell(r, 6).number_format = "0%"
        sm.cell(r, 7).number_format = "0%"
    sm.cell(21, 2, "합계")
    sm.cell(21, 3, "=SUM(C18:C20)")
    sm.cell(21, 4, "=SUM(D18:D20)")
    sm.cell(21, 5, "=SUM(E18:E20)")
    sm.cell(21, 6, "=IF(D21=0,0,E21/D21)")
    sm.cell(21, 7, 1)
    for col in range(2, 8):
        c = sm.cell(21, col)
        c.border = thin
        c.font = font(10, True, WHITE)
        c.fill = fill(NAVY)
        c.alignment = left_al if col == 2 else center
    sm.cell(21, 4).number_format = "0.0"
    sm.cell(21, 5).number_format = "0.0"
    sm.cell(21, 6).number_format = "0%"
    sm.cell(21, 7).number_format = "0%"

    # 구현 활동별
    sm["B23"] = "구현 활동별 (4.1~4.8)"
    sm["B23"].font = font(12, True, NAVY)
    head(sm, 24, ["활동", "작업패키지", "계획 인일", "획득 인일", "진척률"], start_col=2)
    acts = [a[0] for a in ACT_IDX]
    for i, an in enumerate(acts):
        r = 25 + i
        crit = (f'WBS!{R("B")},"작업",WBS!{R("E")},$B{r},'
                f'WBS!{R("O")},"<>제외",WBS!{R("O")},"<>보류"')
        sm.cell(r, 2, an)
        sm.cell(r, 3, f'=COUNTIFS({crit})')
        sm.cell(r, 4, f'=SUMIFS(WBS!{R("F")},{crit})')
        sm.cell(r, 5, f'=SUMIFS(WBS!{R("Q")},{crit})')
        sm.cell(r, 6, f'=IF(D{r}=0,0,E{r}/D{r})')
        for col in range(2, 7):
            c = sm.cell(r, col)
            c.border = thin
            c.font = font(9)
            c.alignment = left_al if col == 2 else center
            if i % 2 == 0:
                c.fill = fill(PALE)
        sm.cell(r, 4).number_format = "0.0"
        sm.cell(r, 5).number_format = "0.0"
        sm.cell(r, 6).number_format = "0%"

    # 주차별 부하
    load_first = 35
    sm["B34"] = "주차별 인일 부하 (기간에 균등 배분)"
    sm["B34"].font = font(12, True, NAVY)
    head(sm, load_first, ["주차", "계획 인일", "팀 가용", "여유", "판정"], start_col=2)
    for i, (n, cap) in enumerate(CAPACITY):
        r = load_first + 1 + i
        sm.cell(r, 2, n).number_format = '"W"0'
        sm.cell(r, 3, f'=SUMPRODUCT((WBS!{R("B")}="작업")*(WBS!{R("O")}<>"제외")*(WBS!{R("O")}<>"보류")'
                      f'*(WBS!{R("G")}<=$B{r})*(WBS!{R("H")}>=$B{r})'
                      f'*WBS!{R("F")}/(WBS!{R("H")}-WBS!{R("G")}+1))')
        sm.cell(r, 4, cap)
        sm.cell(r, 5, f"=D{r}-C{r}")
        sm.cell(r, 6, f'=IF(C{r}>D{r},"초과",IF(C{r}>D{r}*0.85,"빡빡","여유"))')
        for col in range(2, 7):
            c = sm.cell(r, col)
            c.border = thin
            c.font = font(9)
            c.alignment = center
        for col in (3, 4, 5):
            sm.cell(r, col).number_format = "0.0"
    load_last = load_first + len(CAPACITY)
    sm.conditional_formatting.add(f"F{load_first+1}:F{load_last}", CellIsRule(
        operator="equal", formula=['"초과"'], fill=fill("F8D7DA"), font=font(9, True, "9C2A2A")))
    sm.conditional_formatting.add(f"F{load_first+1}:F{load_last}", CellIsRule(
        operator="equal", formula=['"빡빡"'], fill=fill(YELLOW_BG), font=font(9, True, YELLOW_FG)))
    sm.conditional_formatting.add(f"F{load_first+1}:F{load_last}", CellIsRule(
        operator="equal", formula=['"여유"'], fill=fill(GREEN_BG), font=font(9, False, GREEN_FG)))
    sm.conditional_formatting.add(f"E{load_first+1}:E{load_last}", CellIsRule(
        operator="lessThan", formula=["0"], fill=fill("F8D7DA"), font=font(9, True, "9C2A2A")))

    # 마일스톤
    ms_first = load_last + 2
    sm.cell(ms_first, 2, "마일스톤").font = font(12, True, NAVY)
    head(sm, ms_first + 1, ["ID", "주차", "종료일", "이름", "통과 조건", "상태"], start_col=2)
    for i, (mid, wk, nm, cond, wbsid, st) in enumerate(MILESTONES):
        r = ms_first + 2 + i
        sm.cell(r, 2, mid)
        sm.cell(r, 3, wk).number_format = '"W"0'
        sm.cell(r, 4, f'={W1}+7*({wk}-1)+6').number_format = "YYYY-MM-DD"
        sm.cell(r, 5, nm)
        sm.cell(r, 6, cond)
        sm.cell(r, 7, st)
        for col in range(2, 8):
            c = sm.cell(r, col)
            c.border = thin
            c.font = font(9)
            c.alignment = left_al if col in (5, 6) else center
    status_cf(sm, f"G{ms_first+2}:G{ms_first+1+len(MILESTONES)}")

    # 검증
    vf = ms_first + len(MILESTONES) + 3
    sm.cell(vf, 2, "검증").font = font(12, True, NAVY)
    phase_cells = "+".join(f"WBS!F{FIRST+idx}" for _, idx in PHASE_IDX)
    checks = [
        ("100% 규칙 (단계 합계 = 작업패키지 합계)",
         f'=IF(ROUND({phase_cells},2)=ROUND(D14,2),"OK  "&TEXT(D14,"0.0")&"인일 일치","불일치")'),
        ("작업패키지 누락 (인일 0)",
         f'=IF(COUNTIFS(WBS!{R("B")},"작업",WBS!{R("F")},0)=0,"OK  없음",'
         f'"확인 "&TEXT(COUNTIFS(WBS!{R("B")},"작업",WBS!{R("F")},0),"0")&"건")'),
        ("주차 역전 (종료주 < 시작주)",
         f'=IF(SUMPRODUCT((WBS!{R("B")}="작업")*(WBS!{R("H")}<WBS!{R("G")}))=0,"OK  없음","확인 필요")'),
        ("주차별 초과 (가용 대비)",
         f'=IF(COUNTIF(F{load_first+1}:F{load_last},"초과")=0,"OK  초과 주 없음",'
         f'"초과 "&TEXT(COUNTIF(F{load_first+1}:F{load_last},"초과"),"0")&"주 — 커트 순서 적용")'),
        ("총량 (확정 계획 / 15주 가용)",
         f'=TEXT(D14,"0.0")&" / "&TEXT(SUM(D{load_first+1}:D{load_last}),"0.0")&"인일  ·  부하율 "'
         f'&TEXT(D14/SUM(D{load_first+1}:D{load_last}),"0%")&"  ·  여유 "'
         f'&TEXT(SUM(D{load_first+1}:D{load_last})-D14,"0.0")&"인일"'),
        ("담당별 확정 계획 인일 (전 기간)",
         '=TEXT(D18,"0.0")&" / "&TEXT(D19,"0.0")&" / "&TEXT(D20,"0.0")'
         '&"인일 (조찬희 / 기경현 / 공동)"'),
        ("제외(Could) 인일",
         f'=TEXT(SUMIFS(WBS!{R("F")},WBS!{R("B")},"작업",WBS!{R("O")},"제외"),"0.0")&"인일 / 계획 밖"'),
        ("보류(Should) 인일",
         f'=TEXT(SUMIFS(WBS!{R("F")},WBS!{R("B")},"작업",WBS!{R("O")},"보류"),"0.0")&"인일 / 여유 주에만"'),
    ]
    for i, (label, fml) in enumerate(checks):
        r = vf + 1 + i
        sm.cell(r, 2, label).font = font(9, True, NAVY)
        sm.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        sm.merge_cells(start_row=r, start_column=4, end_row=r, end_column=7)
        sm.cell(r, 4, fml).font = font(9)
        for col in range(2, 8):
            sm.cell(r, col).border = thin
            sm.cell(r, col).alignment = left_al
            if i % 2 == 0:
                sm.cell(r, col).fill = fill(PALE)

    # 차트
    ch1 = BarChart()
    ch1.type = "col"
    ch1.title = "단계별 인일 (계획 vs 획득)"
    ch1.y_axis.title = "인일"
    ch1.add_data(Reference(sm, min_col=4, min_row=7, max_col=5, max_row=13), titles_from_data=True)
    ch1.set_categories(Reference(sm, min_col=2, min_row=8, max_row=13))
    ch1.height, ch1.width, ch1.style = 7.5, 13, 10
    ch1.legend.position = "b"
    sm.add_chart(ch1, "I3")

    ch2 = LineChart()
    ch2.title = "주차별 인일 부하 vs 팀 가용"
    ch2.y_axis.title = "인일"
    ch2.x_axis.title = "주차"
    ch2.add_data(Reference(sm, min_col=3, min_row=load_first, max_col=4, max_row=load_last), titles_from_data=True)
    ch2.set_categories(Reference(sm, min_col=2, min_row=load_first + 1, max_row=load_last))
    ch2.height, ch2.width, ch2.style = 7.5, 13, 12
    ch2.legend.position = "b"
    sm.add_chart(ch2, "I19")

    ch3 = BarChart()
    ch3.type = "bar"
    ch3.title = "구현 활동별 계획 인일"
    ch3.add_data(Reference(sm, min_col=4, min_row=24, max_row=32), titles_from_data=True)
    ch3.set_categories(Reference(sm, min_col=2, min_row=25, max_row=32))
    ch3.height, ch3.width, ch3.style = 8, 13, 11
    ch3.legend.delete = True
    sm.add_chart(ch3, "I35")

    # 탭 색 / 순서
    cv.sheet_properties.tabColor = "6B7280"
    ws.sheet_properties.tabColor = NAVY
    gt.sheet_properties.tabColor = NAVY2
    sm.sheet_properties.tabColor = "3D6B4F"
    for i, name in enumerate(["WBS", "간트", "요약", "표지"]):
        wb.move_sheet(name, offset=i - wb.sheetnames.index(name))
    wb.active = 0

    wb.save(OUT)
    print("saved:", OUT)
    print("rows:", len(ROWS), "leaves:", sum(1 for r in ROWS if r[1] == "작업"),
          "phases:", len(PHASE_IDX), "activities:", len(ACT_IDX))
    print("planned man-days:",
          round(sum(r[6][2] for r in ROWS
                    if r[1] == "작업" and r[6][9] not in ("제외", "보류")), 1))


if __name__ == "__main__":
    build()

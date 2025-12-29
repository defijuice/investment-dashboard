#!/usr/bin/env python3
"""
PDF 표 파서 - pdfplumber 기반
출자사업 접수현황/선정결과 PDF에서 표 데이터를 정확히 추출

사용법:
  python3 pdf-parser.py <pdf_path>              # 접수현황 파싱
  python3 pdf-parser.py <pdf_path> --selection  # 선정결과 파싱
  python3 pdf-parser.py <pdf_path> --raw        # 원본 표 데이터
  python3 pdf-parser.py <pdf_path> --summary    # 분야별 요약
"""

import pdfplumber
import json
import sys
import re

def extract_tables_from_pdf(pdf_path):
    """PDF에서 표 데이터 추출 - table_settings 사용"""
    results = []

    # 테이블 추출 설정
    table_settings = {
        "vertical_strategy": "text",
        "horizontal_strategy": "text",
        "snap_tolerance": 5,
        "join_tolerance": 5,
    }

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables(table_settings)

            for table_idx, table in enumerate(tables):
                for row_idx, row in enumerate(table):
                    if row:
                        # None 값을 빈 문자열로 변환
                        cells = []
                        for cell in row:
                            if cell is None:
                                cells.append('')
                            else:
                                cells.append(str(cell).strip())

                        # 빈 행 건너뛰기
                        if all(c == '' for c in cells):
                            continue

                        results.append({
                            'page': page_num,
                            'table': table_idx,
                            'row': row_idx,
                            'cells': cells
                        })

    return results


def extract_with_explicit_lines(pdf_path):
    """명시적 라인 기반 표 추출"""
    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            # 명시적 라인이 있는 테이블 추출
            tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
            })

            if not tables:
                # 라인이 없으면 텍스트 기반으로 시도
                tables = page.extract_tables({
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                })

            for table_idx, table in enumerate(tables):
                for row_idx, row in enumerate(table):
                    if row:
                        cells = []
                        for cell in row:
                            if cell is None:
                                cells.append('')
                            else:
                                cells.append(str(cell).strip())

                        if all(c == '' for c in cells):
                            continue

                        results.append({
                            'page': page_num,
                            'table': table_idx,
                            'row': row_idx,
                            'cells': cells
                        })

    return results


def parse_application_pdf_v2(pdf_path):
    """접수현황 PDF 파싱 v2 - 명시적 라인 기반"""

    applications = []
    current_category = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # 명시적 라인 기반 추출
            tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
            })

            for table in tables:
                for row in table:
                    if not row:
                        continue

                    # 셀 정리 - None 처리
                    cells = []
                    for cell in row:
                        if cell is None:
                            cells.append('')
                        else:
                            cells.append(str(cell).strip())

                    # 4개 미만 컬럼이면 건너뛰기
                    if len(cells) < 4:
                        continue

                    # 헤더 행 건너뛰기
                    if '출자분야' in cells[0] or '결성예정액' in str(cells):
                        continue

                    # 합계 행 건너뛰기
                    if cells[0] == '계' or cells[0] == '합계':
                        continue

                    # 분야 감지 (첫 번째 컬럼에 값이 있으면 새 분야)
                    if cells[0] and cells[0] not in ['', '-']:
                        current_category = cells[0]

                    # 회사명 추출 (마지막 컬럼)
                    company_cell = cells[-1] if cells[-1] else ''

                    # 빈 회사명 건너뛰기
                    if not company_cell or company_cell in ['-', '']:
                        continue

                    # 회사명이 숫자만 있으면 건너뛰기
                    if re.match(r'^[\d,.\s]+$', company_cell):
                        continue

                    # 결성예정액, 출자요청액 추출
                    amount_planned = cells[1] if len(cells) > 1 else ''
                    amount_requested = cells[2] if len(cells) > 2 else ''

                    # 금액 파싱
                    def parse_amount(s):
                        if not s:
                            return None
                        s = s.replace(',', '').replace(' ', '')
                        try:
                            return float(s)
                        except:
                            return None

                    applications.append({
                        'category': current_category,
                        'company': company_cell,
                        'amount_planned': parse_amount(amount_planned),
                        'amount_requested': parse_amount(amount_requested),
                    })

    return applications


def split_joint_gp(company_name):
    """공동GP 분리 - 쉼표, 슬래시, 줄바꿈으로 구분"""
    if not company_name:
        return []

    # 먼저 줄바꿈으로 분리
    lines = company_name.split('\n')

    companies = []
    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 쉼표로 분리
        if ',' in line:
            parts = line.split(',')
            companies.extend([p.strip() for p in parts if p.strip()])
        # 슬래시로 분리
        elif '/' in line:
            parts = line.split('/')
            companies.extend([p.strip() for p in parts if p.strip()])
        else:
            companies.append(line)

    return companies


def process_applications(applications):
    """신청현황 처리 - 공동GP 분리"""

    processed = []

    for app in applications:
        companies = split_joint_gp(app['company'])
        is_joint_gp = len(companies) > 1

        for company in companies:
            processed.append({
                'category': app['category'],
                'company': company,
                'amount_planned': app['amount_planned'],
                'amount_requested': app['amount_requested'],
                'is_joint_gp': is_joint_gp,
                'original_company': app['company'] if is_joint_gp else None
            })

    return processed


def summarize_by_category(processed):
    """분야별 요약"""
    summary = {}

    for app in processed:
        cat = app['category'] or '미분류'
        if cat not in summary:
            summary[cat] = []
        summary[cat].append(app['company'])

    return summary


def parse_selection_pdf(pdf_path):
    """선정결과 PDF 파싱"""
    selected = []
    current_category = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # 명시적 라인 기반 추출
            tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
            })

            if not tables:
                tables = page.extract_tables({
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                })

            for table in tables:
                for row in table:
                    if not row:
                        continue

                    # 셀 정리
                    cells = []
                    for cell in row:
                        if cell is None:
                            cells.append('')
                        else:
                            cells.append(str(cell).strip())

                    # 빈 행 건너뛰기
                    if all(c == '' for c in cells):
                        continue

                    # 헤더 행 건너뛰기
                    if any(header in str(cells) for header in ['운용사', '결성예정', '출자요청', '모태출자', '선정결과']):
                        continue

                    # 합계 행 건너뛰기
                    if cells[0] in ['계', '합계', '소계', '총계']:
                        continue

                    # 분야 감지
                    if cells[0] and cells[0] not in ['', '-'] and not re.match(r'^[\d,.\s]+$', cells[0]):
                        # 숫자가 아닌 첫 번째 셀은 분야일 가능성
                        if len(cells[0]) < 20:  # 너무 긴 건 회사명
                            current_category = cells[0]

                    # 회사명 추출 (보통 마지막 또는 두 번째 컬럼)
                    company_cell = None
                    for i, cell in enumerate(cells):
                        if cell and not re.match(r'^[\d,.\s%]+$', cell) and len(cell) > 2:
                            # 숫자가 아니고 길이가 2 이상인 셀
                            if '인베스트' in cell or '벤처' in cell or '파트너' in cell or '캐피탈' in cell:
                                company_cell = cell
                                break

                    if not company_cell:
                        # 마지막 비어있지 않은 셀
                        for cell in reversed(cells):
                            if cell and not re.match(r'^[\d,.\s%]+$', cell):
                                company_cell = cell
                                break

                    if not company_cell or company_cell in ['-', '']:
                        continue

                    # 금액 추출 (숫자 셀들)
                    amounts = []
                    for cell in cells:
                        if cell and re.match(r'^[\d,]+$', cell.replace(',', '')):
                            try:
                                amounts.append(float(cell.replace(',', '')))
                            except:
                                pass

                    selected.append({
                        'company': company_cell,
                        'category': current_category,
                        'amount_planned': amounts[0] if len(amounts) > 0 else None,
                        'amount_requested': amounts[1] if len(amounts) > 1 else None,
                    })

    # 공동GP 분리
    processed = process_applications([{'company': s['company'], 'category': s['category'],
                                       'amount_planned': s['amount_planned'],
                                       'amount_requested': s['amount_requested']} for s in selected])

    return processed


def main():
    if len(sys.argv) < 2:
        print("Usage: python pdf-parser.py <pdf_path> [--raw|--summary|--selection]", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    raw_mode = '--raw' in sys.argv
    summary_mode = '--summary' in sys.argv
    selection_mode = '--selection' in sys.argv

    if raw_mode:
        # 원본 표 데이터 출력
        results = extract_with_explicit_lines(pdf_path)
        print(json.dumps(results, ensure_ascii=False, indent=2))
    elif summary_mode:
        # 분야별 요약 출력
        applications = parse_application_pdf_v2(pdf_path)
        processed = process_applications(applications)
        summary = summarize_by_category(processed)

        print("=== 분야별 운용사 목록 ===\n")
        total = 0
        for cat in sorted(summary.keys()):
            print(f"[{cat}] ({len(summary[cat])}개)")
            for company in summary[cat]:
                print(f"  - {company}")
            print()
            total += len(summary[cat])

        print(f"=== 총 {total}개 ===")
    elif selection_mode:
        # 선정결과 PDF 파싱
        processed = parse_selection_pdf(pdf_path)

        output = {
            'type': 'selection',
            'total_operators': len(processed),
            'applications': processed
        }

        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        # 파싱된 신청현황 출력 (접수현황)
        applications = parse_application_pdf_v2(pdf_path)
        processed = process_applications(applications)

        # 결과 출력
        output = {
            'type': 'application',
            'total_funds': len(applications),
            'total_operators': len(processed),
            'applications': processed
        }

        print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

운용사 매칭 검증을 수행해주세요.

## 목적

PDF 원본과 Google Sheets 신청현황의 운용사 매칭이 정확한지 검증합니다.

## 검증 항목

1. **유사 매칭**: 이름이 다르지만 유사도로 매칭된 경우 (오매칭 가능성)
2. **누락**: PDF에 있는데 신청현황에 없음
3. **과잉 등록**: 신청현황에 있는데 PDF에 없음
4. **중복 운용사**: 같은 회사가 다른 이름으로 등록됨

## 수행 절차

1. **검증 스크립트 실행**
   ```bash
   GOOGLE_SPREADSHEET_ID=1UdCCcjwRf51k8xe81545rQ2VlmJkO5wDxg0SyCgfK2s node src/verify-operator-matching.js
   ```

2. **결과 분석**
   - 유사 매칭 항목 중 오매칭 여부 확인
   - PDF에만 있는 항목 중 실제 누락인지 확인 (헤더/노이즈 제외)
   - 중복 운용사 쌍 정리 필요 여부 판단

3. **문제 발견 시 보고**
   - 오매칭으로 의심되는 항목 목록
   - 실제 누락된 운용사 목록
   - 병합이 필요한 중복 운용사 쌍

## CLI 옵션

```bash
# 특정 출자사업만 검증
node src/verify-operator-matching.js --project PJ0001

# 특정 파일만 검증
node src/verify-operator-matching.js --file FH0044

# 유사도 임계값 조정 (기본 0.85)
node src/verify-operator-matching.js --threshold 0.7
```

## 인자 처리

- `$ARGUMENTS`가 있으면 해당 옵션으로 실행
  - 예: `/verify --project PJ0001`
  - 예: `/verify --threshold 0.7`

# Signal Guard REST API 명세

| 항목 | 내용 |
|------|------|
| 문서명 | 실시간 교통신호 상태정보 오류검지 시스템 내부 REST API 명세 |
| 프로젝트 | Signal Guard |
| 버전 | 0.1 |
| 작성일 | 2026-09-19 |
| 작성 | 기경현 (백엔드·데이터), 조찬희 (기획·PM, 화면·권한 교차) |
| 단계 | 설계 1주차 (전체 4주, WBS-3.5) |
| 근거 | IF-INT-001, 시스템아키텍처 10장, 화면IA `SCR-*`, ERD 엔터티, EN-API-01 |

---

## 개정 이력

| 버전 | 일자 | 작성 | 변경 내용 |
|------|------|------|-----------|
| 0.1 | 2026-09-19 | 기경현, 조찬희 | 최초 작성. `/api/v1` 경로·오류 형식·RBAC·필수 엔드포인트 확정. 원본 UPDATE API 없음 |

---

## 1. 개요

### 1.1 목적

본 문서는 웹 클라이언트가 호출하는 **내부 REST**를 고정한다. 구현(EN-API-01)과 테스트 케이스는 본 문서의 API ID(`API-*`)를 헤더에 적는다.

브라우저는 공공 실시간 API·UTIC를 직접 호출하지 않는다. 외부 연동은 워커(C-EXT) 몫이다.

### 1.2 문서 관계

```
요구사항 IF-INT-001 (웹—API 영역)
        │
        ▼
시스템아키텍처 10.1 (영역·최소 역할)
        │
        ├── 화면IA SCR-* / 프론트 라우트
        └── ERD 엔터티·코드 값
                │
                ▼
        본 문서 (경로·스키마·권한)     ← 내부 API 정본
                │
                ▼
        EN-API-01 골격 · 화면 연동 · API 테스트
```

| 구분 | 정본 |
|------|------|
| 무엇을 해야 하는가 | `분석/요구사항정의서.md` |
| 화면이 필요로 하는 호출 | `설계/화면IA.md` 9장 |
| 저장 필드 | `설계/ERD.md` |
| HTTP 경로·본문 | **본 문서** |
| OpenAPI YAML / 코드 스텁 | 구현 EN-API-01 |

### 1.3 범위

**포함**

- Base URL, 인증, 공통 오류, 페이지네이션
- 필수 화면·통제·설정에 필요한 엔드포인트
- 역할(OPERATOR / ADMIN)과 HTTP 403
- 만들지 않는 API (원본 수정, 신호기 전송)

**포함하지 않음**

- 외부 `/crsrd_map_info`, `/tl_drct_info` 래핑을 브라우저에 노출
- 웹소켓 프레임 (FR-MON-003-1, 선택)
- 물리 포트·CORS 화이트리스트 확정 (기동 README)
- JWT vs 세션 쿠키 구현체 (5주 게이트). 계약은 Bearer로 둔다

### 1.4 스택 중립

경로와 JSON은 Spring Boot / Node.js 어느 쪽이든 같다. 프레임워크 애노테이션은 적지 않는다.

---

## 2. 공통 규칙

### 2.1 Base

| 항목 | 값 |
|------|-----|
| Base path | `/api/v1` |
| 스키마 | HTTPS (수업 로컬은 HTTP 허용) |
| Content-Type | 요청·응답 `application/json; charset=utf-8` |
| CSV | `text/csv; charset=utf-8` |
| 시간 | ISO-8601, 타임존 포함 (`2026-09-19T12:04:11+09:00`) |
| JSON 필드 | camelCase. DB는 snake_case (ERD). 매핑은 서버 |
| 경로 ID | 내부 PK (`id`). `crsrdId`는 쿼리·본문 업무키 |
| 페이지 | `page` 1부터, `size` 기본 20 최대 100 |
| 정렬 | `sort=field,asc\|desc` |

프론트 라우트(`/dashboard`)와 API 경로(`/api/v1/...`)를 섞지 않는다.

### 2.2 인증

| 항목 | 규칙 |
|------|------|
| 로그인 | `API-AUTH-01`이 토큰을 발급 |
| 이후 요청 | `Authorization: Bearer <token>` |
| 만료 | 만료·위조 → 401 `AUTH_REQUIRED` |
| 비활성 계정 | 401 `AUTH_INACTIVE` |
| 헬스체크 | 인증 없음 (`API-HLTH-01`) |
| 그 외 `/api/v1/**` | 인증 필수 |

쿠키 세션으로 바꿔도 경로·본문은 유지한다. 토큰 원문을 로그에 남기지 않는다.

### 2.3 성공 봉투

단건:

```json
{ "data": { } }
```

목록:

```json
{
  "data": [ ],
  "meta": { "page": 1, "size": 20, "total": 128 }
}
```

CSV·204는 봉투를 쓰지 않는다.

### 2.4 오류 봉투 (EN-API-01)

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "이 작업은 관리자만 할 수 있습니다.",
    "details": [ { "field": "status", "reason": "ISSUE_TRANSITION_INVALID" } ]
  }
}
```

| HTTP | code | 언제 |
|------|------|------|
| 400 | `VALIDATION` | JSON 형식, 필수 필드 누락, enum 밖 |
| 401 | `AUTH_REQUIRED` | 토큰 없음·만료 |
| 401 | `AUTH_FAILED` | 로그인 실패 (아이디/비번 구분하지 않는 메시지) |
| 401 | `AUTH_INACTIVE` | 비활성 계정 |
| 403 | `FORBIDDEN` | 역할 부족. `audit_log` (`FORBIDDEN`) |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `CONFLICT` | `loginId` 중복 등 |
| 422 | `ISSUE_TRANSITION_INVALID` | 허용되지 않은 이슈 전이 |
| 422 | `R06_REQUIRES_FIELD_REQUEST` | 충돌 녹색을 정보 통제만으로 RESOLVED |
| 422 | `QUOTA_PROSPECT_EXCEEDED` | 주기·표본 저장 시 일 5,000 전망 초과 |
| 422 | `FIELD_SEND_NOT_ALLOWED` | `isActuallySent: true` 시도 |
| 500 | `INTERNAL` | 예외. 웹은 기동 유지 (NFR-QUR-001) |

`message`는 화면 표시용 한국어. `details[].reason`은 테스트 고정 문자열.

### 2.5 코드 값

ERD 5장과 동일하다. JSON에서는 아래 이름을 쓴다.

| JSON 필드 | ERD | 값 |
|-----------|-----|-----|
| `roleCode` | `role_code` | `OPERATOR` `ADMIN` |
| `severity` | `severity` | `INFO` `WARN` `ERROR` `CRITICAL` |
| `status` (이슈) | `issue_status` | `OPEN` `ACK` `IN_PROGRESS` `RESOLVED` `CLOSED` `FALSE_POSITIVE` |
| `directionCode` | `direction_code` | `nt` `et` `st` `wt` `ne` `se` `sw` `nw` |
| `signalKind` | `signal_kind` | `Stsg` `Ltsg` `Pdsg` `Utsg` `Bssg` `Bcsg` |
| `lightStatus` | `light_status` | `STOP_AND_REMAIN` `PROTECTED_MOVEMENT_ALLOWED` |
| `planSource` | `plan_source` | `UTIC` `MANUAL` `ESTIMATED` `SEED` |
| `mapStatus` | `map_status` | `UNMAPPED` `CANDIDATE` `CONFIRMED` |
| `controlType` | `control_type` | `AUTO_INFO` `MANUAL_INFO` `PLAN_UPDATE` `PUBLISH_BLOCK` `PUBLISH_UNBLOCK` `FIELD_REQUEST` |
| `grain` | `stat_grain` | `HOUR` `DAY` `WEEK` `MONTH` |

### 2.6 불변식 (API에 적용)

1. `signal_status_raw`를 바꾸거나 지우는 메서드가 없다.
2. 통제 POST는 제공 계층·`control_log`만 변경한다. 응답에 원본 해시(`rawPayloadHash`)를 실어 회귀 테스트가 비교한다.
3. 현장 요청 POST 이후 서버는 외부 신호기 HTTP를 호출하지 않는다. 응답 `isActuallySent`는 항상 `false`.
4. 운영자 토큰으로 관리자 메서드를 호출하면 403 + 감사 로그. 화면 숨김과 별개다.

---

## 3. 엔드포인트 일람

역할: O = OPERATOR 이상, A = ADMIN만, - = 인증 없음.

| ID | Method | Path | 역할 | 화면 | 우선 |
|----|--------|------|------|------|------|
| API-HLTH-01 | GET | `/health` | - | (운영) | 필수 |
| API-AUTH-01 | POST | `/auth/login` | - | SCR-LOGIN | 필수 |
| API-AUTH-02 | POST | `/auth/logout` | O | 셸 | 필수 |
| API-AUTH-03 | GET | `/auth/me` | O | 셸 | 필수 |
| API-DASH-01 | GET | `/dashboard/summary` | O | SCR-DASH, 헤더 | 필수 |
| API-DASH-02 | GET | `/dashboard/trend` | O | SCR-DASH | 필수 |
| API-INT-01 | GET | `/intersections` | O | SCR-INT-LIST | 필수 |
| API-INT-02 | GET | `/intersections/{id}` | O | SCR-INT-DETAIL | 필수 |
| API-INT-03 | POST | `/intersections/{id}/revalidate` | A | 계획·이슈 | 필수 |
| API-ISS-01 | GET | `/issues` | O | SCR-ISS-LIST, 배지 | 필수 |
| API-ISS-02 | GET | `/issues/{id}` | O | SCR-ISS-DETAIL | 필수 |
| API-ISS-03 | POST | `/issues/{id}/comments` | O | SCR-ISS-DETAIL | 필수 |
| API-ISS-04 | PATCH | `/issues/{id}/status` | A | SCR-ISS-DETAIL | 필수 |
| API-ISS-05 | PATCH | `/issues/{id}/assignee` | A | SCR-ISS-DETAIL | 필수 |
| API-ISS-06 | POST | `/issues/{id}/info-controls` | A | SCR-ISS-DETAIL | 필수 |
| API-ISS-07 | POST | `/issues/{id}/publish-blocks` | A | SCR-ISS-DETAIL | 필수 |
| API-ISS-08 | POST | `/issues/{id}/field-requests` | A | SCR-ISS-DETAIL | 필수 |
| API-PLN-01 | GET | `/plans` | O | SCR-PLAN-LIST | 필수 |
| API-PLN-02 | GET | `/plans/{id}` | O | SCR-PLAN-DETAIL | 필수 |
| API-PLN-03 | PUT | `/plans/{id}` | A | SCR-PLAN-DETAIL | 필수 |
| API-MAP-01 | GET | `/id-maps` | A | SCR-PLAN-MAP | 필수 |
| API-MAP-02 | POST | `/id-maps/{id}/confirm` | A | SCR-PLAN-MAP | 필수 |
| API-MAP-03 | POST | `/id-maps/{id}/unconfirm` | A | SCR-PLAN-MAP | 필수 |
| API-STA-01 | GET | `/stats` | O | SCR-STAT | 필수 |
| API-STA-02 | GET | `/stats/export` | O | SCR-STAT | 필수 |
| API-CTL-01 | GET | `/controls` | O | SCR-CTL | 필수 |
| API-QTA-01 | GET | `/quota` | O | 헤더, SCR-SET-COL | 필수 |
| API-QTA-02 | GET | `/quota/prospect` | A | SCR-SET-COL | 필수 |
| API-SET-01 | GET | `/settings` | A | SCR-SET-COL | 필수 |
| API-SET-02 | PUT | `/settings` | A | SCR-SET-COL | 필수 |
| API-TGT-01 | GET | `/collection-targets` | A | SCR-SET-COL | 필수 |
| API-TGT-02 | PUT | `/collection-targets/{intersectionId}` | A | SCR-SET-COL | 필수 |
| API-RUL-01 | GET | `/rules` | A | SCR-SET-RULE | 필수 |
| API-RUL-02 | PUT | `/rules/{ruleCode}/thresholds` | A | SCR-SET-RULE | 필수 |
| API-USR-01 | GET | `/users` | A | SCR-SET-ACC | 필수 |
| API-USR-02 | POST | `/users` | A | SCR-SET-ACC | 필수 |
| API-USR-03 | PATCH | `/users/{id}` | A | SCR-SET-ACC | 필수 |
| API-USR-04 | DELETE | `/users/{id}` | A | SCR-SET-ACC | 필수 |
| API-WAT-01 | GET | `/watch-exclusions` | A | SCR-SET-WATCH | 중요 |
| API-WAT-02 | POST | `/watch-exclusions` | A | SCR-SET-WATCH | 중요 |
| API-WAT-03 | DELETE | `/watch-exclusions/{id}` | A | SCR-SET-WATCH | 중요 |

위 표의 Path는 모두 `/api/v1` 접두를 붙인다.

---

## 4. 인증 · 헬스

### 4.1 API-HLTH-01 헬스체크

`GET /api/v1/health`

```json
{ "data": { "status": "UP", "time": "2026-09-19T12:04:11+09:00" } }
```

DB 다운이어도 프로세스가 떠 있으면 `status: "DEGRADED"`를 허용한다. 수집 워커 상태는 대시보드가 본다.

### 4.2 API-AUTH-01 로그인

`POST /api/v1/auth/login`

요청:

```json
{ "loginId": "admin", "password": "********" }
```

성공 200:

```json
{
  "data": {
    "token": "<opaque-or-jwt>",
    "tokenType": "Bearer",
    "expiresAt": "2026-09-19T20:04:11+09:00",
    "user": {
      "id": 1,
      "loginId": "admin",
      "displayName": "관리자",
      "roleCode": "ADMIN"
    }
  }
}
```

실패 401 `AUTH_FAILED`. 메시지 예: `"로그인 정보가 올바르지 않습니다."`  
실패는 `audit_log` (`LOGIN_FAIL`). 비밀번호를 로그하지 않는다.

### 4.3 API-AUTH-02 로그아웃

`POST /api/v1/auth/logout`  
본문 없음. 204. 서버가 토큰을 무효화할 수 있으면 한다.

### 4.4 API-AUTH-03 현재 사용자

`GET /api/v1/auth/me`  
`data`는 로그인 응답의 `user`와 동일.

---

## 5. 대시보드 · 쿼터

헤더 폴링은 `API-DASH-01` 또는 `API-QTA-01` + `API-ISS-01`(size=1, 미종료 카운트는 summary에 포함)로 맞춘다. **권장: 30초마다 `API-DASH-01` 한 번.**

### 5.1 API-DASH-01 종합 지표

`GET /api/v1/dashboard/summary`

엔터티: `signal_status_current`, `quota_daily`, `issue`, `control_log`, `collection_batch`

```json
{
  "data": {
    "intersectionCounts": {
      "total": 30,
      "normal": 24,
      "warn": 4,
      "error": 2,
      "critical": 1
    },
    "openIssueCount": 3,
    "autoCorrectCountToday": 12,
    "receiveDelaySec": 8,
    "lastReceivedAt": "2026-09-19T12:04:11+09:00",
    "quota": { "used": 2880, "limit": 5000, "isStopped": false },
    "lastBatch": {
      "id": 91,
      "batchType": "STATUS",
      "batchStatus": "PARTIAL",
      "startedAt": "2026-09-19T12:04:00+09:00",
      "successCount": 29,
      "failCount": 1
    },
    "pollingSec": 30
  }
}
```

집계 규칙:

| 필드 | 규칙 |
|------|------|
| `normal` | 표본 중 최고 등급이 없거나 INFO |
| `warn` / `error` / `critical` | 교차로 최고 `severity` |
| `openIssueCount` | 상태가 `CLOSED` `FALSE_POSITIVE`가 아닌 건수 |
| `autoCorrectCountToday` | 당일 `control_type = AUTO_INFO` |
| `receiveDelaySec` | now − `lastReceivedAt` (초). 수집 없으면 `null` |

KPI 카드 클릭용 딥링크는 프론트 라우트다. 본 API는 숫자만 준다.

### 5.2 API-DASH-02 시간대 추이

`GET /api/v1/dashboard/trend?grain=HOUR&from=&to=`

기본: 오늘 00:00~(KST), `HOUR`.

`data[]`: `{ "periodStart", "warnCount", "errorCount", "criticalCount" }`  
원본은 `stat_bucket`. 버킷이 없으면 빈 배열이 아니라 기간 슬롯을 0으로 채우거나, 화면 빈 상태용으로 `meta.emptyReason: "AGG_PENDING"`을 둔다. **권장:** 슬롯 0 채움 + `meta.aggregated: false`이면 화면이 “집계 대기”를 띄운다.

### 5.3 API-QTA-01 당일 쿼터

`GET /api/v1/quota`

```json
{ "data": { "usageDate": "2026-09-19", "used": 2880, "limit": 5000, "isStopped": false } }
```

운영자도 호출한다 (대시보드).

### 5.4 API-QTA-02 쿼터 전망 (관리자)

`GET /api/v1/quota/prospect?intervalMin=10&targetCount=30`

```json
{
  "data": {
    "callsPerDay": 4320,
    "limit": 5000,
    "exceeds": false,
    "mapCallsExtra": 1
  }
}
```

산정식은 아키텍처 12.1. `exceeds=true`면 설정 저장(`API-SET-02` / `API-TGT-02`)이 422 `QUOTA_PROSPECT_EXCEEDED`를 줄 수 있다.

---

## 6. 교차로

### 6.1 API-INT-01 목록

`GET /api/v1/intersections`

| 쿼리 | 설명 |
|------|------|
| `q` | 명칭·`crsrdId` 부분 일치 |
| `severity` | 최고 등급 필터 |
| `blocked` | `true`면 제공 중지 포함 교차로만 |
| `mapStatus` | `UNMAPPED` `CANDIDATE` `CONFIRMED` |
| `collected` | `true`면 수집 대상만 |
| `page` `size` `sort` | 기본 `severity,desc` |

행:

```json
{
  "id": 12,
  "crsrdId": "3142",
  "crsrdNm": "부평역앞",
  "lclgvNm": "인천광역시",
  "severity": "CRITICAL",
  "isBlocked": true,
  "mapStatus": "CONFIRMED",
  "openIssueCount": 1,
  "lastReceivedAt": "2026-09-19T12:04:11+09:00",
  "isCollectionTarget": true
}
```

### 6.2 API-INT-02 상세 (원본/제공 병기)

`GET /api/v1/intersections/{id}`

SCR-INT-DETAIL 1회 조회로 3초를 맞춘다. 원본 JSON 전문을 8방향 전부 풀지 않고, **방향×현시 제공 행 + lastRaw 요약**을 준다.

```json
{
  "data": {
    "intersection": {
      "id": 12,
      "crsrdId": "3142",
      "crsrdNm": "부평역앞",
      "lclgvNm": "인천광역시",
      "lat": "37.489",
      "lon": "126.724",
      "isOperating": true
    },
    "mapStatus": "CONFIRMED",
    "watchExcluded": false,
    "severity": "CRITICAL",
    "isBlocked": true,
    "isEstimated": true,
    "lastReceivedAt": "2026-09-19T12:04:11+09:00",
    "planSummary": {
      "planId": 4,
      "planSource": "SEED",
      "cycleSec": 120,
      "expectedNote": "직진 녹 유지 30s",
      "compared": true
    },
    "directions": [
      {
        "directionCode": "nt",
        "signals": [
          {
            "signalKind": "Stsg",
            "provided": {
              "remainingSec": 28,
              "lightStatus": "PROTECTED_MOVEMENT_ALLOWED",
              "isBlocked": true,
              "isEstimated": true
            },
            "raw": {
              "remainingCs": 2800,
              "lightStatusRaw": "protected-Movement-Allowed",
              "rawId": 8801,
              "payloadHash": "a1b2…",
              "receivedAt": "2026-09-19T12:04:11+09:00"
            }
          }
        ]
      }
    ],
    "validations": [
      { "id": 501, "ruleCode": "R06", "severity": "CRITICAL", "createdAt": "2026-09-19T12:04:11+09:00", "message": "충돌 현시 동시 녹색" }
    ],
    "openIssues": [
      { "id": 142, "ruleCode": "R06", "severity": "CRITICAL", "status": "OPEN" }
    ],
    "recentControls": [
      { "id": 77, "controlType": "PUBLISH_BLOCK", "createdAt": "2026-09-19T12:04:12+09:00" }
    ]
  }
}
```

`planSummary.compared=false`이면 미매핑으로 계획 대조를 생략한 것이다. 캡션은 화면 책임.

`raw.payloadHash`는 통제 전후 비교용. `payload_json` 전문은 기본 응답에 넣지 않는다 (용량). 감사 화면이 필요하면 `?includeRawPayload=true`(관리자)로 확장한다. 1차는 해시+센티초면 수용 기준을 만족한다.

이 응답은 **조회만**. 제공 값을 바꾸는 필드가 없다.

### 6.3 API-INT-03 교차로 재검증

`POST /api/v1/intersections/{id}/revalidate`  
본문 선택: `{ "issueId": 142 }`  
202 또는 200. `data: { "accepted": true, "batchId": 92 }`  
워커/동일 엔진을 해당 교차로만 실행 (UC03 A1). 원본 INSERT 없이 최신 raw를 다시 판정해도 된다. **raw UPDATE 금지.**

---

## 7. 이슈 · 통제

이슈 생성은 사람 API가 아니다. 엔진(UC05)만 INSERT한다.

### 7.1 API-ISS-01 목록

`GET /api/v1/issues`

| 쿼리 | 설명 |
|------|------|
| `status` | 콤마 구분. 기본 미종료(`OPEN,ACK,IN_PROGRESS`) |
| `severity` | |
| `ruleCode` | `R06` |
| `intersectionId` | |
| `from` `to` | `openedAt` |
| `page` `size` | |
| `sort` | 기본 `severity,desc` 후 `updatedAt,desc` |

행: `id, intersectionId, crsrdNm, directionCode, signalKind, ruleCode, severity, status, openedAt, assigneeDisplayName`.

헤더 배지: `GET /issues?status=OPEN,ACK,IN_PROGRESS&size=1`의 `meta.total` 또는 summary의 `openIssueCount`.

### 7.2 API-ISS-02 상세

`GET /api/v1/issues/{id}`

```json
{
  "data": {
    "id": 142,
    "intersectionId": 12,
    "crsrdNm": "부평역앞",
    "directionCode": "nt",
    "signalKind": "Stsg",
    "ruleCode": "R06",
    "severity": "CRITICAL",
    "status": "OPEN",
    "openedAt": "2026-09-19T12:04:11+09:00",
    "estimatedCause": "충돌 현시 동시 녹색",
    "assignee": { "id": null, "displayName": null },
    "rawSnapshot": { },
    "providedSnapshot": { },
    "history": [
      { "fromStatus": null, "toStatus": "OPEN", "actorType": "SYSTEM", "comment": null, "createdAt": "2026-09-19T12:04:11+09:00" }
    ],
    "fieldRequests": [
      { "id": 9, "status": "OPEN", "requestBody": "충돌 현시 해제 확인", "isActuallySent": false, "createdAt": "…" }
    ],
    "planId": 4
  }
}
```

스냅샷 JSON은 이슈 생성 이후 **이 API로 수정하지 않는다.**

### 7.3 API-ISS-03 코멘트

`POST /api/v1/issues/{id}/comments`  
역할: OPERATOR, ADMIN

```json
{ "comment": "현장 제보 대기" }
```

201. `issue_history`에 상태 변화 없이 코멘트 행을 남긴다 (`toStatus` = 현재 상태, `actorType` OPERATOR 또는 ADMIN).

### 7.4 API-ISS-04 상태 전이

`PATCH /api/v1/issues/{id}/status`  
ADMIN

```json
{ "status": "ACK", "comment": "확인" }
```

허용 전이 (ERD 5.3):

```
OPEN → ACK → IN_PROGRESS → RESOLVED → CLOSED
OPEN → FALSE_POSITIVE → CLOSED
ACK | IN_PROGRESS → FALSE_POSITIVE → CLOSED
```

그 외 422 `ISSUE_TRANSITION_INVALID` + 감사.

**R06 가드:** `ruleCode=R06` 이고 목표 상태가 `RESOLVED` 또는 `CLOSED`이며 `FALSE_POSITIVE`가 아니면, 연결된 `field_control_request`가 1건 이상 있어야 한다. 없으면 422 `R06_REQUIRES_FIELD_REQUEST`. 정보 통제만으로는 통과하지 않는다.

### 7.5 API-ISS-05 담당

`PATCH /api/v1/issues/{id}/assignee`  
`{ "assigneeId": 1 }` 또는 `{ "assigneeId": null }`  
ADMIN.

### 7.6 API-ISS-06 정보 통제

`POST /api/v1/issues/{id}/info-controls`  
ADMIN. `control_type = MANUAL_INFO`.

```json
{
  "directionCode": "nt",
  "signalKind": "Stsg",
  "remainingSec": 30,
  "lightStatus": "PROTECTED_MOVEMENT_ALLOWED",
  "isEstimated": false,
  "comment": "급변 값 대체"
}
```

200 `data`:

```json
{
  "controlId": 78,
  "controlType": "MANUAL_INFO",
  "rawPayloadHashBefore": "a1b2…",
  "rawPayloadHashAfter": "a1b2…",
  "providedBefore": { "remainingSec": 3, "lightStatus": "PROTECTED_MOVEMENT_ALLOWED" },
  "providedAfter": { "remainingSec": 30, "lightStatus": "PROTECTED_MOVEMENT_ALLOWED" }
}
```

두 해시가 같아야 테스트가 통과한다. 서버는 재검증을 이어서 돌린다 (UC07).

OPERATOR → 403.

### 7.7 API-ISS-07 제공 차단·해제

`POST /api/v1/issues/{id}/publish-blocks`  
ADMIN

```json
{ "blocked": true, "directionCode": null, "signalKind": null, "comment": "R06 제공 중지" }
```

`blocked: false`면 `PUBLISH_UNBLOCK`. `directionCode` null은 교차로 전체.

R06 이슈에서 `blocked: true`가 기본 동작이다 (FR-CTL-004). 해제는 관리자 명시 호출.

해시 병기는 7.6과 같다.

### 7.8 API-ISS-08 현장 통제 요청

`POST /api/v1/issues/{id}/field-requests`  
ADMIN. 화면 IA 미결 7 정본.

```json
{
  "directionCode": "nt",
  "requestBody": "충돌 현시 해제 확인 요청",
  "blockPublish": true
}
```

규칙:

- `isActuallySent` 필드를 받더라도 `true`면 422 `FIELD_SEND_NOT_ALLOWED`. 서버는 항상 `false`로 INSERT.
- `blockPublish` 기본 `true`. true면 제공 차단을 같은 트랜잭션에서 수행.
- 신호기·외부 HTTP 클라이언트 호출 0건 (테스트 수용).
- 응답에 `isActuallySent: false`를 명시한다.

```json
{
  "data": {
    "id": 9,
    "issueId": 142,
    "status": "OPEN",
    "isActuallySent": false,
    "controlId": 79,
    "blocked": true
  }
}
```

현장 요청 상태 ACK/DONE은 1차에서 `API-ISS-04` 코멘트·이슈 종료로 대체해도 된다. 별도 PATCH는 구현 여유 시 `PATCH /field-requests/{id}` (`status`만, ADMIN).

---

## 8. 신호 계획 · ID 매핑

### 8.1 API-PLN-01 목록

`GET /api/v1/plans?source=&mapStatus=&q=&page=&size=`

행: `id, intersectionId, crsrdNm, planSource, planType, mapStatus, cycleSec, isActive, updatedAt`.

### 8.2 API-PLN-02 상세

`GET /api/v1/plans/{id}`

```json
{
  "data": {
    "id": 4,
    "intersectionId": 12,
    "planSource": "SEED",
    "planType": "OPERATING",
    "daysMask": "1111111",
    "validFrom": "2026-01-01T00:00:00+09:00",
    "validTo": null,
    "cycleSec": 120,
    "offsetSec": 0,
    "isActive": true,
    "phases": [
      { "id": 1, "seqNo": 1, "directionCode": "nt", "signalKind": "Stsg", "durationSec": 30, "ringCode": "A" }
    ],
    "conflicts": [
      { "id": 1, "phaseAId": 1, "phaseBId": 5, "note": "직진 vs 횡단" }
    ]
  }
}
```

운영자 GET 가능. 수정 필드가 응답에 있어도 PUT은 403.

### 8.3 API-PLN-03 계획 통제

`PUT /api/v1/plans/{id}`  
ADMIN

본문은 8.2에서 `id`를 뺀 쓰기 집합 + 선택 `{ "issueId": 142 }`.  
현시 배열은 **전체 교체**. 빈 배열은 400.

사후:

1. `signal_plan` / `phase` 갱신
2. `control_log` `PLAN_UPDATE`
3. `audit_log` `PLAN_UPDATE`
4. 해당 교차로 재검증 (`API-INT-03`과 동일 엔진)
5. 원본 raw 불변

`issueId`가 있으면 이슈 `last_action`만 갱신한다. 상태 전이는 관리자가 `API-ISS-04`로 한다.

### 8.4 매핑 API-MAP-01~03

`GET /api/v1/id-maps?mapStatus=&q=`  
ADMIN (운영자는 계획 목록의 `mapStatus` 조회로 충분)

행: `id, intersectionId, crsrdNm, uticIntNo, uticIntNm, mapStatus, matchMethod, isConfirmed`.

`POST /api/v1/id-maps/{id}/confirm`  
`POST /api/v1/id-maps/{id}/unconfirm`  
본문 없음. 확정 시 `CONFIRMED`, 해제 시 `UNMAPPED`. 해제된 교차로는 이후 계획 대조를 생략한다.

후보 제시(이름·좌표)는 GET 목록의 `mapStatus=CANDIDATE`로 본다. 별도 추천 엔진 API는 1차에 두지 않는다.

---

## 9. 통계 · 통제 이력

### 9.1 API-STA-01 집계 조회

`GET /api/v1/stats?grain=WEEK&from=&to=&intersectionId=&ruleCode=`

`data`:

```json
{
  "kpis": {
    "sampleCount": 12000,
    "errorCount": 86,
    "errorRate": 0.0072,
    "autoCorrectCount": 40,
    "manualControlCount": 12,
    "criticalCount": 2
  },
  "byIntersection": [ { "intersectionId": 12, "crsrdNm": "부평역앞", "errorCount": 20 } ],
  "byRule": [ { "ruleCode": "R03", "errorCount": 15 } ],
  "series": [ { "periodStart": "2026-09-13T00:00:00+09:00", "errorCount": 10 } ]
}
```

원본 풀스캔 금지. `stat_bucket`만. 버킷 없으면 200 + `kpis` 0 + `meta.emptyReason: "AGG_PENDING"` (요구 UC08 E1).

### 9.2 API-STA-02 CSV

`GET /api/v1/stats/export`  
쿼리는 9.1과 **동일**.  
응답 헤더: `Content-Disposition: attachment; filename="signal-guard-stats.csv"`  
본문은 화면 필터와 같은 행. 인증 필수.

### 9.3 API-CTL-01 통제 이력

`GET /api/v1/controls?type=&intersectionId=&issueId=&from=&to=&page=&size=`

`type` = `controlType`.

행:

```json
{
  "id": 78,
  "controlType": "MANUAL_INFO",
  "actorType": "ADMIN",
  "actorDisplayName": "관리자",
  "intersectionId": 12,
  "crsrdNm": "부평역앞",
  "ruleCode": "R03",
  "issueId": 140,
  "before": { },
  "after": { },
  "rawPayloadHash": "a1b2…",
  "createdAt": "2026-09-19T12:10:00+09:00"
}
```

**POST/PATCH/DELETE 없음.** 쓰기는 이슈·계획 API만.

---

## 10. 설정 · 계정

전부 ADMIN. OPERATOR는 403.

### 10.1 설정 키

| settingKey | 의미 | 예 |
|------------|------|-----|
| `statusIntervalMin` | 상태 수집 주기(분) | `"15"` |
| `mapIntervalMin` | 맵 수집 주기 | `"180"` |
| `quotaLimit` | 일한도 | `"5000"` |
| `quotaTz` | 쿼터 일자 기준 | `"Asia/Seoul"` |
| `pollingSec` | 화면 폴링(초) | `"30"` |

임계값 숫자는 이 테이블이 아니라 `rule_threshold` (`API-RUL-*`).

`GET /api/v1/settings` → `data: [ { key, value, updatedAt } ]`  
`PUT /api/v1/settings` → `{ "settings": [ { "key": "statusIntervalMin", "value": "10" } ] }`

일 호출 전망이 한도를 넘으면 422 `QUOTA_PROSPECT_EXCEEDED`. `audit_log` `SETTING_CHANGE` 전후 값.

### 10.2 수집 대상

`GET /api/v1/collection-targets`  
`data[]`: `{ intersectionId, crsrdNm, isEnabled, priority }`

`PUT /api/v1/collection-targets/{intersectionId}`

```json
{ "isEnabled": true, "priority": 10 }
```

다음 주기부터 반영 (FR-SYS-002). 전망 초과 시 422.

### 10.3 규칙 임계값

`GET /api/v1/rules`  
`data[]`: `{ ruleCode, name, defaultSeverity, canAutoCorrect, thresholds: [ { paramName, paramValue } ] }`

`PUT /api/v1/rules/{ruleCode}/thresholds`

```json
{ "thresholds": [ { "paramName": "remainExtraSec", "paramValue": "5" } ] }
```

다음 검증부터 반영. 코드 배포 없음.

### 10.4 계정

`GET /api/v1/users` — `passwordHash` 없음.

`POST /api/v1/users`

```json
{ "loginId": "op1", "password": "********", "displayName": "운영자", "roleCode": "OPERATOR" }
```

201. 비밀번호는 해시 저장.

`PATCH /api/v1/users/{id}` — `displayName`, `roleCode`, `isActive`, `password`(선택).

`DELETE /api/v1/users/{id}` — 204. 자기 자신 삭제 400 `VALIDATION`. 운영자가 호출하면 403.

### 10.5 감시 제외 (중요)

`GET /api/v1/watch-exclusions`  
`POST` `{ "intersectionId", "startAt", "endAt", "reason" }`  
`DELETE /api/v1/watch-exclusions/{id}` — 기간을 지금으로 끝내는 것과 동일하게 취급.

MVP 커트 시 이 세 개만 빼도 설정 화면은 성립한다.

---

## 11. 화면 × API

| 화면 | 호출 |
|------|------|
| SCR-LOGIN | AUTH-01 |
| 셸 헤더 | DASH-01 (또는 QTA-01 + AUTH-03) |
| SCR-DASH | DASH-01, DASH-02, ISS-01(최근) |
| SCR-INT-LIST | INT-01 |
| SCR-INT-DETAIL | INT-02 |
| SCR-ISS-LIST | ISS-01 |
| SCR-ISS-DETAIL | ISS-02, ISS-03; 관리자 ISS-04~08, PLN-02 |
| SCR-PLAN-LIST | PLN-01 |
| SCR-PLAN-DETAIL | PLN-02, PLN-03, INT-03 |
| SCR-PLAN-MAP | MAP-01~03 |
| SCR-STAT | STA-01, STA-02 |
| SCR-CTL | CTL-01 |
| SCR-SET-COL | SET-*, TGT-*, QTA-01, QTA-02 |
| SCR-SET-RULE | RUL-01, RUL-02 |
| SCR-SET-ACC | USR-* |
| SCR-SET-WATCH | WAT-* |

폴링 대상: DASH-01, ISS-01, INT-02(상세을 연 동안). 주기는 `settings.pollingSec`.

---

## 12. RBAC 요약

| 메서드 성격 | OPERATOR | ADMIN |
|-------------|----------|-------|
| GET 조회 (설정·계정·매핑 제외) | ○ | ○ |
| GET `/settings` `/users` `/id-maps` `/rules` `/collection-targets` `/watch-exclusions` | 403 | ○ |
| POST `/issues/{id}/comments` | ○ | ○ |
| PATCH 이슈 상태·담당, 통제 POST, 계획 PUT, 설정·계정 | 403 + audit | ○ |
| 원본 수정 | 없음 | 없음 |

테스트 최소 세트 (WBS 5.3):

1. 운영자 토큰으로 `API-ISS-06` → 403
2. 관리자 정보 통제 전후 `rawPayloadHash` 동일
3. `API-ISS-08` 후 신호기 HTTP 0건, `isActuallySent=false`
4. R06을 정보 통제 후 `RESOLVED` → 422
5. 비로그인 `GET /dashboard/summary` → 401

---

## 13. 요구사항 추적

| 요구 | API |
|------|-----|
| FR-ADM-001 | AUTH-*, USR-*, 403 |
| FR-MON-001 | DASH-01, DASH-02 |
| FR-MON-002, FR-CTL-001 | INT-02 |
| FR-MON-003 | ISS-01 |
| FR-MON-004 | STA-01, STA-02 |
| FR-MON-005, FR-CTL-003 | PLN-* |
| FR-ISS-002 | ISS-03, ISS-04 |
| FR-CTL-002 | ISS-06, ISS-07 |
| FR-CTL-004 | ISS-08 |
| FR-CTL-005 | CTL-01, 통제 응답 해시 |
| FR-COL-005 | QTA-*, SET-02 전망 |
| FR-ADM-002, FR-VAL-001 | RUL-*, SET-*, TGT-* |
| FR-PLN-004 | MAP-* |
| FR-ISS-004 | WAT-* |
| NFR-SEC-001 | 2.2, 12장 |
| NFR-PER-001 | 상세 1회(INT-02), 통계는 bucket |
| CON-003 | 15장, ISS-08 |
| IF-INT-001 | 본 문서 전체 |
| DAR-N-004 | raw 메서드 없음 |

| UC | API |
|----|-----|
| UC06 | DASH-*, INT-*, ISS-01 |
| UC07 | ISS-04~08, PLN-03, INT-03 |
| UC08 | STA-* |
| UC09 | AUTH-*, USR-* |
| UC10 | SET-*, TGT-*, RUL-*, QTA-* |
| UC11 | INT-02, CTL-01 |

---

## 14. 만들지 않는 API

아래를 구현하거나 “추후 확장”으로 열어 두지 않는다. 있으면 결함이다.

| 금지 | 이유 |
|------|------|
| `PUT/PATCH/DELETE /signal-status-raw` 및 동등 | 원본 불변 |
| `POST /field-signals/send`, 신호기 IP·점등 명령 | CON-003 |
| `GET /secrets`, `serviceKey` 응답 | NFR-SEC-002 |
| 브라우저 → 공공데이터포털 프록시 GET | 키 유출, 쿼터 우회 |
| 이슈 `POST /issues` (수동 생성) | 엔진만 생성. 수업 픽스처는 시드/워커 |
| 통제 이력 DELETE | append-only |
| 웹소켓 `/ws` | 선택. 넣어도 본 REST는 유지 |

---

## 15. 설계 결정 · 미결

### 15.1 이번에 고정한 것

1. Base path는 `/api/v1`이다.
2. JSON camelCase, 오류 봉투 `error.code`, 목록 `meta.page`.
3. 인증은 Bearer. 헬스체크만 공개.
4. 교차로 상세는 한 번의 GET에 제공+원본 요약+검증+이슈를 담는다.
5. 사람 통제는 이슈 하위 POST 세 개(정보 / 차단 / 현장)와 계획 PUT이다.
6. 현장 요청 본문에 전송 플래그를 켜면 422이다.
7. R06 종료는 현장 요청이 선행한다.
8. 통제 이력 컬렉션은 GET only.

### 15.2 구현 시 고를 것 (계약은 유지)

| No | 항목 | 영향 |
|----|------|------|
| A1 | JWT vs opaque 토큰 vs 세션 쿠키 | AUTH-01 구현체 |
| A2 | 재검증을 동기(200) vs 202 수락 | INT-03 대기 시간 |
| A3 | `includeRawPayload` 쿼리 | 상세 용량 |
| A4 | 현장 요청 상태 PATCH | 여유 |
| A5 | OpenAPI 파일 생성 | EN-API-01 산출 형식 |

스택(React/Vue, Spring/Node)이 바뀌어도 **경로·필드·권한 ID는 유지**한다.

---

## 16. 다음 산출물

| 산출 | 본 문서 사용법 |
|------|----------------|
| EN-API-01 | 오류 미들웨어, 401/403, 헬스체크부터 |
| EN-FE-01 | 11장 화면 호출, Bearer 헤더 |
| 검증 규칙 명세 (WBS-3.6) | 엔진 입출력. 본 REST의 재검증이 그 엔진을 호출 |
| API 테스트 (WBS 5.3) | 12장 최소 세트 + 본문 예 |

---

## 17. 검수 체크리스트

- [ ] IF-INT-001 영역이 3장 표에 모두 있다
- [ ] 운영자 통제 POST가 403으로 적혀 있다
- [ ] 원본 UPDATE 경로가 없다
- [ ] 현장 요청에 실전송 API가 없고 `isActuallySent=false`다
- [ ] R06 종료 가드가 있다
- [ ] 교차로 상세에 원본/제공 병기가 있다
- [ ] 통계는 집계 GET + 동일 필터 CSV다
- [ ] 쿼터 GET을 운영자가 호출할 수 있다
- [ ] 화면IA `SCR-*`와 11장이 맞다
- [ ] ERD 코드 값이 2.5와 같다

---

## 18. 참고

- 분석/요구사항정의서.md — IF-INT-001, FR-MON/ISS/CTL/ADM, NFR-SEC
- 설계/시스템아키텍처.md — 10장 영역, C-* 컴포넌트
- 설계/화면IA.md — SCR-*, 통제 패널, 프론트 라우트
- 설계/ERD.md — 엔터티·코드·쓰기 규칙
- 분석/유스케이스사용자스토리.md — UC06~UC11
- 백로그WBS.md — WBS-3.5, EN-API-01

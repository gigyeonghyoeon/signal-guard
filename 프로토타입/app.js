/* Signal Guard 클릭 프로토타입. 화면 IA 0.1의 SCR-* 를 따른다. */
var state = {
  user: null,
  data: null,
  users: null,
  path: "/login",
  query: {},
  bootedAt: Date.now(),
  pollAgo: 4,
  ui: { dir: {}, diagonal: false, logOpen: {}, controlMode: {} },
  modal: null,
  pending: null,
  formError: "",
  loginError: "",
  errPath: ""
};

var SEV_LABEL = { OK: "정상", INFO: "정보", WARN: "경고", ERROR: "오류", CRITICAL: "치명" };
var SEV_RANK = { CRITICAL: 0, ERROR: 1, WARN: 2, INFO: 3, OK: 4 };
var STATUS_LABEL = { OPEN: "열림", ACK: "확인", IN_PROGRESS: "진행", RESOLVED: "해결", CLOSED: "종료", FALSE_POSITIVE: "오탐" };
var ACTIVE = { OPEN: 1, ACK: 1, IN_PROGRESS: 1 };
var TYPE_LABEL = {
  AUTO_INFO: "자동 정보 통제",
  MANUAL_INFO: "수동 정보 통제",
  PLAN_UPDATE: "계획 수정",
  PUBLISH_BLOCK: "제공 차단",
  FIELD_REQUEST: "현장 통제 요청"
};
var DIR_LABEL = { nt: "북", et: "동", st: "남", wt: "서", ne: "북동", se: "남동", sw: "남서", nw: "북서" };
var MOV_LABEL = { Stsg: "직진", Ltsg: "좌회전", Pdsg: "보행" };
var CARDINAL = ["nt", "et", "st", "wt"];
var DIAG = ["ne", "se", "sw", "nw"];

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function num(n) { return Number(n || 0).toLocaleString("ko-KR"); }
function clock(s) { return String(s || "").slice(-8); }
function pad(n) { return String(n).padStart(2, "0"); }
function nowLabel() {
  var add = Math.floor((Date.now() - state.bootedAt) / 1000);
  var base = 12 * 3600 + 4 * 60 + 11 + add;
  return "2026-09-27 " + pad(Math.floor(base / 3600) % 24) + ":" + pad(Math.floor(base / 60) % 60) + ":" + pad(base % 60);
}
function roleLabel(role) { return role === "ADMIN" ? "관리자" : "운영자"; }
function isAdmin() { return state.user && state.user.role === "ADMIN"; }
function isWide() { return window.matchMedia("(min-width: 1280px)").matches; }

function interById(id) {
  return state.data.intersections.find(function (x) { return x.id === id; });
}
function interName(id) {
  var x = interById(id);
  return x ? x.name : id;
}
function issueById(id) {
  return state.data.issues.find(function (x) { return x.id === id; });
}
function planOf(interId) {
  return state.data.plans.find(function (x) { return x.intersectionId === interId; });
}
function planById(id) {
  return state.data.plans.find(function (x) { return x.id === id; });
}
function activeIssues(interId) {
  return state.data.issues.filter(function (i) {
    if (!ACTIVE[i.status]) return false;
    return !interId || i.intersectionId === interId;
  });
}
function shownSec(inter, dir, mov) {
  var slot = inter.directions[dir] && inter.directions[dir][mov];
  if (!slot) return 0;
  if (!inter.estimated || inter.failCode) return slot.pubSec;
  var base = slot.estimateBaseAt || state.bootedAt;
  var elapsed = Math.floor((Date.now() - base) / 1000);
  return Math.max(0, slot.pubSec - elapsed);
}
function rawSec(slot) { return Math.round(slot.rawCs) / 100; }
function statusMatch(rawSt, pubSt) {
  var go = String(rawSt).indexOf("protected") === 0;
  return (go && pubSt === "진행") || (!go && pubSt === "정지");
}
function watchOn(inter) {
  if (!inter.watch) return false;
  var now = "2026-09-27 12:04:11";
  return inter.watchFrom <= now && now <= inter.watchTo;
}
function latestReceive() {
  return state.data.intersections.map(function (i) { return i.lastReceived; }).sort().pop();
}
function sevBadge(sev) {
  return '<span class="badge ' + esc(sev) + '">' + esc(SEV_LABEL[sev] || sev) + "</span>";
}
function badge(kind, label) {
  return '<span class="badge ' + esc(kind) + '">' + esc(label) + "</span>";
}
function sourceBadge(src) {
  if (src === "UTIC") return badge("UTIC", "UTIC");
  return badge("neutral", src || "없음");
}
function sig(label) {
  var go = label === "진행";
  return '<span class="sig"><i class="dot ' + (go ? "go" : "stop") + '"></i>' + esc(label) + "</span>";
}
function option(value, label, current) {
  return '<option value="' + esc(value) + '"' + (String(value) === String(current) ? " selected" : "") + ">" + esc(label) + "</option>";
}
function withQuery(path, query) {
  var u = new URLSearchParams();
  Object.keys(query).forEach(function (k) {
    if (query[k] !== "" && query[k] != null) u.set(k, query[k]);
  });
  var s = u.toString();
  return s ? path + "?" + s : path;
}
function go(href) {
  var next = href.charAt(0) === "#" ? href : "#" + href;
  if (location.hash === next) render();
  else location.hash = next;
}
function parseHash() {
  var raw = (location.hash || "#/login").replace(/^#/, "") || "/login";
  var parts = raw.split("?");
  var path = parts[0].charAt(0) === "/" ? parts[0] : "/" + parts[0];
  var query = {};
  new URLSearchParams(parts[1] || "").forEach(function (v, k) { query[k] = v; });
  return { path: path, query: query };
}
function persist() {
  sessionStorage.setItem("sg-proto-v1", JSON.stringify({
    user: state.user,
    data: state.data,
    users: state.users
  }));
}
function toast(text) {
  var el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { el.classList.remove("show"); }, 2800);
}
function openModal(title, body, ok, act, danger) {
  state.modal = { title: title, body: body, ok: ok, act: act, danger: !!danger };
  render();
  var btn = document.querySelector(".modal .btn.danger, .modal .btn.primary");
  if (btn) btn.focus();
}
function closeModal() {
  state.modal = null;
  state.pending = null;
  render();
}
function pageHead(crumb, title, lead) {
  return '<header class="page-head">' +
    (crumb ? '<p class="crumb">' + crumb + "</p>" : "") +
    "<h1>" + title + "</h1>" +
    (lead ? '<p class="lead">' + lead + "</p>" : "") +
    "</header>";
}
function emptyBox(title, text) {
  return '<div class="card empty"><h2>' + esc(title) + "</h2><p>" + esc(text) + "</p></div>";
}
function table(headers, body) {
  return '<div class="table-wrap"><table><thead><tr>' +
    headers.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
    "</tr></thead><tbody>" + (body || '<tr><td class="empty-cell" colspan="' + headers.length + '">없습니다</td></tr>') +
    "</tbody></table></div>";
}

function screenOf(path) {
  if (path === "/login") return "SCR-LOGIN";
  if (path === "/dashboard") return "SCR-DASH";
  if (path === "/map") return "SCR-MAP";
  if (path === "/intersections") return "SCR-INT-LIST";
  if (path.indexOf("/intersections/") === 0) return "SCR-INT-DETAIL";
  if (path === "/issues") return "SCR-ISS-LIST";
  if (path.indexOf("/issues/") === 0) return isWide() ? "SCR-ISS-LIST / SCR-ISS-DETAIL" : "SCR-ISS-DETAIL";
  if (path === "/plans") return "SCR-PLAN-LIST";
  if (path === "/plans/mapping") return "SCR-PLAN-MAP";
  if (path.indexOf("/plans/") === 0) return "SCR-PLAN-DETAIL";
  if (path === "/stats") return "SCR-STAT";
  if (path === "/controls") return "SCR-CTL";
  if (path === "/settings/rules") return "SCR-SET-RULE";
  if (path === "/settings/watch") return "SCR-SET-WATCH";
  if (path === "/settings/accounts") return "SCR-SET-ACC";
  if (path.indexOf("/settings") === 0) return "SCR-SET-COL";
  return "SCR-DASH";
}

function ico(name) {
  var p = {
    dash: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    map: '<path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/>',
    alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 4.8 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0z"/>',
    plan: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    stat: '<path d="M4 19V5M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p[name] + "</svg>";
}

function protoBar(screen) {
  var role = "";
  if (state.user) {
    role = '<span class="seg-mini" role="group" aria-label="시연 역할">' +
      '<button type="button" class="proto-btn' + (state.user.role === "OPERATOR" ? " on" : "") + '" data-act="role" data-role="OPERATOR">운영자</button>' +
      '<button type="button" class="proto-btn' + (state.user.role === "ADMIN" ? " on" : "") + '" data-act="role" data-role="ADMIN">관리자</button>' +
      "</span>";
  }
  return '<div class="proto"><span>프로토타입 · WBS-3.7</span><b class="sid">' + esc(screen) + '</b><span class="spacer"></span>' +
    role +
    '<button type="button" class="proto-btn" data-act="reset-demo">시연 초기화</button>' +
    '<a href="../index.html">산출물 목록</a></div>';
}

function headerBar() {
  var q = state.data.settings;
  var ratio = q.quotaUsed / q.quotaLimit;
  var qClass = ratio >= 1 ? "bad" : ratio >= 0.8 ? "warn" : "";
  var quotaInner = "<em>쿼터</em> <strong class=\"num\">" + num(q.quotaUsed) + " / " + num(q.quotaLimit) + "</strong>";
  var quota = isAdmin()
    ? '<a class="chip ' + qClass + '" href="#/settings">' + quotaInner + "</a>"
    : '<span class="chip ' + qClass + '">' + quotaInner + "</span>";
  var est = state.data.intersections.some(function (i) { return i.estimated; });
  var estChip = est ? '<a class="chip" href="#/intersections/284101"><em>추정</em></a>' : "";
  var n = activeIssues().length;
  var banner = ratio >= 1 ? '<div class="banner bad" style="flex-basis:100%">오늘 수집 한도에 도달했습니다. 당일 수집이 멈춰 있습니다.</div>' : "";
  return '<header class="topbar">' + banner + '<a class="brand" href="#/dashboard"><span class="lamps" aria-hidden="true"><i class="r"></i><i class="a"></i><i class="g"></i></span><span class="brand-text"><strong>Signal Guard</strong><span>실시간 교통신호 오류검지</span></span></a>' +
    '<div class="top-status"><span class="chip"><em>마지막 수신</em> <strong class="num">' + esc(clock(latestReceive())) + '</strong></span>' +
    '<span class="chip" data-live="poll">' + esc(pollLabel()) + "</span>" + estChip + quota + "</div>" +
    '<div class="top-user"><a class="chip" href="#/issues?status=active"><em>이슈</em> <strong class="num">' + n + '</strong></a>' +
    '<div class="who"><span>' + esc(roleLabel(state.user.role)) + '</span><b>' + esc(state.user.name) + '</b></div>' +
    '<button type="button" class="btn" data-act="logout">로그아웃</button></div></header>';
}

function pollLabel() {
  return "갱신 " + state.pollAgo + "초 전";
}

function sidebar() {
  var items = [
    ["대시보드", "/dashboard", "dash"],
    ["지도", "/map", "map"],
    ["교차로", "/intersections", "pin"],
    ["이슈", "/issues", "alert"],
    ["신호계획", "/plans", "plan"],
    ["통계", "/stats", "stat"],
    ["통제이력", "/controls", "clock"]
  ];
  if (isAdmin()) items.push(["설정", "/settings", "gear"]);
  var n = activeIssues().length;
  var html = items.map(function (it) {
    var on = it[1] === "/dashboard" ? state.path === "/dashboard" : (state.path === it[1] || state.path.indexOf(it[1] + "/") === 0);
    var badgeN = it[1] === "/issues" && n ? '<span class="count">' + n + "</span>" : "";
    return '<a href="#' + it[1] + '"' + (on ? ' class="active" aria-current="page"' : "") + ' title="' + esc(it[0]) + '">' +
      ico(it[2]) + '<span class="nav-label">' + it[0] + "</span>" + badgeN + "</a>";
  }).join("");
  return '<aside class="side"><nav class="nav">' + html + "</nav></aside>";
}

function counts() {
  var c = { all: 0, OK: 0, WARN: 0, ERROR: 0, CRITICAL: 0 };
  state.data.intersections.forEach(function (i) {
    c.all += 1;
    c[i.severity] = (c[i.severity] || 0) + 1;
  });
  c.bad = (c.ERROR || 0) + (c.CRITICAL || 0);
  c.active = activeIssues().length;
  c.auto = state.data.logs.filter(function (l) { return l.type === "AUTO_INFO"; }).length;
  return c;
}

function bars(rows) {
  var max = 1;
  rows.forEach(function (r) { max = Math.max(max, (r.critical || 0) + (r.error || 0) + (r.warn || 0)); });
  return '<div class="chart">' + rows.map(function (r) {
    function h(v) { return (v / max * 100).toFixed(1); }
    return '<div class="bar" title="치명 ' + (r.critical || 0) + " 오류 " + (r.error || 0) + " 경고 " + (r.warn || 0) + '"><div class="stack">' +
      '<i class="warn" style="height:' + h(r.warn || 0) + '%"></i>' +
      '<i class="error" style="height:' + h(r.error || 0) + '%"></i>' +
      '<i class="critical" style="height:' + h(r.critical || 0) + '%"></i>' +
      '</div><span class="num">' + esc(r.label) + "</span></div>";
  }).join("") + "</div>" +
    '<div class="legend"><span><i style="background:#e11d48"></i>치명</span><span><i style="background:#ea580c"></i>오류</span><span><i style="background:#eab308"></i>경고</span></div>';
}

function viewDash() {
  var c = counts();
  var kpi = function (href, label, value, cls) {
    return '<a class="kpi ' + (cls || "") + '" href="' + href + '"><em>' + esc(label) + '</em><strong class="num">' + value + "</strong></a>";
  };
  var anomaly = state.data.intersections.filter(function (i) { return i.severity !== "OK" && i.severity !== "INFO"; })
    .sort(function (a, b) { return SEV_RANK[a.severity] - SEV_RANK[b.severity]; });
  var rows = anomaly.map(function (i) {
    return '<tr class="clickable" tabindex="0" data-href="#/intersections/' + i.id + '"><td>' + esc(i.name) + "</td><td>" + sevBadge(i.severity) +
      "</td><td>" + esc(i.rule || "—") + "</td><td>" + (i.blocked ? badge("blocked", "제공 중지") : "—") +
      '</td><td class="num">' + esc(clock(i.lastReceived)) + "</td></tr>";
  }).join("");
  var issues = activeIssues().sort(sortIssue).slice(0, 8).map(function (i) {
    return '<tr class="clickable" tabindex="0" data-href="#/issues/' + i.id + '"><td>' + esc(i.id) + "</td><td>" + esc(i.rule) + "</td><td>" +
      sevBadge(i.severity) + "</td><td>" + esc(interName(i.intersectionId)) + "</td><td>" + esc(STATUS_LABEL[i.status]) + "</td></tr>";
  }).join("");
  var failed = state.data.intersections.filter(function (i) { return i.failCode; });
  var failText = failed.length ? failed.map(function (i) { return i.name + " " + i.failCode; }).join(", ") : "없음";
  var foot = "마지막 배치 " + clock(latestReceive()) + " · 성공 " + (c.all - failed.length) + " / 실패 " + failed.length + " · " + failText;
  var footHtml = isAdmin()
    ? '<a href="#/settings">' + esc(foot) + "</a>"
    : "<span>" + esc(foot) + "</span>";
  var html = pageHead("", "종합 대시보드", "시연 기준 2026-09-27 12:04:11 · 인천 표본 30곳. 추가 이동 없이 오류 교차로와 미처리 이슈를 고릅니다.") +
    '<div class="kpis">' +
    kpi("#/intersections", "전체", c.all) +
    kpi("#/intersections?severity=OK", "정상", c.OK || 0) +
    kpi("#/intersections?severity=WARN", "경고", c.WARN || 0, "warn") +
    kpi("#/intersections?severity=ERROR_UP", "오류", c.bad, "error") +
    kpi("#/issues?status=active", "미처리 이슈", c.active, c.active ? "critical" : "") +
    kpi("#/controls?type=AUTO_INFO", "자동보정", c.auto) +
    kpi("#/intersections?delay=1", "수신 지연", state.data.pipelineLagSec + "초") +
    (isAdmin()
      ? kpi("#/settings", "쿼터", num(state.data.settings.quotaUsed) + "/" + num(state.data.settings.quotaLimit))
      : '<div class="kpi"><em>쿼터</em><strong class="num">' + num(state.data.settings.quotaUsed) + "/" + num(state.data.settings.quotaLimit) + "</strong></div>") +
    "</div>" +
    '<div class="grid-2"><a class="card link-card" href="#/stats?grain=hour&from=2026-09-27&to=2026-09-27"><h2>시간대 오류 추이 <span class="sub">오늘 08–12시</span></h2>' +
    bars(state.data.statHours) + "</a>" +
    '<section class="card"><h2>최근 이슈 <span class="sub">미종료</span></h2>' +
    table(["ID", "규칙", "등급", "교차로", "상태"], issues) + "</section></div>" +
    '<section class="card"><div class="card-head"><h2>이상 교차로</h2><a class="btn" href="#/map?severity=anomaly">지도에서 보기</a></div>' + table(["명칭", "등급", "대표 규칙", "제공 중지", "수신"], rows) + "</section>" +
    '<p class="collect-foot" style="margin-top:12px">수집 · ' + footHtml + "</p>";
  return { screen: "SCR-DASH", html: html };
}

function filteredInters() {
  var q = state.query;
  return state.data.intersections.filter(function (i) {
    if (q.q) {
      var hay = (i.name + " " + i.id).toLowerCase();
      if (hay.indexOf(String(q.q).toLowerCase()) < 0) return false;
    }
    if (q.severity === "ERROR_UP" && i.severity !== "ERROR" && i.severity !== "CRITICAL") return false;
    if (q.severity && q.severity !== "ERROR_UP" && i.severity !== q.severity) return false;
    if (q.blocked === "1" && !i.blocked) return false;
    if (q.blocked === "0" && i.blocked) return false;
    if (q.mapped && i.mapped !== q.mapped) return false;
    if (q.collected === "1" && !i.collected) return false;
    if (q.collected === "0" && i.collected) return false;
    if (q.delay === "1" && !(i.failCode || i.lastReceived < "2026-09-27 12:00:00")) return false;
    return true;
  }).sort(function (a, b) {
    return (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || a.name.localeCompare(b.name, "ko");
  });
}

function viewIntList() {
  var q = state.query;
  var rows = filteredInters().map(function (i) {
    var tags = i.failCode ? " " + badge("fail", "수집 장애") : "";
    if (watchOn(i)) tags += " " + badge("watch", "감시 제외");
    return '<tr class="clickable" tabindex="0" data-href="#/intersections/' + i.id + '"><td>' + esc(i.name) + tags + '</td><td class="num">' + esc(i.id) +
      "</td><td>" + sevBadge(i.severity) + "</td><td class=\"num\">" + activeIssues(i.id).length + "</td><td>" +
      (i.blocked ? badge("blocked", "제공 중지") : "—") + "</td><td>" + esc(i.mapped) + '</td><td class="num">' + esc(clock(i.lastReceived)) + "</td></tr>";
  }).join("");
  var html = pageHead('<a href="#/dashboard">대시보드</a>', "교차로", "표본 전체를 검색합니다. 대시보드는 이상만 보여 줍니다.") +
    '<form class="filters" data-path="/intersections">' +
    '<label class="grow">이름 / ID<input name="q" value="' + esc(q.q || "") + '" placeholder="부평, 284101"></label>' +
    "<label>등급<select name=\"severity\" data-auto>" +
    option("", "전체", q.severity || "") + option("OK", "정상", q.severity || "") + option("WARN", "경고", q.severity || "") +
    option("ERROR", "오류", q.severity || "") + option("CRITICAL", "치명", q.severity || "") + option("ERROR_UP", "오류·치명", q.severity || "") +
    "</select></label><label>제공 중지<select name=\"blocked\" data-auto>" +
    option("", "전체", q.blocked || "") + option("1", "중지", q.blocked || "") + option("0", "제공 중", q.blocked || "") +
    "</select></label><label>매핑<select name=\"mapped\" data-auto>" +
    option("", "전체", q.mapped || "") + option("확정", "확정", q.mapped || "") + option("후보", "후보", q.mapped || "") + option("미매핑", "미매핑", q.mapped || "") +
    "</select></label><label>수집<select name=\"collected\" data-auto>" +
    option("", "전체", q.collected || "") + option("1", "대상", q.collected || "") + option("0", "제외", q.collected || "") +
    "</select></label>" +
    (q.delay ? '<input type="hidden" name="delay" value="1">' : "") +
    '<button class="btn primary" type="submit">적용</button></form>' +
    (q.delay ? '<p class="help">수신이 12:00 이전이거나 수집에 실패한 교차로만 봅니다.</p>' : "") +
    table(["명칭", "crsrdId", "최고 등급", "미종료 이슈", "제공 중지", "매핑", "마지막 수신"], rows || '<tr><td class="empty-cell" colspan="7">조건에 맞는 교차로가 없습니다.</td></tr>');
  return { screen: "SCR-INT-LIST", html: html };
}

function defaultDir(inter) {
  if (inter.rule === "R03") return "et";
  return "nt";
}
function expectedHold(inter, dir) {
  var plan = planOf(inter.id);
  if (!plan) return 30;
  var ns = dir === "nt" || dir === "st" || dir === "nw" || dir === "ne";
  var phase = plan.phases.find(function (p) {
    return p.kind === "직진" && (ns ? p.dir.indexOf("북") >= 0 : p.dir.indexOf("동") >= 0);
  });
  return phase ? phase.hold : 30;
}
function planSentence(inter, dir) {
  if (inter.failCode) return "수집 장애로 계획 대조를 건너뜁니다. 실패 코드 " + inter.failCode;
  if (inter.mapped === "미매핑") return "계획 대조 생략";
  var sec = shownSec(inter, dir, "Stsg");
  var expect = expectedHold(inter, dir);
  var prefix = inter.mapped === "후보" ? "매핑 후보 · " : "";
  var est = inter.estimated ? " (추정)" : "";
  var gap = sec - expect;
  var diff = gap ? " · 차이 " + (gap > 0 ? "+" : "") + gap + "초" : "";
  return prefix + "직진 진행 유지 " + expect + "초 예정 · 실측 " + sec + "초" + est + diff;
}
function estimateCaption(inter) {
  var sec = shownSec(inter, "nt", "Stsg");
  if (sec <= 0) return "추정 종료 · 마지막 수신 " + clock(inter.lastReceived) + " · 다음 수신 대기";
  return "추정 표시 · 마지막 수신 " + clock(inter.lastReceived);
}
function dirButton(inter, id, selected) {
  var d = inter.directions[id];
  var conflict = id === "nt" && d.Stsg.pubSt === "진행" && d.Pdsg.pubSt === "진행" && d.Stsg.rawSt.indexOf("protected") === 0 && d.Pdsg.rawSt.indexOf("protected") === 0;
  var movs = ["Stsg", "Ltsg", "Pdsg"].map(function (mov) {
    var slot = d[mov];
    var sec = shownSec(inter, id, mov);
    var live = inter.estimated ? '<b class="num" data-live-sec="' + inter.id + "|" + id + "|" + mov + '">' + sec + "초</b>" : '<b class="num">' + sec + "초</b>";
    return '<div class="mov"><span>' + MOV_LABEL[mov] + "</span><span>" + sig(slot.pubSt) + " " + live + "</span></div>";
  }).join("");
  return '<button type="button" class="dir' + (selected === id ? " on" : "") + (conflict ? " conflict" : "") + '" data-act="select-dir" data-id="' + inter.id + '" data-dir="' + id + '">' +
    '<div class="dir-name"><b>' + DIR_LABEL[id] + " " + id + "</b>" + (conflict ? badge("CRITICAL", "충돌") : "") + "</div>" + movs + "</button>";
}

function viewIntDetail(id) {
  var inter = interById(id);
  if (!inter) return { screen: "SCR-INT-DETAIL", html: emptyBox("교차로 없음", "요청한 교차로가 표본에 없습니다.") };
  var dir = state.ui.dir[id] || defaultDir(inter);
  var cards = CARDINAL.map(function (d) { return dirButton(inter, d, dir); }).join("");
  var diag = state.ui.diagonal ? '<div class="dirs" style="margin-top:8px">' + DIAG.map(function (d) { return dirButton(inter, d, dir); }).join("") + "</div>" : "";
  var issues = state.data.issues.filter(function (i) { return i.intersectionId === id; });
  var open = issues.filter(function (i) { return ACTIVE[i.status]; });
  var issueHtml = open.length ? open.map(function (i) {
    return '<p><a href="#/issues/' + i.id + '">' + esc(i.id) + "</a> " + esc(i.ruleName) + " " + sevBadge(i.severity) + " " + esc(STATUS_LABEL[i.status]) + "</p>";
  }).join("") : '<p>이 교차로에 열린 이슈가 없습니다. 검지 로그를 확인하세요.</p>';
  var val = inter.validations.map(function (v) {
    return "<li><time>" + esc(v.at) + "</time> " + (v.rule ? esc(v.rule) + " " : "") + sevBadge(v.severity) + " " + esc(v.text) + "</li>";
  }).join("");
  var logs = state.data.logs.filter(function (l) { return l.intersectionId === id; }).slice(0, 3);
  var logHtml = logs.length ? logs.map(function (l) {
    return "<li><time>" + esc(clock(l.at)) + "</time> " + esc(TYPE_LABEL[l.type] || l.type) + " · " + esc(l.summary) + "</li>";
  }).join("") : "<li>최근 통제가 없습니다.</li>";
  var slotRows = ["Stsg", "Ltsg", "Pdsg"].map(function (mov) {
    var slot = inter.directions[dir][mov];
    var pub = shownSec(inter, dir, mov);
    var raw = rawSec(slot);
    var timeDiff = Math.abs(raw - pub) > 0.05;
    var stDiff = !statusMatch(slot.rawSt, slot.pubSt);
    var live = inter.estimated ? '<span data-live-sec="' + inter.id + "|" + dir + "|" + mov + '">' + pub.toFixed(0) + "초</span>" : pub.toFixed(0) + "초";
    return "<tr><td>" + MOV_LABEL[mov] + ' 잔여</td><td class="num">' + slot.rawCs + " cs (" + raw.toFixed(2) + '초)</td><td class="num' + (timeDiff ? " diff" : "") + '" data-raw-sec="' + raw + '">' + live + "</td></tr>" +
      "<tr><td>" + MOV_LABEL[mov] + " 점등</td><td>" + esc(slot.rawSt) + '</td><td class="' + (stDiff ? "diff" : "") + '">' + esc(slot.pubSt) + "</td></tr>";
  }).join("");
  var tags = sevBadge(inter.severity) + (inter.blocked ? " " + badge("blocked", "제공 중지") : "") +
    (inter.estimated ? " " + badge("estimated", "추정") : "") +
    (watchOn(inter) ? " " + badge("watch", "감시 제외") : "") +
    (inter.mapped === "미매핑" ? " " + badge("neutral", "미매핑") : " " + badge("neutral", "매핑 " + inter.mapped)) +
    (inter.failCode ? " " + badge("fail", "수집 장애") : "");
  var banners = "";
  if (inter.failCode) banners += '<div class="banner bad">수집 장애. 마지막 수신 ' + esc(clock(inter.lastReceived)) + " · " + esc(inter.failCode) + ". 화면은 유지합니다.</div>";
  if (inter.blocked) banners += '<div class="banner">제공 중지 상태입니다. 아래 숫자는 마지막 제공·추정값이며 서비스로 나가지 않습니다.</div>';
  if (watchOn(inter)) banners += '<div class="banner info">감시 제외 ' + esc(clock(inter.watchFrom)) + "–" + esc(clock(inter.watchTo)) + " · " + esc(inter.watchReason) + ". 이 기간에는 신규 이슈가 없습니다.</div>";
  var plan = planOf(id);
  var html = pageHead('<a href="#/intersections">교차로</a> / ' + esc(inter.name), esc(inter.name), "이 화면에서는 값을 고치지 않습니다. 방향을 고르면 원본과 제공이 바뀝니다. 대각 4방향은 기본으로 접혀 있습니다.") +
    banners +
    '<div class="id-head">' + tags + '<p class="meta-line">' + esc(inter.district) + " · crsrdId " + esc(inter.id) + " · 마지막 수신 " + esc(clock(inter.lastReceived)) + "</p></div>" +
    '<section class="card"><div class="dirs">' + cards + "</div>" + diag +
    '<div class="btn-row"><button type="button" class="btn" data-act="toggle-diagonal">' + (state.ui.diagonal ? "대각 방향 접기" : "대각 방향 펼치기") + "</button>" +
    (inter.estimated ? '<span class="help" data-live-estimate data-id="' + inter.id + '">' + esc(estimateCaption(inter)) + "</span>" : "") +
    "</div></section>" +
    '<section class="card" style="margin-top:12px"><h2>계획 대비</h2><p data-live-plan data-id="' + inter.id + '" data-dir="' + dir + '">' + esc(planSentence(inter, dir)) + "</p>" +
    (plan ? '<p class="help">출처 ' + esc(plan.source) + " · 사이클 " + plan.cycle + "초 · " + esc(plan.tod) + " " + esc(plan.days) + ' · <a href="#/plans/' + plan.id + '">계획 보기</a></p>' : "") +
    "</section>" +
    '<section class="card" style="margin-top:12px"><h2>원본 vs 제공 · ' + DIR_LABEL[dir] + "</h2>" +
    '<p class="caption">원본 열은 읽기 전용입니다. 값이 다르면 제공 칸을 표시합니다.</p>' +
    table(["항목", "원본", "제공"], slotRows + '<tr><td>수신 시각</td><td class="num">' + esc(clock(inter.lastReceived)) + '</td><td class="num">' + esc(clock(inter.lastReceived)) + "</td></tr>") +
    "</section>" +
    '<div class="grid-2" style="margin-top:12px"><section class="card"><h2>검증 타임라인</h2><ul class="timeline">' + val + "</ul></section>" +
    '<section class="card"><h2>관련 이슈</h2>' + issueHtml + '<h2 style="margin-top:12px">제공 이력</h2><ul class="timeline">' + logHtml + "</ul>" +
    '<p class="help"><a href="#/controls?intersection=' + inter.id + '">통제 이력 더 보기</a></p></section></div>';
  return { screen: "SCR-INT-DETAIL", html: html };
}

function sortIssue(a, b) {
  return (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || (a.updated < b.updated ? 1 : -1);
}
function filteredIssues() {
  var q = state.query;
  var status = q.status || "active";
  return state.data.issues.filter(function (i) {
    if (status === "active" && !ACTIVE[i.status]) return false;
    if (status !== "active" && status !== "all" && i.status !== status) return false;
    if (q.severity && i.severity !== q.severity) return false;
    if (q.rule && i.rule !== q.rule) return false;
    if (q.intersection && i.intersectionId !== q.intersection) return false;
    var day = i.opened.slice(0, 10);
    if (q.from && day < q.from) return false;
    if (q.to && day > q.to) return false;
    return true;
  }).sort(sortIssue);
}

function issueTable(selected) {
  var rows = filteredIssues().map(function (i) {
    return '<tr class="clickable' + (i.id === selected ? " selected" : "") + '" tabindex="0" data-href="#/issues/' + i.id + '"><td>' + esc(i.id) +
      "</td><td>" + esc(interName(i.intersectionId)) + "</td><td>" + esc(i.movement) + "</td><td>" + esc(i.rule) + "</td><td>" +
      sevBadge(i.severity) + "</td><td>" + esc(STATUS_LABEL[i.status]) + '</td><td class="num">' + esc(clock(i.opened)) + "</td><td>" + esc(i.assignee || "—") + "</td></tr>";
  }).join("");
  var q = state.query;
  var status = q.status || "active";
  var interOpts = '<option value="">전체</option>' + state.data.intersections.map(function (i) {
    return option(i.id, i.name, q.intersection || "");
  }).join("");
  var rules = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11", "R12"].map(function (r) {
    return option(r, r, q.rule || "");
  }).join("");
  return '<form class="filters" data-path="/issues">' +
    '<label>상태<select name="status" data-auto>' +
    option("active", "미처리", status) + option("all", "전체", status) + option("OPEN", "열림", status) + option("ACK", "확인", status) +
    option("IN_PROGRESS", "진행", status) + option("RESOLVED", "해결", status) + option("CLOSED", "종료", status) + option("FALSE_POSITIVE", "오탐", status) +
    "</select></label><label>등급<select name=\"severity\" data-auto>" +
    option("", "전체", q.severity || "") + option("CRITICAL", "치명", q.severity || "") + option("ERROR", "오류", q.severity || "") + option("WARN", "경고", q.severity || "") +
    "</select></label><label>규칙<select name=\"rule\" data-auto><option value=\"\">전체</option>" + rules + "</select></label>" +
    "<label>교차로<select name=\"intersection\" data-auto>" + interOpts + "</select></label>" +
    '<label>부터<input type="date" name="from" value="' + esc(q.from || "") + '" data-auto></label>' +
    '<label>까지<input type="date" name="to" value="' + esc(q.to || "") + '" data-auto></label></form>' +
    table(["ID", "교차로", "방향", "규칙", "등급", "상태", "발생", "담당"], rows || '<tr><td class="empty-cell" colspan="8">조건에 맞는 이슈가 없습니다.</td></tr>');
}

function controlMode(issue) {
  return state.ui.controlMode[issue.id] || (issue.rule === "R06" ? "field" : "info");
}

function issueDetail(issue, wide) {
  var inter = interById(issue.intersectionId);
  var plan = planOf(issue.intersectionId);
  var comments = state.data.comments[issue.id] || [];
  var commentHtml = comments.length ? comments.map(function (c) {
    return "<li><time>" + esc(clock(c.at)) + '</time> <span class="who-mini">' + esc(c.actor) + " · " + esc(c.role) + "</span> " + esc(c.text) + "</li>";
  }).join("") : "<li>코멘트가 없습니다.</li>";
  var hist = issue.history.map(function (h) {
    return "<li><time>" + esc(clock(h.at)) + "</time> <span class=\"who-mini\">" + esc(h.actor) + "</span> " + esc(h.text) + "</li>";
  }).join("");
  var observed = "";
  if (issue.dir && inter) {
    var bits = ["Stsg", "Ltsg", "Pdsg"].map(function (mov) {
      var slot = inter.directions[issue.dir][mov];
      return MOV_LABEL[mov] + " 원본 " + rawSec(slot).toFixed(2) + "초 " + slot.rawSt + " / 제공 " + shownSec(inter, issue.dir, mov) + "초 " + slot.pubSt;
    }).join(" · ");
    observed = "<p>" + esc(bits) + "</p>";
  } else if (inter) {
    observed = "<p>마지막 수신 " + esc(clock(inter.lastReceived)) + (inter.failCode ? " · " + esc(inter.failCode) : "") + "</p>";
  }
  var err = state.formError && state.path.indexOf(issue.id) >= 0 ? '<p class="form-error">' + esc(state.formError) + "</p>" : "";
  var panel = "";
  if (isAdmin() && inter) panel = controlPanel(issue, inter, plan) + err;
  var back = wide ? "" : '<p class="crumb"><a href="#/issues">이슈</a> / ' + esc(issue.id) + "</p>";
  return back + '<article class="card"><div class="id-head"><h2>' + esc(issue.id) + " " + esc(issue.rule) + " " + esc(issue.ruleName) + "</h2>" +
    sevBadge(issue.severity) + " " + badge("neutral", STATUS_LABEL[issue.status]) +
    '<p class="meta-line"><a href="#/intersections/' + inter.id + '">' + esc(inter.name) + "</a> · " + esc(issue.movement) +
    (plan ? ' · <a href="#/plans/' + plan.id + (issue.status && ACTIVE[issue.status] ? "?issueId=" + issue.id : "") + '">해당 계획</a>' : "") +
    " · 담당 " + esc(issue.assignee || "미지정") + "</p></div>" +
    '<div class="pair"><div class="snapshot"><b>원본 스냅샷 · 읽기 전용</b>' + esc(issue.snapshotRaw) + '</div><div class="snapshot"><b>제공 스냅샷 · 발생 시점</b>' + esc(issue.snapshotPub) + "</div></div>" +
    '<h2 style="margin-top:12px">추정 원인</h2><p>' + esc(issue.cause) + "</p>" +
    '<h2 style="margin-top:12px">최근 관측</h2>' + observed +
    '<h2 style="margin-top:12px">상태 이력</h2><ul class="timeline">' + hist + "</ul>" +
    '<h2 style="margin-top:12px">코멘트</h2><ul class="timeline">' + commentHtml + "</ul>" +
    '<form data-act="add-comment" data-issue="' + issue.id + '" style="margin-top:8px"><label class="field">코멘트<textarea name="text" required placeholder="확인 내용을 남깁니다"></textarea></label><div class="btn-row"><button class="btn primary" type="submit">등록</button></div></form>' +
    panel + "</article>";
}

function controlPanel(issue, inter, plan) {
  var mode = controlMode(issue);
  var seg = function (id, label) {
    return '<button type="button" data-act="mode" data-issue="' + issue.id + '" data-mode="' + id + '" aria-pressed="' + (mode === id ? "true" : "false") + '">' + label + "</button>";
  };
  var body = "";
  if (mode === "info") {
    var mov = issue.focusMov || "Stsg";
    var slot = issue.dir ? inter.directions[issue.dir][mov] : null;
    body = '<form data-act="prepare-info" data-issue="' + issue.id + '">' +
      (issue.dir ? '<div class="form-grid"><label class="field">방향<input value="' + esc(issue.movement) + '" disabled></label>' +
        '<label class="field">현시<select name="mov">' + option("Stsg", "직진", mov) + option("Ltsg", "좌회전", mov) + option("Pdsg", "보행", mov) + "</select></label>" +
        '<label class="field">제공 잔여초<input name="sec" type="number" min="0" value="' + (slot ? slot.pubSec : 0) + '"></label>' +
        '<label class="field">제공 점등<select name="light">' + option("정지", "정지", slot ? slot.pubSt : "정지") + option("진행", "진행", slot ? slot.pubSt : "진행") + "</select></label></div>" : '<p class="help">방향 슬롯이 없는 이슈입니다. 제공 차단만 적용합니다.</p>') +
      '<label class="field check"><input type="checkbox" name="block" value="1"' + (inter.blocked ? " checked" : "") + "> 제공 차단</label>" +
      '<label class="field check"><input type="checkbox" name="estimate" value="1"' + (inter.estimated ? " checked" : "") + "> 추정 표시 유지</label>" +
      '<div class="btn-row"><button class="btn primary" type="submit">적용</button></div></form>';
  } else if (mode === "plan") {
    body = "<p>현시·유지시간을 고친 뒤 재검증합니다. 이 화면에서 계획을 직접 수정하지 않고 계획 화면으로 이동합니다.</p>" +
      (plan ? '<div class="btn-row"><a class="btn primary" href="#/plans/' + plan.id + "?issueId=" + issue.id + '">계획 수정 화면으로</a></div>' : "<p>연결된 계획이 없습니다.</p>");
  } else {
    if (issue.fieldRequest) {
      var fr = issue.fieldRequest;
      body = '<div class="banner info">요청 상태 ' + esc(fr.status) + " · " + esc(clock(fr.at)) + " · " + esc(fr.actor) + "<br>" + esc(fr.body) + "</div>" +
        "<p class=\"help\">신호제어기에 점등·주기 명령을 보내지 않았습니다. 전송 버튼은 없습니다.</p>";
    } else {
      body = '<form data-act="prepare-field" data-issue="' + issue.id + '"><label class="field">요청 내용<textarea name="body">충돌 현시 해제 확인 요청</textarea></label>' +
        '<p class="help">방향 ' + esc(issue.movement) + " · 규칙 " + esc(issue.rule) + " " + esc(issue.ruleName) + " · 자동 채움</p>" +
        '<label class="field check"><input type="checkbox" name="block" value="1" checked> 해당 교차로 정보 제공 차단 (기본)</label>' +
        '<p class="help">신호제어기에 점등·주기 명령을 보내지 않습니다.</p>' +
        '<div class="btn-row"><button class="btn primary" type="submit">요청 등록</button></div></form>';
    }
  }
  var people = Object.keys(state.users).map(function (k) { return state.users[k]; }).filter(function (u) { return u.active; });
  var assign = '<option value="">미지정</option>' + people.map(function (u) { return option(u.name, u.name, issue.assignee); }).join("");
  var statuses = ["ACK", "IN_PROGRESS", "RESOLVED", "CLOSED", "FALSE_POSITIVE"].map(function (s) {
    return option(s, STATUS_LABEL[s], issue.status === "OPEN" ? "ACK" : issue.status);
  }).join("");
  return '<section class="panel"><h2>오류 통제</h2><p class="help">원본 수신은 바뀌지 않습니다.</p><div class="segments">' +
    seg("info", "정보 통제") + seg("plan", "계획 통제") + seg("field", "현장 통제 요청") + "</div>" + body +
    '<form data-act="prepare-status" data-issue="' + issue.id + '" style="margin-top:12px"><div class="form-grid">' +
    "<label class=\"field\">담당<select name=\"assignee\">" + assign + "</select></label>" +
    "<label class=\"field\">상태<select name=\"status\">" + statuses + "</select></label></div>" +
    '<div class="btn-row"><button class="btn" type="submit">상태 저장</button><button class="btn" type="button" data-act="revalidate" data-issue="' + issue.id + '">재검증</button></div></form></section>';
}

function viewIssues() {
  var wide = isWide();
  var id = state.path.split("/")[2] ? decodeURIComponent(state.path.split("/")[2]) : "";
  var issue = id ? issueById(id) : null;
  var lead = "1280px 이상에서는 목록과 상세를 나란히 봅니다. 좁은 화면에서는 목록에서 상세로 들어갑니다.";
  if (!wide && id && !issue) return { screen: "SCR-ISS-DETAIL", html: emptyBox("이슈 없음", "요청한 이슈가 없습니다.") };
  if (!wide && issue) {
    return { screen: "SCR-ISS-DETAIL", html: pageHead('<a href="#/issues">이슈</a> / ' + esc(issue.id), "이슈 상세", "운영자는 조회와 코멘트만 합니다. 통제는 관리자 패널에만 있습니다.") + issueDetail(issue, true) };
  }
  var right = issue ? issueDetail(issue, true) : '<div class="card empty"><h2>이슈를 선택하세요</h2><p>행을 누르면 스냅샷과 통제 패널이 열립니다. 운영자는 코멘트만, 관리자는 정보·계획·현장 요청을 고릅니다.</p></div>';
  var html = pageHead("", "오류·이슈", lead) +
    (wide
      ? '<div class="issue-layout split"><div class="pane">' + issueTable(id) + '</div><div class="pane">' + right + "</div></div>"
      : issueTable(""));
  if (!wide && id && !issue) html = emptyBox("이슈 없음", "요청한 이슈가 없습니다.");
  return { screen: id && wide ? "SCR-ISS-LIST / SCR-ISS-DETAIL" : "SCR-ISS-LIST", html: html };
}

function filteredPlans() {
  var q = state.query;
  return state.data.plans.filter(function (p) {
    if (q.source && p.source !== q.source) return false;
    var inter = interById(p.intersectionId);
    if (q.mapStatus && inter && inter.mapped !== q.mapStatus) return false;
    return true;
  });
}

function viewPlanList() {
  var q = state.query;
  var rows = filteredPlans().map(function (p) {
    var inter = interById(p.intersectionId);
    return '<tr class="clickable" tabindex="0" data-href="#/plans/' + p.id + '"><td>' + esc(inter.name) + "</td><td>" + sourceBadge(p.source) +
      "</td><td>" + esc(inter.mapped) + "</td><td>" + (p.active ? "활성" : "없음") + '</td><td class="num">' + p.cycle + '</td><td class="num">' + esc(clock(p.updated)) + "</td></tr>";
  }).join("");
  var mapBtn = isAdmin() ? '<a class="btn" href="#/plans/mapping">매핑 작업</a>' : "";
  var html = pageHead("", "신호 계획", "출처 배지는 결함이 아닙니다. UTIC 승인 전에는 수동·추정·시드로 계획을 둡니다. 수정은 관리자만 합니다.") +
    '<form class="filters" data-path="/plans"><label>출처<select name="source" data-auto>' +
    option("", "전체", q.source || "") + option("UTIC", "UTIC", q.source || "") + option("수동", "수동", q.source || "") + option("추정", "추정", q.source || "") + option("시드", "시드", q.source || "") +
    "</select></label><label>매핑<select name=\"mapStatus\" data-auto>" +
    option("", "전체", q.mapStatus || "") + option("확정", "확정", q.mapStatus || "") + option("후보", "후보", q.mapStatus || "") + option("미매핑", "미매핑", q.mapStatus || "") +
    "</select></label>" + mapBtn + "</form>" +
    table(["교차로", "출처", "매핑", "활성 계획", "사이클(초)", "수정 시각"], rows);
  return { screen: "SCR-PLAN-LIST", html: html };
}

function viewPlanDetail(id) {
  var plan = planById(id);
  if (!plan) return { screen: "SCR-PLAN-DETAIL", html: emptyBox("계획 없음", "요청한 계획이 없습니다.") };
  var inter = interById(plan.intersectionId);
  var issueId = state.query.issueId || "";
  var banner = issueId ? '<div class="banner info">' + esc(issueId) + ' 계획 통제 중 · <a href="#/issues/' + esc(issueId) + '">이슈로 돌아가기</a></div>' : "";
  var phaseRows = plan.phases.map(function (p, i) {
    var hold = isAdmin()
      ? '<input name="hold_' + i + '" type="number" min="0" value="' + p.hold + '" style="width:80px">'
      : String(p.hold);
    return "<tr><td class=\"num\">" + (i + 1) + "</td><td>" + esc(p.dir) + "</td><td>" + esc(p.kind) + "</td><td>" + hold + "</td><td>" + esc(p.ring) + "</td></tr>";
  }).join("");
  var cons = plan.constraints.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("");
  var fields = isAdmin()
    ? '<div class="form-grid"><label class="field">사이클(초)<input name="cycle" type="number" min="1" value="' + plan.cycle + '"></label>' +
      '<label class="field">옵셋(초)<input name="offset" type="number" value="' + plan.offset + '"></label>' +
      '<label class="field">TOD<input name="tod" value="' + esc(plan.tod) + '"></label>' +
      '<label class="field">요일<input name="days" value="' + esc(plan.days) + '"></label></div>' +
      table(["순서", "방향", "종류", "유지시간(초)", "링"], phaseRows) +
      '<div class="btn-row"><button class="btn primary" type="submit">저장하고 재검증</button></div>'
    : '<p class="meta-line">사이클 ' + plan.cycle + "초 · 옵셋 " + plan.offset + "초 · " + esc(plan.tod) + " · " + esc(plan.days) + "</p>" +
      table(["순서", "방향", "종류", "유지시간(초)", "링"], phaseRows) +
      '<p class="help">운영자는 계획을 수정할 수 없습니다.</p>';
  var formStart = isAdmin() ? '<form data-act="prepare-plan" data-plan="' + plan.id + '" data-issue="' + esc(issueId) + '">' : "";
  var formEnd = isAdmin() ? "</form>" : "";
  var html = pageHead('<a href="#/plans">신호계획</a> / ' + esc(inter.name), esc(inter.name), "현시 표와 동시 점등 제약이 계획 대조의 기준입니다.") +
    banner +
    '<div class="id-head">' + sourceBadge(plan.source) + " " + badge("neutral", inter.mapped) + " " + (plan.active ? badge("OK", "활성") : badge("neutral", "비활성")) +
    '<p class="meta-line"><a href="#/intersections/' + inter.id + '">' + esc(inter.name) + "</a> · crsrdId " + esc(inter.id) + "</p></div>" +
    '<section class="card">' + formStart + fields + formEnd + "</section>" +
    '<section class="card" style="margin-top:12px"><h2>동시 점등 제약</h2><ul class="timeline">' + cons + "</ul></section>";
  return { screen: "SCR-PLAN-DETAIL", html: html };
}

function viewMap() {
  if (!isAdmin()) return { screen: "SCR-PLAN-MAP", html: forbiddenHtml(), forbidden: true };
  var rows = state.data.maps.map(function (m) {
    var inter = interById(m.intersectionId);
    return "<tr><td>" + esc(inter.name) + '</td><td class="num">' + esc(m.uticNo || "—") + '</td><td class="num">' + esc(inter.id) +
      '</td><td class="num">' + m.meters + "</td><td>" + esc(m.status) + "</td><td>" +
      '<button type="button" class="btn" data-act="map-set" data-id="' + inter.id + '" data-status="확정">확정</button> ' +
      '<button type="button" class="btn" data-act="map-set" data-id="' + inter.id + '" data-status="미매핑">해제</button></td></tr>';
  }).join("");
  var html = pageHead('<a href="#/plans">신호계획</a> / 매핑', "ID 매핑", "이름·좌표가 가까운 UTIC 후보입니다. 미매핑 교차로는 계획 대조를 하지 않습니다.") +
    table(["교차로", "UTIC 번호", "crsrdId", "거리(m)", "상태", "작업"], rows);
  return { screen: "SCR-PLAN-MAP", html: html };
}

function filteredStatRows() {
  var from = state.query.from || "2026-09-21";
  var to = state.query.to || "2026-09-27";
  return state.data.statRows.filter(function (r) {
    if (r.day < from || r.day > to) return false;
    if (state.query.intersection && r.intersectionId !== state.query.intersection) return false;
    if (state.query.rule && r.rule !== state.query.rule) return false;
    return true;
  });
}
function chartSeries(rows) {
  var grain = state.query.grain || "day";
  if (!rows.length) return [];
  if (grain === "hour") {
    return rows.some(function (r) { return r.day === "2026-09-27"; }) ? state.data.statHours : [];
  }
  var map = {};
  rows.forEach(function (r) {
    var key = grain === "month" ? r.day.slice(0, 7) : grain === "week" ? (r.day < "2026-09-24" ? "09-21주" : "09-24주") : r.day.slice(5);
    if (!map[key]) map[key] = { label: key, critical: 0, error: 0, warn: 0 };
    var slot = r.severity === "CRITICAL" ? "critical" : r.severity === "ERROR" ? "error" : "warn";
    map[key][slot] += r.count;
  });
  return Object.keys(map).sort().map(function (k) { return map[k]; });
}
function rankBlocks(rows, keyFn, labelFn) {
  var map = {};
  rows.forEach(function (r) {
    var k = keyFn(r);
    map[k] = (map[k] || 0) + r.count;
  });
  var list = Object.keys(map).map(function (k) { return { k: k, n: map[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
  var max = list.reduce(function (m, x) { return Math.max(m, x.n); }, 1);
  if (!list.length) return "<p class=\"help\">집계 없음</p>";
  return list.map(function (x) {
    return '<div class="rank"><span>' + esc(labelFn(x.k)) + '</span><span class="rank-bar"><i style="width:' + (x.n / max * 100) + '%"></i></span><b class="num">' + x.n + "</b></div>";
  }).join("");
}

function viewStats() {
  var q = state.query;
  var rows = filteredStatRows();
  var from = q.from || "2026-09-21";
  var to = q.to || "2026-09-27";
  var interOpts = '<option value="">전체</option>' + state.data.intersections.map(function (i) { return option(i.id, i.name, q.intersection || ""); }).join("");
  var ruleOpts = '<option value="">전체</option>' + ["R02", "R03", "R04", "R05", "R06", "R07", "R10", "R11"].map(function (r) { return option(r, r, q.rule || ""); }).join("");
  var filters = '<form class="filters" data-path="/stats"><label>알갱이<select name="grain" data-auto>' +
    option("hour", "시간", q.grain || "day") + option("day", "일", q.grain || "day") + option("week", "주", q.grain || "day") + option("month", "월", q.grain || "day") +
    '</select></label><label>부터<input type="date" name="from" value="' + esc(from) + '" data-auto></label>' +
    '<label>까지<input type="date" name="to" value="' + esc(to) + '" data-auto></label>' +
    '<label>교차로<select name="intersection" data-auto>' + interOpts + "</select></label>" +
    '<label>규칙<select name="rule" data-auto>' + ruleOpts + "</select></label></form>";
  if (!rows.length) {
    return { screen: "SCR-STAT", html: pageHead("", "통계·리포트", "사전 집계만 보여 줍니다. 원본을 다시 훑지 않습니다.") + filters + emptyBox("집계 없음", "집계 없음 / 배치 대기") };
  }
  var critical = 0, error = 0, warn = 0;
  rows.forEach(function (r) {
    if (r.severity === "CRITICAL") critical += r.count;
    else if (r.severity === "ERROR") error += r.count;
    else warn += r.count;
  });
  var logs = state.data.logs.filter(function (l) {
    var d = l.at.slice(0, 10);
    if (d < from || d > to) return false;
    if (q.intersection && l.intersectionId !== q.intersection) return false;
    if (q.rule && l.rule !== q.rule) return false;
    return true;
  });
  var auto = logs.filter(function (l) { return l.type === "AUTO_INFO"; }).length;
  var manual = logs.filter(function (l) { return l.type !== "AUTO_INFO"; }).length;
  var denom = critical + error + warn + auto;
  var rate = denom ? Math.round((critical + error) / denom * 1000) / 10 : 0;
  var series = chartSeries(rows);
  var detail = rows.map(function (r) {
    return "<tr><td>" + esc(r.day) + "</td><td>" + esc(interName(r.intersectionId)) + "</td><td>" + esc(r.rule) + "</td><td>" + sevBadge(r.severity) + '</td><td class="num">' + r.count + "</td></tr>";
  }).join("");
  var html = pageHead("", "통계·리포트", "CSV는 지금 화면에 걸린 필터를 그대로 담습니다.") + filters +
    '<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">' +
    '<div class="kpi"><em>오류율</em><strong class="num">' + rate + '%</strong></div>' +
    '<div class="kpi"><em>자동보정 / 수동조치</em><strong class="num">' + auto + " / " + manual + '</strong></div>' +
    '<div class="kpi critical"><em>CRITICAL</em><strong class="num">' + critical + "</strong></div></div>" +
    '<div class="grid-2"><section class="card"><h2>기간 추이</h2>' + (series.length ? bars(series) : '<p class="help">이 알갱이의 집계가 없습니다.</p>') + "</section>" +
    '<section class="card"><h2>다발 교차로</h2>' + rankBlocks(rows, function (r) { return r.intersectionId; }, interName) +
    "<h2 style=\"margin-top:12px\">규칙별 발생</h2>" + rankBlocks(rows, function (r) { return r.rule; }, function (k) { return k; }) + "</section></div>" +
    '<section class="card"><div class="btn-row" style="margin-top:0"><h2 style="flex:1">상세</h2><button type="button" class="btn" data-act="csv">CSV 다운로드</button></div>' +
    table(["일자", "교차로", "규칙", "등급", "건수"], detail) + "</section>";
  return { screen: "SCR-STAT", html: html };
}

function filteredLogs() {
  var q = state.query;
  return state.data.logs.filter(function (l) {
    if (q.type && l.type !== q.type) return false;
    if (q.intersection && l.intersectionId !== q.intersection) return false;
    var day = l.at.slice(0, 10);
    if (q.from && day < q.from) return false;
    if (q.to && day > q.to) return false;
    return true;
  });
}
function viewControls() {
  var q = state.query;
  var interOpts = '<option value="">전체</option>' + state.data.intersections.map(function (i) { return option(i.id, i.name, q.intersection || ""); }).join("");
  var types = ["AUTO_INFO", "MANUAL_INFO", "PLAN_UPDATE", "PUBLISH_BLOCK", "FIELD_REQUEST"].map(function (t) {
    return option(t, TYPE_LABEL[t], q.type || "");
  }).join("");
  var body = filteredLogs().map(function (l) {
    var href = l.issueId ? "#/issues/" + l.issueId : "#/intersections/" + l.intersectionId;
    var open = !!state.ui.logOpen[l.id];
    return '<tr class="clickable" tabindex="0" data-href="' + href + '"><td class="num">' + esc(l.at.slice(5)) + "</td><td>" + esc(TYPE_LABEL[l.type]) +
      "</td><td>" + esc(l.actor) + "</td><td>" + esc(interName(l.intersectionId)) + "</td><td>" + esc(l.rule || "—") + "</td><td>" + esc(l.issueId || "—") +
      "</td><td>" + esc(l.summary) + '</td><td><button type="button" class="btn" data-act="toggle-log" data-id="' + l.id + '">전후</button></td></tr>' +
      (open ? '<tr class="expand"><td colspan="8"><b>원본 전</b> ' + esc(l.beforeRaw) + " → <b>후</b> " + esc(l.afterRaw) +
        "<br><b>제공 전</b> " + esc(l.beforePub) + " → <b>후</b> " + esc(l.afterPub) + "</td></tr>" : "");
  }).join("");
  var html = pageHead("", "통제 이력", "누가 제공 값과 계획을 왜 바꿨는지 조회합니다. 이 화면에서 새 통제를 만들지 않습니다.") +
    '<form class="filters" data-path="/controls"><label>유형<select name="type" data-auto><option value="">전체</option>' + types + "</select></label>" +
    '<label>교차로<select name="intersection" data-auto>' + interOpts + "</select></label>" +
    '<label>부터<input type="date" name="from" value="' + esc(q.from || "") + '" data-auto></label>' +
    '<label>까지<input type="date" name="to" value="' + esc(q.to || "") + '" data-auto></label></form>' +
    table(["시각", "유형", "액터", "교차로", "규칙", "이슈", "전→후", ""], body || '<tr><td class="empty-cell" colspan="8">조건에 맞는 이력이 없습니다.</td></tr>');
  return { screen: "SCR-CTL", html: html };
}

function forbiddenHtml() {
  return '<div class="card empty"><h2>권한이 없습니다</h2><p>이 작업은 관리자만 할 수 있습니다.</p><p><a class="btn primary" href="#/dashboard">대시보드로</a></p><p class="help">잠시 후 대시보드로 이동합니다.</p></div>';
}
function forecastCalls(min, n) {
  if (!min || min <= 0) return 0;
  return Math.round(n * (1440 / min));
}
function viewSettings(tab) {
  if (!isAdmin()) return { screen: "SCR-SET", html: forbiddenHtml(), forbidden: true };
  var tabs = [
    ["collection", "수집 대상·주기", "/settings"],
    ["rules", "규칙 임계값", "/settings/rules"],
    ["watch", "감시 제외", "/settings/watch"],
    ["accounts", "계정", "/settings/accounts"]
  ].map(function (t) {
    return '<a href="#' + t[2] + '"' + (t[0] === tab ? ' class="on"' : "") + ">" + t[1] + "</a>";
  }).join("");
  var err = state.formError ? '<p class="form-error">' + esc(state.formError) + "</p>" : "";
  var body = tab === "rules" ? settingsRules() : tab === "watch" ? settingsWatch() : tab === "accounts" ? settingsAccounts() : settingsCollection();
  var html = pageHead("", "설정", "수집, 임계값, 감시 제외, 계정을 이 화면의 탭으로 둡니다. 운영자에게는 메뉴가 없습니다.") +
    '<nav class="tabs">' + tabs + "</nav>" + err + body;
  var screen = tab === "rules" ? "SCR-SET-RULE" : tab === "watch" ? "SCR-SET-WATCH" : tab === "accounts" ? "SCR-SET-ACC" : "SCR-SET-COL";
  return { screen: screen, html: html };
}
function settingsCollection() {
  var s = state.data.settings;
  var n = forecastCalls(s.collectMin, state.data.intersections.length);
  var rows = state.data.intersections.map(function (i) {
    return "<tr><td>" + esc(i.name) + '</td><td><input type="checkbox" name="col_' + i.id + '" value="1"' + (i.collected ? " checked" : "") + '></td>' +
      '<td><input name="pri_' + i.id + '" type="number" min="1" value="' + i.priority + '" style="width:72px"></td>' +
      "<td>" + sevBadge(i.severity) + (i.failCode ? " " + badge("fail", "실패") : "") + "</td></tr>";
  }).join("");
  return '<form data-act="save-collection"><div class="form-grid">' +
    '<label class="field">상태 수집 주기(분)<input id="collect-min" name="collectMin" type="number" min="1" value="' + s.collectMin + '"></label>' +
    '<label class="field">맵 수집 주기(시간)<input name="mapHours" type="number" min="1" value="' + s.mapHours + '"></label>' +
    '<label class="field">화면 폴링(초)<input name="pollSec" type="number" min="5" value="' + s.pollSec + '"></label>' +
    '<label class="field">오늘 쿼터<input value="' + num(s.quotaUsed) + " / " + num(s.quotaLimit) + '" disabled></label></div>' +
    '<p class="quota-note' + (n > s.quotaLimit ? " warn" : "") + '" data-live-forecast>표본 ' + state.data.intersections.length + "곳 · 이 주기로 24시간이면 예상 " + num(n) + "건 / 한도 " + num(s.quotaLimit) + "건. 화면 폴링은 외부 API 주기와 별개입니다.</p>" +
    '<div class="btn-row"><button class="btn primary" type="submit">저장</button></div>' +
    table(["교차로", "수집", "우선순위", "상태"], rows) + "</form>";
}
function settingsRules() {
  var rows = state.data.rules.map(function (r) {
    return "<tr><td>" + esc(r.id) + "</td><td>" + esc(r.name) + "</td><td>" + esc(r.param) +
      '</td><td><input name="rule_' + r.id + '" value="' + esc(r.value) + '"></td><td>' + sevBadge(r.grade) + "</td></tr>";
  }).join("");
  return '<form data-act="save-rules"><p class="help">저장하면 다음 검증부터 반영됩니다. 변경은 이 시연에서 토스트로만 알립니다.</p>' +
    table(["규칙", "이름", "파라미터", "현재 값", "기본 등급"], rows) +
    '<div class="btn-row"><button class="btn primary" type="submit">저장</button></div></form>';
}
function settingsWatch() {
  var rows = state.data.intersections.filter(function (i) { return i.watch; }).map(function (i) {
    return "<tr><td>" + esc(i.name) + "</td><td>" + esc(i.watchFrom) + "</td><td>" + esc(i.watchTo) + "</td><td>" + esc(i.watchReason) +
      '</td><td>' + (watchOn(i) ? badge("watch", "적용 중") : badge("neutral", "기간 아님")) +
      '</td><td><button type="button" class="btn" data-act="ask-unwatch" data-id="' + i.id + '">해제</button></td></tr>';
  }).join("");
  var opts = state.data.intersections.map(function (i) { return option(i.id, i.name, ""); }).join("");
  return '<p class="help">제외 기간에는 그 교차로의 신규 이슈를 만들지 않습니다. 없는 상태로 둬도 설정 화면은 성립합니다.</p>' +
    (rows ? table(["교차로", "시작", "종료", "사유", "지금", ""], rows) : emptyBox("제외 없음", "등록된 감시 제외가 없습니다.")) +
    '<form data-act="add-watch" style="margin-top:12px"><div class="form-grid"><label class="field">교차로<select name="id">' + opts + "</select></label>" +
    '<label class="field">사유<input name="reason" required placeholder="공사, 행사"></label>' +
    '<label class="field">시작<input type="datetime-local" name="from" required value="2026-09-27T09:00"></label>' +
    '<label class="field">종료<input type="datetime-local" name="to" required value="2026-09-27T15:00"></label></div>' +
    '<div class="btn-row"><button class="btn primary" type="submit">제외 등록</button></div></form>';
}
function settingsAccounts() {
  var rows = Object.keys(state.users).map(function (k) {
    var u = state.users[k];
    var self = state.user.loginId === u.loginId;
    return "<tr><td>" + esc(u.loginId) + "</td><td>" + esc(u.name) + "</td><td><select data-act=\"set-role\" data-id=\"" + esc(u.loginId) + "\"" + (self ? " disabled" : "") + ">" +
      option("ADMIN", "관리자", u.role) + option("OPERATOR", "운영자", u.role) + "</select></td><td>" + (u.active ? "활성" : "중지") +
      '</td><td><button type="button" class="btn" data-act="toggle-active" data-id="' + esc(u.loginId) + '"' + (self ? " disabled" : "") + ">" + (u.active ? "중지" : "활성화") + "</button> " +
      '<button type="button" class="btn" data-act="reset-pw" data-id="' + esc(u.loginId) + '">비밀번호 재설정</button> ' +
      '<button type="button" class="btn" data-act="ask-delete-user" data-id="' + esc(u.loginId) + '"' + (self ? " disabled" : "") + ">삭제</button></td></tr>";
  }).join("");
  return table(["로그인 ID", "이름", "역할", "활성", ""], rows) +
    '<form data-act="add-user" style="margin-top:12px"><div class="form-grid"><label class="field">로그인 ID<input name="loginId" required></label>' +
    '<label class="field">이름<input name="name" required></label><label class="field">역할<select name="role">' + option("OPERATOR", "운영자", "OPERATOR") + option("ADMIN", "관리자", "OPERATOR") + "</select></label>" +
    '<label class="field">초기 비밀번호<input name="password" type="password" required></label></div>' +
    '<p class="help">비밀번호는 해시로 저장한다고 보고, 화면에는 다시 보여 주지 않습니다. 자기 계정은 삭제할 수 없습니다.</p>' +
    '<div class="btn-row"><button class="btn primary" type="submit">계정 등록</button></div></form>';
}

function viewLogin() {
  var err = state.loginError ? '<p class="form-error" role="alert">' + esc(state.loginError) + "</p>" : "";
  return protoBar("SCR-LOGIN") + '<div class="login-center"><div class="login-card"><div class="brand"><span class="lamps" aria-hidden="true"><i class="r"></i><i class="a"></i><i class="g"></i></span><span><strong>Signal Guard</strong><span>실시간 교통신호 상태정보 오류검지</span></span></div>' +
    "<h1>로그인</h1>" +
    '<form id="login-form" class="login-form" data-act="login"><label class="field">아이디<input name="id" autocomplete="username" required></label>' +
    '<label class="field">비밀번호<input name="password" type="password" autocomplete="current-password" required></label>' +
    err + '<button class="btn primary" type="submit">로그인</button></form>' +
    '<div class="demo-box"><p>시연 계정. 비밀번호는 둘 다 demo 입니다. 실패 문구는 아이디와 비밀번호를 구분하지 않습니다.</p>' +
    '<div class="btn-row"><button type="button" class="btn" data-act="quick-login" data-id="operator">운영자 입장</button>' +
    '<button type="button" class="btn" data-act="quick-login" data-id="admin">관리자 입장</button></div></div></div></div>';
}

function mapInters() {
  var q = state.query.severity || "";
  return state.data.intersections.filter(function (i) {
    if (q === "anomaly") return i.severity !== "OK" && i.severity !== "INFO";
    if (q === "ERROR_UP") return i.severity === "ERROR" || i.severity === "CRITICAL";
    if (q && i.severity !== q) return false;
    return true;
  }).sort(function (a, b) {
    return (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || a.name.localeCompare(b.name, "ko");
  });
}
function mapPopup(inter) {
  var open = activeIssues(inter.id);
  var html = "<strong>" + esc(inter.name) + "</strong><div class=\"map-pop-badges\">" + sevBadge(inter.severity) +
    (inter.rule ? " <span>" + esc(inter.rule) + "</span>" : "") + "</div>" +
    "<div class=\"help\">" + esc(inter.district) + " · " + esc(inter.id) + " · 수신 " + esc(clock(inter.lastReceived)) + "</div>";
  if (inter.blocked) html += "<div>" + badge("blocked", "제공 중지") + "</div>";
  if (inter.failCode) html += "<div>" + badge("fail", "수집 장애") + " " + esc(inter.failCode) + "</div>";
  if (watchOn(inter)) html += "<div>" + badge("watch", "감시 제외") + "</div>";
  html += '<div class="btn-row"><a class="btn primary" href="#/intersections/' + inter.id + '">교차로 상세</a>';
  if (open.length) html += '<a class="btn" href="#/issues/' + open[0].id + '">' + esc(open[0].id) + "</a>";
  return html + "</div>";
}
function viewGeoMap() {
  var q = state.query.severity || "";
  var list = mapInters();
  var rows = list.map(function (i) {
    var extra = i.failCode ? " " + badge("fail", "장애") : "";
    if (i.blocked) extra += " " + badge("blocked", "제공 중지");
    return '<div class="map-row-wrap"><button type="button" class="map-row" data-act="map-focus" data-id="' + i.id + '"><span class="map-row-top"><b>' +
      esc(i.name) + "</b> " + sevBadge(i.severity) + extra + '</span><span class="help">' + esc(i.rule || "이상 없음") + " · " + esc(clock(i.lastReceived)) +
      '</span></button><a href="#/intersections/' + i.id + '">상세</a></div>';
  }).join("");
  var html = pageHead('<a href="#/dashboard">대시보드</a>', "지도", "도로와 신호만 그린 시연용 약도입니다. 점을 누르면 등급을 보고, 상세로 들어갈 수 있습니다.") +
    '<form class="filters" data-path="/map"><label>등급<select name="severity" data-auto>' +
    option("", "전체", q) + option("anomaly", "이상만", q) + option("CRITICAL", "치명", q) + option("ERROR", "오류", q) +
    option("WARN", "경고", q) + option("OK", "정상", q) + "</select></label>" +
    '<span class="help">' + list.length + "곳</span></form>" +
    '<div class="map-layout"><div class="map-stage"><div id="ops-map" role="application" aria-label="교차로 지도"></div>' +
    '<div class="map-legend"><span><i class="mdot CRITICAL"></i>치명</span><span><i class="mdot ERROR"></i>오류</span><span><i class="mdot WARN"></i>경고</span><span><i class="mdot OK"></i>정상</span></div></div>' +
    '<aside class="card map-side"><h2>교차로</h2>' +
    (rows || '<p class="help">이 조건의 교차로가 없습니다.</p>') + "</aside></div>";
  return { screen: "SCR-MAP", html: html };
}
function destroyMap() {
  if (state.map && state.map.leaflet) {
    state.map.leaflet.remove();
    state.map = null;
  }
}
function roadKm(a, b) {
  var x = (a.lng - b.lng) * 88;
  var y = (a.lat - b.lat) * 111;
  return Math.sqrt(x * x + y * y);
}
function nearestRoad(points, from, test) {
  var best = null;
  var bestD = 4.2;
  points.forEach(function (p) {
    if (p.id === from.id || !test(p, from)) return;
    var d = roadKm(p, from);
    if (d < bestD) { best = p; bestD = d; }
  });
  return best;
}
function schematicRoads(points) {
  var segs = [];
  var seen = {};
  var linked = {};
  points.forEach(function (p) { linked[p.id] = { e: false, w: false, n: false, s: false }; });
  function mark(from, to) {
    var adlng = Math.abs(to.lng - from.lng) * 88;
    var adlat = Math.abs(to.lat - from.lat) * 111;
    if (adlng >= adlat) linked[from.id][to.lng >= from.lng ? "e" : "w"] = true;
    else linked[from.id][to.lat >= from.lat ? "n" : "s"] = true;
  }
  function connect(a, b) {
    if (!b) return;
    var k = a.id < b.id ? a.id + "-" + b.id : b.id + "-" + a.id;
    if (!seen[k]) {
      seen[k] = true;
      segs.push([[a.lat, a.lng], [b.lat, b.lng]]);
    }
    mark(a, b);
    mark(b, a);
  }
  points.forEach(function (p) {
    connect(p, nearestRoad(points, p, function (q, o) {
      return q.lng > o.lng + 0.002 && Math.abs(q.lat - o.lat) * 111 <= Math.abs(q.lng - o.lng) * 88 * 0.9 + 0.6;
    }));
    connect(p, nearestRoad(points, p, function (q, o) {
      return q.lng < o.lng - 0.002 && Math.abs(q.lat - o.lat) * 111 <= Math.abs(q.lng - o.lng) * 88 * 0.9 + 0.6;
    }));
    connect(p, nearestRoad(points, p, function (q, o) {
      return q.lat > o.lat + 0.002 && Math.abs(q.lng - o.lng) * 88 <= Math.abs(q.lat - o.lat) * 111 * 0.9 + 0.6;
    }));
    connect(p, nearestRoad(points, p, function (q, o) {
      return q.lat < o.lat - 0.002 && Math.abs(q.lng - o.lng) * 88 <= Math.abs(q.lat - o.lat) * 111 * 0.9 + 0.6;
    }));
  });
  var stub = 0.007;
  points.forEach(function (p) {
    var arm = linked[p.id];
    if (!arm.e) segs.push([[p.lat, p.lng], [p.lat, p.lng + stub]]);
    if (!arm.w) segs.push([[p.lat, p.lng], [p.lat, p.lng - stub]]);
    if (!arm.n) segs.push([[p.lat, p.lng], [p.lat + stub, p.lng]]);
    if (!arm.s) segs.push([[p.lat, p.lng], [p.lat - stub, p.lng]]);
  });
  return segs;
}
function drawSchematic(map, points) {
  var segs = schematicRoads(points);
  var casing = { color: "#b4c0cb", weight: 12, lineCap: "round", lineJoin: "round", interactive: false };
  var fill = { color: "#f7f9fb", weight: 7, lineCap: "round", lineJoin: "round", interactive: false };
  segs.forEach(function (seg) { L.polyline(seg, casing).addTo(map); });
  segs.forEach(function (seg) { L.polyline(seg, fill).addTo(map); });
}
function initMap() {
  var el = document.getElementById("ops-map");
  if (!el) return;
  if (typeof L === "undefined") {
    el.innerHTML = '<p class="empty">지도를 불러오지 못했습니다.</p>';
    return;
  }
  var map = L.map(el, {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: false,
    minZoom: 10,
    maxZoom: 16
  });
  drawSchematic(map, state.data.intersections.filter(function (i) { return i.lat != null && i.lng != null; }));
  var markers = {};
  var bounds = [];
  var z = { CRITICAL: 800, ERROR: 600, WARN: 400, INFO: 200, OK: 100 };
  mapInters().forEach(function (inter) {
    if (inter.lat == null || inter.lng == null) return;
    var labeled = inter.severity !== "OK" || inter.failCode || inter.blocked || watchOn(inter);
    var icon = L.divIcon({
      className: "map-pin " + inter.severity + (inter.failCode ? " fail" : ""),
      html: '<span class="map-pin-dot"></span>' + (labeled ? '<span class="map-pin-name">' + esc(inter.name) + "</span>" : ""),
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    var marker = L.marker([inter.lat, inter.lng], { icon: icon, zIndexOffset: z[inter.severity] || 0, title: inter.name + " " + (SEV_LABEL[inter.severity] || "") });
    marker.bindPopup(mapPopup(inter), { maxWidth: 280 });
    marker.addTo(map);
    markers[inter.id] = marker;
    bounds.push([inter.lat, inter.lng]);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  else map.setView([37.47, 126.70], 11);
  state.map = { leaflet: map, markers: markers };
  setTimeout(function () {
    if (!state.map || state.map.leaflet !== map) return;
    map.invalidateSize();
    if (bounds.length) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, 60);
}
function viewFor(path) {
  if (path === "/dashboard") return viewDash();
  if (path === "/map") return viewGeoMap();
  if (path === "/intersections") return viewIntList();
  var im = path.match(/^\/intersections\/([^/]+)$/);
  if (im) return viewIntDetail(decodeURIComponent(im[1]));
  if (path === "/issues" || path.indexOf("/issues/") === 0) return viewIssues();
  if (path === "/plans") return viewPlanList();
  if (path === "/plans/mapping") return viewMap();
  var pm = path.match(/^\/plans\/([^/]+)$/);
  if (pm) return viewPlanDetail(decodeURIComponent(pm[1]));
  if (path === "/stats") return viewStats();
  if (path === "/controls") return viewControls();
  if (path === "/settings" || path === "/settings/collection") return viewSettings("collection");
  if (path === "/settings/rules") return viewSettings("rules");
  if (path === "/settings/watch") return viewSettings("watch");
  if (path === "/settings/accounts") return viewSettings("accounts");
  return null;
}

function render() {
  var parsed = parseHash();
  state.path = parsed.path;
  state.query = parsed.query;
  var app = document.getElementById("app");
  destroyMap();
  if (state.user && !state.users[state.user.loginId]) state.user = null;
  if (!state.user) {
    if (state.path !== "/login") { location.replace("#/login"); return; }
    app.innerHTML = '<div class="login-page">' + viewLogin() + "</div>";
    return;
  }
  if (state.path === "/login") { location.replace("#/dashboard"); return; }
  var view = viewFor(state.path);
  if (!view) { location.replace("#/dashboard"); return; }
  if (state.path !== state.errPath) {
    state.formError = "";
    state.errPath = state.path;
  }
  clearTimeout(render._redir);
  if (view.forbidden) {
    render._redir = setTimeout(function () { go("/dashboard"); }, 2800);
  }
  app.innerHTML = '<div class="app">' + protoBar(view.screen) + headerBar() + '<div class="body">' + sidebar() + '<main class="main" id="main">' + view.html + "</main></div></div>" + modalHtml();
  if (state.path === "/map") initMap();
  var focus = document.querySelector(".modal .btn.danger, .modal .btn.primary");
  if (focus) focus.focus();
}

function modalHtml() {
  if (!state.modal) return "";
  var m = state.modal;
  return '<div class="modal-back"><div class="modal" role="dialog" aria-modal="true"><h2>' + esc(m.title) + "</h2><p>" + esc(m.body) + '</p><div class="btn-row">' +
    '<button type="button" class="btn ' + (m.danger ? "danger" : "primary") + '" data-act="confirm-modal">' + esc(m.ok) + "</button>" +
    '<button type="button" class="btn" data-act="close-modal">취소</button></div></div></div>';
}

function addLog(entry) {
  entry.id = "CL-" + Date.now();
  state.data.logs.unshift(entry);
}
function loginAs(id, password) {
  var u = state.users[id];
  if (!u || !u.active || (password != null && u.password !== password)) {
    state.loginError = "아이디 또는 비밀번호가 올바르지 않습니다.";
    render();
    return;
  }
  state.user = { loginId: u.loginId, name: u.name, role: u.role };
  state.loginError = "";
  persist();
  go("/dashboard");
}

function doInfo() {
  state.formError = "";
  var p = state.pending;
  var issue = issueById(p.issueId);
  var inter = interById(issue.intersectionId);
  var before = "";
  if (p.mov && issue.dir && inter.directions[issue.dir]) {
    var slot = inter.directions[issue.dir][p.mov];
    before = slot.pubSec + "초 " + slot.pubSt;
    slot.pubSec = p.sec;
    slot.pubSt = p.light;
    if (p.estimate) slot.estimateBaseAt = Date.now();
  }
  inter.estimated = !!p.estimate;
  if (p.block) inter.blocked = true;
  if (!p.block) inter.blocked = false;
  var summary = (before ? before + " → " + p.sec + "초 " + p.light : "제공 상태 변경") + (inter.blocked ? " · 제공 중지" : "");
  addLog({
    at: nowLabel(), type: p.block ? "PUBLISH_BLOCK" : "MANUAL_INFO", actor: state.user.name,
    intersectionId: inter.id, rule: issue.rule, issueId: issue.id, summary: summary,
    beforeRaw: "변경 없음 (원본 불변)", beforePub: before || "—",
    afterRaw: "변경 없음 (원본 불변)", afterPub: (p.mov ? p.sec + "초 " + p.light : "값 유지") + (inter.blocked ? " · 제공 중지" : "")
  });
  issue.history.push({ at: nowLabel(), actor: state.user.name, text: "정보 통제 · " + summary });
  issue.updated = nowLabel();
  state.pending = null;
  state.modal = null;
  persist();
  toast("제공 값을 반영했습니다. 원본 수신은 그대로입니다.");
  render();
}
function doField() {
  state.formError = "";
  var p = state.pending;
  var issue = issueById(p.issueId);
  var inter = interById(issue.intersectionId);
  issue.fieldRequest = { body: p.body, at: nowLabel(), status: "OPEN", actor: state.user.name };
  if (p.block) inter.blocked = true;
  addLog({
    at: nowLabel(), type: "FIELD_REQUEST", actor: state.user.name, intersectionId: inter.id,
    rule: issue.rule, issueId: issue.id, summary: p.body, beforeRaw: "변경 없음", beforePub: inter.blocked ? "제공 중지" : "제공 중",
    afterRaw: "변경 없음. 신호제어기 호출 0건", afterPub: "요청 OPEN" + (p.block ? " · 제공 중지" : "")
  });
  issue.history.push({ at: nowLabel(), actor: state.user.name, text: "현장 통제 요청 등록 · 신호제어기 명령 없음" });
  issue.updated = nowLabel();
  state.pending = null;
  state.modal = null;
  persist();
  toast("현장 통제 요청을 기록했습니다. 신호제어기에는 명령을 보내지 않았습니다.");
  render();
}
function doStatus() {
  state.formError = "";
  var p = state.pending;
  var issue = issueById(p.issueId);
  var prev = STATUS_LABEL[issue.status] || issue.status;
  issue.status = p.status;
  issue.assignee = p.assignee;
  issue.updated = nowLabel();
  issue.history.push({ at: nowLabel(), actor: state.user.name, text: "상태 " + prev + " → " + STATUS_LABEL[p.status] + (p.assignee ? " · 담당 " + p.assignee : "") });
  state.pending = null;
  state.modal = null;
  persist();
  toast("이슈 상태를 저장했습니다.");
  render();
}
function doPlan() {
  state.formError = "";
  var p = state.pending;
  var plan = planById(p.planId);
  var before = plan.cycle + "초";
  plan.phases.forEach(function (ph, i) { ph.hold = p.holds[i]; });
  plan.cycle = p.cycle;
  plan.offset = p.offset;
  plan.tod = p.tod;
  plan.days = p.days;
  plan.updated = nowLabel();
  plan.source = plan.source === "UTIC" ? "UTIC" : "수동";
  addLog({
    at: nowLabel(), type: "PLAN_UPDATE", actor: state.user.name, intersectionId: plan.intersectionId,
    rule: "", issueId: p.issueId, summary: "사이클 " + before + " → " + plan.cycle + "초, 현시 합 " + p.sum + "초",
    beforeRaw: "—", beforePub: before, afterRaw: "—", afterPub: plan.cycle + "초"
  });
  if (p.issueId && issueById(p.issueId)) {
    var issue = issueById(p.issueId);
    issue.history.push({ at: nowLabel(), actor: state.user.name, text: "계획 저장 · 재검증 기록" });
    issue.updated = nowLabel();
  }
  state.pending = null;
  state.modal = null;
  persist();
  toast("계획을 저장하고 재검증을 기록했습니다. 원본 수신은 바꾸지 않았습니다.");
  render();
}
function doDeleteUser() {
  var id = state.pending.id;
  delete state.users[id];
  state.pending = null;
  state.modal = null;
  persist();
  toast("계정을 삭제했습니다.");
  render();
}
function doUnwatch() {
  var inter = interById(state.pending.id);
  inter.watch = false;
  inter.watchFrom = "";
  inter.watchTo = "";
  inter.watchReason = "";
  state.pending = null;
  state.modal = null;
  persist();
  toast("감시 제외를 해제했습니다.");
  render();
}

var actions = {
  logout: function () {
    state.user = null;
    persist();
    go("/login");
  },
  "reset-demo": function () {
    var id = state.user && state.user.loginId;
    state.data = SGData.createSeed();
    state.users = SGData.defaultUsers();
    state.ui = { dir: {}, diagonal: false, logOpen: {}, controlMode: {} };
    state.modal = null;
    state.pending = null;
    if (id && state.users[id]) {
      var u = state.users[id];
      state.user = { loginId: u.loginId, name: u.name, role: u.role };
    } else state.user = null;
    persist();
    toast("시연 데이터를 처음 상태로 되돌렸습니다.");
    go(state.user ? "/dashboard" : "/login");
  },
  role: function (el) {
    var role = el.getAttribute("data-role");
    var id = role === "ADMIN" ? "admin" : "operator";
    var u = state.users[id];
    state.user = { loginId: u.loginId, name: u.name, role: u.role };
    persist();
    if (!isAdmin() && (state.path.indexOf("/settings") === 0 || state.path === "/plans/mapping")) go("/dashboard");
    else render();
  },
  "quick-login": function (el) { loginAs(el.getAttribute("data-id"), null); },
  login: function (form) {
    var data = Object.fromEntries(new FormData(form).entries());
    loginAs(String(data.id || "").trim(), String(data.password || ""));
  },
  "select-dir": function (el) {
    state.ui.dir[el.getAttribute("data-id")] = el.getAttribute("data-dir");
    render();
  },
  "map-focus": function (el) {
    var id = el.getAttribute("data-id");
    document.querySelectorAll(".map-row.on").forEach(function (n) { n.classList.remove("on"); });
    el.classList.add("on");
    var marker = state.map && state.map.markers[id];
    if (!marker || !state.map.leaflet) return;
    state.map.leaflet.setView(marker.getLatLng(), 15, { animate: true });
    marker.openPopup();
  },
  "toggle-diagonal": function () {
    state.ui.diagonal = !state.ui.diagonal;
    render();
  },
  mode: function (el) {
    state.ui.controlMode[el.getAttribute("data-issue")] = el.getAttribute("data-mode");
    state.formError = "";
    render();
  },
  "add-comment": function (form) {
    var text = String(new FormData(form).get("text") || "").trim();
    if (!text) return;
    var id = form.getAttribute("data-issue");
    if (!state.data.comments[id]) state.data.comments[id] = [];
    state.data.comments[id].push({ at: nowLabel(), actor: state.user.name, role: roleLabel(state.user.role), text: text });
    var issue = issueById(id);
    issue.history.push({ at: nowLabel(), actor: state.user.name, text: "코멘트 등록" });
    issue.updated = nowLabel();
    persist();
    toast("코멘트를 등록했습니다.");
    render();
  },
  "prepare-info": function (form) {
    var data = Object.fromEntries(new FormData(form).entries());
    var sec = Number(data.sec);
    if (data.mov && (isNaN(sec) || sec < 0)) {
      state.formError = "제공 잔여초는 0 이상의 숫자여야 합니다.";
      render();
      return;
    }
    state.pending = {
      issueId: form.getAttribute("data-issue"),
      mov: data.mov || "",
      sec: isNaN(sec) ? 0 : sec,
      light: data.light || "정지",
      block: !!data.block,
      estimate: !!data.estimate
    };
    if (state.pending.block) openModal("제공 차단", "이 교차로 정보를 서비스 값으로 내보내지 않습니다. 원본 수신은 바뀌지 않습니다.", "차단하고 적용", "do-info", true);
    else doInfo();
  },
  "prepare-field": function (form) {
    var body = String(new FormData(form).get("body") || "").trim();
    if (!body) {
      state.formError = "요청 내용을 입력하세요.";
      render();
      return;
    }
    state.pending = { issueId: form.getAttribute("data-issue"), body: body, block: !!new FormData(form).get("block") };
    openModal("현장 통제 요청", "신호제어기에 명령을 보내지 않습니다. 요청 기록과 제공 차단만 남깁니다.", "요청 등록", "do-field", false);
  },
  "prepare-status": function (form) {
    var data = Object.fromEntries(new FormData(form).entries());
    var issue = issueById(form.getAttribute("data-issue"));
    state.pending = { issueId: issue.id, status: data.status, assignee: data.assignee || "" };
    if (data.status === "RESOLVED" && issue.rule === "R06" && !issue.fieldRequest) {
      state.formError = "충돌 현시(R06)는 정보 통제만으로 해결할 수 없습니다. 현장 통제 요청을 등록한 뒤에 종료할 수 있습니다.";
      state.pending = null;
      render();
      return;
    }
    if (data.status === "CLOSED" || data.status === "FALSE_POSITIVE") {
      openModal(data.status === "CLOSED" ? "이슈 종료" : "오탐 처리", "이력을 남기고 상태를 바꿉니다. 원본 수신은 바뀌지 않습니다.", "확인", "do-status", true);
      return;
    }
    doStatus();
  },
  revalidate: function (el) {
    var issue = issueById(el.getAttribute("data-issue"));
    var inter = interById(issue.intersectionId);
    var text = "재검증을 실행했습니다. ";
    if (issue.rule === "R06") {
      var rawOn = inter.directions.nt.Stsg.rawSt.indexOf("protected") === 0 && inter.directions.nt.Pdsg.rawSt.indexOf("protected") === 0;
      var pubOn = inter.directions.nt.Stsg.pubSt === "진행" && inter.directions.nt.Pdsg.pubSt === "진행";
      if (rawOn) text += "원본은 여전히 북 직진·보행 동시 진행입니다. ";
      if (!pubOn) text += "제공 값에서는 충돌이 보이지 않습니다. ";
      if (inter.blocked) text += "제공 중지라 서비스로는 나가지 않습니다. ";
      text += issue.fieldRequest ? "현장 요청이 있어 해결 처리할 수 있습니다." : "현장 통제 요청이 없으면 해결할 수 없습니다.";
    } else {
      text += issue.rule + " 조건을 다시 확인했습니다. 원본 수신은 바꾸지 않았습니다.";
    }
    issue.history.push({ at: nowLabel(), actor: state.user.name, text: text });
    issue.updated = nowLabel();
    inter.validations.unshift({ at: clock(nowLabel()), rule: issue.rule, severity: issue.severity, text: text });
    persist();
    toast(text);
    render();
  },
  "prepare-plan": function (form) {
    var plan = planById(form.getAttribute("data-plan"));
    var data = Object.fromEntries(new FormData(form).entries());
    var holds = plan.phases.map(function (_, i) { return Number(data["hold_" + i]); });
    if (holds.some(function (n) { return isNaN(n) || n < 0; })) {
      toast("유지시간은 0 이상의 숫자여야 합니다.");
      return;
    }
    var sum = holds.reduce(function (a, b) { return a + b; }, 0);
    state.pending = {
      planId: plan.id,
      issueId: form.getAttribute("data-issue") || "",
      holds: holds,
      cycle: Number(data.cycle),
      offset: Number(data.offset),
      tod: data.tod,
      days: data.days,
      sum: sum
    };
    var body = "저장하면 이 계획으로 재검증이 실행됩니다. 원본 수신은 바뀌지 않습니다.";
    if (sum !== state.pending.cycle) body += " 현시 합계 " + sum + "초, 사이클 " + state.pending.cycle + "초입니다.";
    openModal("계획 저장", body, "저장하고 재검증", "do-plan", false);
  },
  "map-set": function (el) {
    var id = el.getAttribute("data-id");
    var status = el.getAttribute("data-status");
    var inter = interById(id);
    var map = state.data.maps.find(function (m) { return m.intersectionId === id; });
    var plan = planOf(id);
    inter.mapped = status;
    if (map) map.status = status;
    if (plan) plan.active = status !== "미매핑";
    persist();
    toast(status === "확정" ? "매핑을 확정했습니다. 이제 계획 대조를 합니다." : "매핑을 해제했습니다. 계획 대조를 생략합니다.");
    render();
  },
  "toggle-log": function (el) {
    var id = el.getAttribute("data-id");
    state.ui.logOpen[id] = !state.ui.logOpen[id];
    render();
  },
  csv: function () {
    var rows = filteredStatRows();
    var lines = ["일자,교차로,crsrdId,규칙,등급,건수"].concat(rows.map(function (r) {
      return [r.day, interName(r.intersectionId), r.intersectionId, r.rule, SEV_LABEL[r.severity] || r.severity, r.count].join(",");
    }));
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "signal-guard-stats.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  },
  "save-collection": function (form) {
    var data = Object.fromEntries(new FormData(form).entries());
    var min = Number(data.collectMin);
    var poll = Number(data.pollSec);
    if (!(min > 0) || !(poll >= 5)) {
      state.formError = "수집 주기와 폴링 초를 확인해 주세요.";
      render();
      return;
    }
    state.data.settings.collectMin = min;
    state.data.settings.mapHours = Number(data.mapHours) || 24;
    state.data.settings.pollSec = poll;
    state.data.intersections.forEach(function (i) {
      i.collected = !!data["col_" + i.id];
      var pri = Number(data["pri_" + i.id]);
      if (pri > 0) i.priority = pri;
    });
    var calls = forecastCalls(min, state.data.intersections.length);
    persist();
    toast(calls > state.data.settings.quotaLimit
      ? "저장했습니다. 예상 " + num(calls) + "건은 일 한도 " + num(state.data.settings.quotaLimit) + "건을 넘습니다."
      : "저장했습니다. 수집 주기 변경은 다음 배치부터 반영됩니다.");
    render();
  },
  "save-rules": function (form) {
    var data = Object.fromEntries(new FormData(form).entries());
    state.data.rules.forEach(function (r) {
      if (data["rule_" + r.id] != null) r.value = data["rule_" + r.id];
    });
    persist();
    toast("저장했습니다. 다음 검증부터 반영됩니다.");
    render();
  },
  "add-watch": function (form) {
    var data = Object.fromEntries(new FormData(form).entries());
    var from = String(data.from || "").replace("T", " ");
    var to = String(data.to || "").replace("T", " ");
    if (from.length === 16) from += ":00";
    if (to.length === 16) to += ":00";
    if (!data.reason || from >= to) {
      state.formError = "종료는 시작보다 뒤여야 합니다.";
      render();
      return;
    }
    var inter = interById(data.id);
    inter.watch = true;
    inter.watchFrom = from;
    inter.watchTo = to;
    inter.watchReason = data.reason;
    persist();
    toast("감시 제외를 등록했습니다. 이 기간의 신규 이슈는 만들지 않습니다.");
    render();
  },
  "ask-unwatch": function (el) {
    state.pending = { id: el.getAttribute("data-id") };
    openModal("감시 제외 해제", interName(state.pending.id) + " 교차로를 다시 감시합니다.", "해제", "do-unwatch", false);
  },
  "add-user": function (form) {
    var data = Object.fromEntries(new FormData(form).entries());
    var id = String(data.loginId || "").trim();
    if (!id || !data.name || !data.password) return;
    if (state.users[id]) {
      state.formError = "이미 있는 로그인 ID입니다.";
      render();
      return;
    }
    state.users[id] = { loginId: id, password: data.password, name: data.name, role: data.role, active: true };
    persist();
    toast("계정을 등록했습니다. 비밀번호는 다시 표시하지 않습니다.");
    render();
  },
  "set-role": function (el) {
    var u = state.users[el.getAttribute("data-id")];
    if (!u || u.loginId === state.user.loginId) return;
    if (u.role === "ADMIN" && el.value !== "ADMIN") {
      var admins = Object.keys(state.users).filter(function (k) { return state.users[k].role === "ADMIN"; });
      if (admins.length < 2) { toast("마지막 관리자의 역할은 바꿀 수 없습니다."); render(); return; }
    }
    u.role = el.value;
    persist();
    toast("역할을 저장했습니다.");
  },
  "toggle-active": function (el) {
    var u = state.users[el.getAttribute("data-id")];
    if (!u || u.loginId === state.user.loginId) return;
    u.active = !u.active;
    persist();
    toast(u.active ? "계정을 활성화했습니다." : "계정을 중지했습니다.");
    render();
  },
  "reset-pw": function (el) {
    var u = state.users[el.getAttribute("data-id")];
    if (!u) return;
    u.password = "demo";
    persist();
    toast("비밀번호를 재설정했습니다. 평문은 표시하지 않습니다.");
  },
  "ask-delete-user": function (el) {
    var id = el.getAttribute("data-id");
    if (id === state.user.loginId) { toast("자기 자신은 삭제할 수 없습니다."); return; }
    var u = state.users[id];
    var admins = Object.keys(state.users).filter(function (k) { return state.users[k].role === "ADMIN"; });
    if (u.role === "ADMIN" && admins.length < 2) { toast("마지막 관리자는 삭제할 수 없습니다."); return; }
    state.pending = { id: id };
    openModal("계정 삭제", u.name + " 계정을 삭제합니다.", "삭제", "do-delete-user", true);
  },
  "confirm-modal": function () {
    var act = state.modal && state.modal.act;
    var fn = { "do-info": doInfo, "do-field": doField, "do-status": doStatus, "do-plan": doPlan, "do-delete-user": doDeleteUser, "do-unwatch": doUnwatch }[act];
    if (fn) fn();
  },
  "close-modal": function () { closeModal(); }
};

function onClick(e) {
  if (e.target.classList && e.target.classList.contains("modal-back")) { closeModal(); return; }
  var act = e.target.closest("[data-act]");
  if (act && act.tagName !== "FORM") {
    e.preventDefault();
    if (actions[act.getAttribute("data-act")]) actions[act.getAttribute("data-act")](act);
    return;
  }
  var row = e.target.closest("[data-href]");
  if (row && !e.target.closest("a,button,input,select,textarea,label")) location.hash = row.getAttribute("data-href");
}
function onSubmit(e) {
  var form = e.target;
  if (!form || !form.getAttribute) return;
  e.preventDefault();
  if (form.getAttribute("data-path")) {
    var q = {};
    new FormData(form).forEach(function (v, k) { q[k] = String(v); });
    go(withQuery(form.getAttribute("data-path"), q));
    return;
  }
  var name = form.getAttribute("data-act");
  if (name && actions[name]) actions[name](form);
}
function onChange(e) {
  var t = e.target;
  if (t.getAttribute && t.getAttribute("data-act") && actions[t.getAttribute("data-act")]) {
    actions[t.getAttribute("data-act")](t);
    return;
  }
  if (t.getAttribute && t.getAttribute("data-auto") && t.form) {
    if (t.form.requestSubmit) t.form.requestSubmit();
    else t.form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  }
}
function onInput(e) {
  if (e.target.closest && e.target.closest("#login-form") && state.loginError) {
    state.loginError = "";
    var node = document.querySelector(".form-error");
    if (node) node.remove();
  }
  if (e.target.id !== "collect-min") return;
  var el = document.querySelector("[data-live-forecast]");
  if (!el) return;
  var n = forecastCalls(Number(e.target.value), state.data.intersections.length);
  var limit = state.data.settings.quotaLimit;
  el.textContent = "표본 " + state.data.intersections.length + "곳 · 이 주기로 24시간이면 예상 " + num(n) + "건 / 한도 " + num(limit) + "건. 화면 폴링은 외부 API 주기와 별개입니다.";
  el.classList.toggle("warn", n > limit);
}
function onKey(e) {
  if (e.key === "Escape" && state.modal) { closeModal(); return; }
  if (e.key === "Enter" && e.target.getAttribute && e.target.getAttribute("data-href")) location.hash = e.target.getAttribute("data-href");
}
function tick() {
  var period = Number(state.data && state.data.settings.pollSec) || 30;
  state.pollAgo += 1;
  var label;
  if (state.pollAgo >= period) {
    state.pollAgo = 0;
    label = "갱신 중";
  } else label = "갱신 " + state.pollAgo + "초 전";
  var poll = document.querySelector('[data-live="poll"]');
  if (poll) poll.textContent = label;
  document.querySelectorAll("[data-live-sec]").forEach(function (el) {
    var bits = el.getAttribute("data-live-sec").split("|");
    var inter = interById(bits[0]);
    if (!inter) return;
    var sec = shownSec(inter, bits[1], bits[2]);
    el.textContent = (el.closest("[data-raw-sec]") ? String(sec) : String(sec)) + "초";
    var cell = el.closest("[data-raw-sec]");
    if (cell) cell.classList.toggle("diff", Math.abs(Number(cell.getAttribute("data-raw-sec")) - sec) > 0.05);
  });
  document.querySelectorAll("[data-live-plan]").forEach(function (el) {
    var inter = interById(el.getAttribute("data-id"));
    if (inter) el.textContent = planSentence(inter, el.getAttribute("data-dir"));
  });
  var cap = document.querySelector("[data-live-estimate]");
  if (cap) {
    var inter2 = interById(cap.getAttribute("data-id"));
    if (inter2) cap.textContent = estimateCaption(inter2);
  }
}

function hydrate() {
  state.data = SGData.createSeed();
  state.users = SGData.defaultUsers();
  try {
    var raw = sessionStorage.getItem("sg-proto-v1");
    if (!raw) return;
    var saved = JSON.parse(raw);
    if (!saved || !saved.data || !saved.data.intersections || saved.data.intersections.length !== 30) return;
    state.data = saved.data;
    if (saved.users) state.users = saved.users;
    if (saved.user) state.user = saved.user;
  } catch (err) { /* 저장된 시연 상태가 깨지면 시드로 시작한다 */ }
  applyCoords(state.data);
}

function applyCoords(data) {
  var coords = (typeof SGData !== "undefined" && SGData.coords) || {};
  if (!data || !data.intersections) return;
  data.intersections.forEach(function (i) {
    var c = coords[i.id];
    if (!c) return;
    if (i.lat == null) i.lat = c[0];
    if (i.lng == null) i.lng = c[1];
  });
}

function init() {
  hydrate();
  state.bootedAt = Date.now();
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("submit", onSubmit);
  document.body.addEventListener("change", onChange);
  document.body.addEventListener("input", onInput);
  document.body.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", render);
  window.matchMedia("(min-width: 1280px)").addEventListener("change", function () {
    if (state.path.indexOf("/issues") === 0) render();
  });
  setInterval(tick, 1000);
  if (!location.hash) location.hash = state.user ? "#/dashboard" : "#/login";
  else render();
}

init();

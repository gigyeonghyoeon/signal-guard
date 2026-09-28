/* Signal Guard 시연 표본. 화면 IA 0.1 와이어의 30곳·12:04 시나리오. */
var SGData = (function () {
  var DIRS = ["nt", "et", "st", "wt", "ne", "se", "sw", "nw"];

  function lamp(sec, go, rawCs) {
    return {
      rawCs: rawCs == null ? sec * 100 : rawCs,
      pubSec: sec,
      rawSt: go ? "protected-Movement-Allowed" : "stop-And-Remain",
      pubSt: go ? "진행" : "정지"
    };
  }

  function makeDirs(mode) {
    var dirs = {};
    DIRS.forEach(function (id) {
      var diag = id === "ne" || id === "se" || id === "sw" || id === "nw";
      var ns = id === "nt" || id === "st";
      var ew = id === "et" || id === "wt";
      var green = !diag && ((mode === "ns" && ns) || (mode === "ew" && ew));
      dirs[id] = {
        Stsg: lamp(diag ? 0 : green ? 28 : 6, green),
        Ltsg: lamp(0, false),
        Pdsg: lamp(diag ? 0 : 8, false)
      };
    });
    return dirs;
  }

  var ROWS = [
    ["284101", "부평역앞", "부평구"],
    ["284214", "계산교차로", "계양구"],
    ["284501", "송도컨벤시아", "연수구"],
    ["284276", "동춘교차로", "연수구"],
    ["284188", "간석오거리", "남동구"],
    ["284642", "석바위사거리", "미추홀구"],
    ["284401", "인천시청앞", "남동구"],
    ["284318", "주안역", "미추홀구"],
    ["284620", "문학경기장", "미추홀구"],
    ["284155", "작전교차로", "계양구"],
    ["284770", "송내역", "부평구"],
    ["284812", "청라호수공원", "서구"],
    ["284903", "가정오거리", "서구"],
    ["284221", "부평구청", "부평구"],
    ["284640", "석남역", "서구"],
    ["284119", "갈산역", "부평구"],
    ["284430", "삼산체육관", "부평구"],
    ["284512", "동암역", "부평구"],
    ["284088", "만수사거리", "남동구"],
    ["284360", "구월사거리", "남동구"],
    ["284745", "선학역", "연수구"],
    ["284690", "연수구청", "연수구"],
    ["284255", "동막역", "연수구"],
    ["284910", "캠퍼스타운", "연수구"],
    ["284044", "원인재역", "연수구"],
    ["284573", "남동구청", "남동구"],
    ["284668", "서창사거리", "남동구"],
    ["284390", "논현사거리", "남동구"],
    ["284990", "도화사거리", "미추홀구"],
    ["284147", "가좌사거리", "서구"]
  ];

  var COORDS = {
    "284101": [37.4894, 126.7246],
    "284214": [37.5418, 126.7362],
    "284501": [37.3886, 126.6435],
    "284276": [37.4056, 126.6824],
    "284188": [37.4646, 126.6942],
    "284642": [37.4576, 126.6924],
    "284401": [37.4560, 126.7052],
    "284318": [37.4649, 126.6798],
    "284620": [37.4348, 126.6934],
    "284155": [37.5304, 126.7228],
    "284770": [37.4876, 126.7530],
    "284812": [37.5308, 126.6416],
    "284903": [37.5176, 126.6754],
    "284221": [37.5074, 126.7218],
    "284640": [37.5064, 126.6762],
    "284119": [37.5172, 126.7215],
    "284430": [37.5083, 126.7375],
    "284512": [37.4708, 126.7028],
    "284088": [37.4549, 126.7321],
    "284360": [37.4486, 126.7016],
    "284745": [37.4268, 126.6988],
    "284690": [37.4096, 126.6784],
    "284255": [37.3978, 126.6736],
    "284910": [37.3756, 126.6332],
    "284044": [37.4128, 126.6876],
    "284573": [37.4474, 126.7314],
    "284668": [37.4236, 126.7476],
    "284390": [37.4006, 126.7225],
    "284990": [37.4662, 126.6686],
    "284147": [37.4896, 126.6754]
  };

  function createSeed() {
    var intersections = ROWS.map(function (row, i) {
      var mapped = "확정";
      if (row[0] === "284620" || row[0] === "284812") mapped = "미매핑";
      if (row[0] === "284501") mapped = "후보";
      return {
        id: row[0],
        name: row[1],
        district: "인천광역시 " + row[2],
        severity: "OK",
        rule: "",
        blocked: false,
        estimated: false,
        mapped: mapped,
        watch: false,
        watchFrom: "",
        watchTo: "",
        watchReason: "",
        collected: true,
        priority: 5,
        failCode: "",
        lastReceived: "2026-09-27 12:04:0" + (i % 6),
        lat: (COORDS[row[0]] || [37.47, 126.70])[0],
        lng: (COORDS[row[0]] || [37.47, 126.70])[1],
        planSource: row[0] === "284401" ? "UTIC" : "시드",
        directions: makeDirs(i % 2 === 0 ? "ns" : "ew"),
        validations: [{
          at: "12:04:05",
          rule: "",
          severity: "OK",
          text: mapped === "미매핑" ? "계획 대조 생략 · 미매핑" : "계획 대조 통과"
        }]
      };
    });

    function byId(id) {
      return intersections.find(function (x) { return x.id === id; });
    }

    var bup = byId("284101");
    bup.severity = "CRITICAL";
    bup.rule = "R06";
    bup.blocked = true;
    bup.estimated = true;
    bup.priority = 1;
    bup.planSource = "수동";
    bup.lastReceived = "2026-09-27 12:04:11";
    bup.directions.nt.Stsg = lamp(28, true, 3200);
    bup.directions.nt.Pdsg = lamp(14, true, 1400);
    bup.directions.nt.Ltsg = lamp(0, false, 0);
    bup.directions.st.Stsg = lamp(28, true, 2800);
    bup.directions.st.Pdsg = lamp(0, false, 0);
    bup.validations = [
      { at: "12:04:11", rule: "R06", severity: "CRITICAL", text: "북 직진과 북 보행이 동시에 진행" },
      { at: "12:03:11", rule: "R11", severity: "ERROR", text: "직전 주기 점등·잔여 불일치 · 해소" }
    ];

    var gye = byId("284214");
    gye.severity = "ERROR";
    gye.rule = "R03";
    gye.priority = 2;
    gye.planSource = "추정";
    gye.lastReceived = "2026-09-27 12:03:40";
    gye.directions.et.Stsg = lamp(18, true, 6100);
    gye.directions.wt.Stsg = lamp(18, true, 1800);
    gye.validations = [
      { at: "12:03:40", rule: "R03", severity: "ERROR", text: "동 직진 잔여시간이 수집 간격보다 커짐 (18초 → 61초)" }
    ];

    var songdo = byId("284501");
    songdo.severity = "WARN";
    songdo.rule = "R07";
    songdo.priority = 3;
    songdo.planSource = "시드";
    songdo.lastReceived = "2026-09-27 11:52:02";
    songdo.validations = [
      { at: "11:52:02", rule: "R07", severity: "WARN", text: "수신 지연. 마지막 성공 수신 이후 약 12분" }
    ];

    var dongchun = byId("284276");
    dongchun.severity = "WARN";
    dongchun.rule = "R02";
    dongchun.priority = 3;
    dongchun.lastReceived = "2026-09-27 12:02:18";
    dongchun.directions = makeDirs("ns");
    dongchun.directions.nt.Stsg = lamp(48, true, 4800);
    dongchun.directions.st.Stsg = lamp(48, true, 4800);
    dongchun.validations = [
      { at: "12:02:18", rule: "R02", severity: "WARN", text: "직진 잔여 48초. 계획 유지 30초 + 여유 5초를 넘음" }
    ];

    var ganseok = byId("284188");
    ganseok.severity = "WARN";
    ganseok.rule = "R04";
    ganseok.priority = 3;
    ganseok.lastReceived = "2026-09-27 12:01:44";
    ganseok.directions.nt.Stsg = lamp(2, true, 200);
    ganseok.directions.st.Stsg = lamp(2, true, 200);
    ganseok.validations = [
      { at: "12:01:44", rule: "R04", severity: "WARN", text: "직진 잔여 40초에서 2초로 급감. 계획 전환으로 설명 불가" }
    ];

    var seok = byId("284642");
    seok.severity = "WARN";
    seok.rule = "R10";
    seok.priority = 3;
    seok.lastReceived = "2026-09-27 12:00:55";
    seok.validations = [
      { at: "12:00:55", rule: "R10", severity: "WARN", text: "현재 시각의 운영이 평일 TOD 06:30–22:00과 어긋남" }
    ];

    var munhak = byId("284620");
    munhak.watch = true;
    munhak.watchFrom = "2026-09-27 09:00:00";
    munhak.watchTo = "2026-09-27 15:00:00";
    munhak.watchReason = "행사 구간 임시 제외";
    munhak.planSource = "시드";

    var dohwa = byId("284990");
    dohwa.failCode = "SERVICETIMEOUT_ERROR";
    dohwa.lastReceived = "2026-09-27 11:40:02";
    dohwa.validations = [
      { at: "11:40:02", rule: "", severity: "WARN", text: "수집 실패 SERVICETIMEOUT_ERROR. 화면은 마지막 수신을 유지" }
    ];

    var issues = [
      {
        id: "ISS-142",
        intersectionId: "284101",
        dir: "nt",
        movement: "북 직진 vs 보행",
        focusMov: "Pdsg",
        rule: "R06",
        ruleName: "충돌 현시 동시 녹색",
        severity: "CRITICAL",
        status: "OPEN",
        opened: "2026-09-27 12:04:11",
        updated: "2026-09-27 12:04:12",
        assignee: "",
        cause: "북 직진과 북 보행이 동시에 진행입니다. 제공 값을 바꿔도 현장 등화는 바뀌지 않으므로, 정보 통제만으로는 이 이슈를 해결할 수 없습니다.",
        snapshotRaw: "ntStsgRmndCs 3200 (32.00초) protected-Movement-Allowed / ntPdsgRmndCs 1400 (14.00초) protected-Movement-Allowed",
        snapshotPub: "북 직진 28초 진행 / 북 보행 14초 진행",
        fieldRequest: null,
        history: [
          { at: "2026-09-27 12:04:11", actor: "시스템", text: "이슈 등록 · OPEN" },
          { at: "2026-09-27 12:04:12", actor: "시스템", text: "R06 기본 정책으로 제공 차단" }
        ]
      },
      {
        id: "ISS-138",
        intersectionId: "284214",
        dir: "et",
        movement: "동 직진",
        focusMov: "Stsg",
        rule: "R03",
        ruleName: "잔여시간 역증가",
        severity: "ERROR",
        status: "ACK",
        opened: "2026-09-27 12:03:40",
        updated: "2026-09-27 12:05:02",
        assignee: "조찬희",
        cause: "수집 간격보다 잔여시간이 커졌고, 계획상 현시 전환 시각이 아닙니다.",
        snapshotRaw: "etStsgRmndCs 6100 (61.00초) protected-Movement-Allowed",
        snapshotPub: "동 직진 18초 진행",
        fieldRequest: null,
        history: [
          { at: "2026-09-27 12:03:40", actor: "시스템", text: "이슈 등록 · OPEN" },
          { at: "2026-09-27 12:04:50", actor: "조찬희", text: "상태 ACK" }
        ]
      },
      {
        id: "ISS-119",
        intersectionId: "284501",
        dir: "",
        movement: "수신 전체",
        focusMov: "",
        rule: "R07",
        ruleName: "수신 지연",
        severity: "WARN",
        status: "IN_PROGRESS",
        opened: "2026-09-27 11:52:02",
        updated: "2026-09-27 12:01:10",
        assignee: "기경현",
        cause: "마지막 성공 수신이 수집 주기와 WARN 임계(30초)를 크게 넘겼습니다. 값은 마지막 수신분을 유지합니다.",
        snapshotRaw: "마지막 성공 수신 11:52:02",
        snapshotPub: "제공 값은 11:52:02 수신분. 이후 배치 실패가 아님 · 미수신",
        fieldRequest: null,
        history: [
          { at: "2026-09-27 11:52:02", actor: "시스템", text: "이슈 등록 · OPEN" },
          { at: "2026-09-27 12:01:10", actor: "기경현", text: "상태 진행 · 확인 코멘트" }
        ]
      },
      {
        id: "ISS-090",
        intersectionId: "284360",
        dir: "st",
        movement: "남 직진",
        focusMov: "Stsg",
        rule: "R11",
        ruleName: "점등·잔여 불일치",
        severity: "ERROR",
        status: "RESOLVED",
        opened: "2026-09-26 16:12:08",
        updated: "2026-09-26 16:40:22",
        assignee: "조찬희",
        cause: "점등은 정지인데 잔여시간이 진행 구간에 해당했습니다. 제공 값만 보정했습니다.",
        snapshotRaw: "stStsgRmndCs 2200 (22.00초) stop-And-Remain",
        snapshotPub: "남 직진 22초 정지",
        fieldRequest: null,
        history: [
          { at: "2026-09-26 16:12:08", actor: "시스템", text: "이슈 등록 · OPEN" },
          { at: "2026-09-26 16:40:22", actor: "조찬희", text: "수동 정보 통제 후 RESOLVED" }
        ]
      }
    ];

    var comments = {
      "ISS-138": [
        { at: "2026-09-27 12:05:02", actor: "기경현", role: "운영자", text: "현장 잔여시간과 제공 값이 다릅니다. 확인 부탁드립니다." }
      ],
      "ISS-119": [
        { at: "2026-09-27 12:01:10", actor: "기경현", role: "운영자", text: "송도 방향 수신이 11:52 이후 없습니다. 다음 배치를 보겠습니다." }
      ]
    };

    var logs = [
      {
        id: "CL-B1",
        at: "2026-09-27 12:04:12",
        type: "PUBLISH_BLOCK",
        actor: "시스템",
        intersectionId: "284101",
        rule: "R06",
        issueId: "ISS-142",
        summary: "제공 중 → 제공 중지",
        beforeRaw: "ntStsg 3200cs · protected-Movement-Allowed",
        beforePub: "제공 중 · 북 직진 28초 진행",
        afterRaw: "변경 없음 (원본 불변)",
        afterPub: "제공 중지"
      },
      {
        id: "CL-M1",
        at: "2026-09-26 16:40:22",
        type: "MANUAL_INFO",
        actor: "조찬희",
        intersectionId: "284360",
        rule: "R11",
        issueId: "ISS-090",
        summary: "남 직진 제공 잔여 22초·진행 → 0초·정지",
        beforeRaw: "stStsgRmndCs 2200 · stop-And-Remain",
        beforePub: "22초 진행",
        afterRaw: "변경 없음 (원본 불변)",
        afterPub: "0초 정지"
      },
      {
        id: "CL-P1",
        at: "2026-09-26 09:18:00",
        type: "PLAN_UPDATE",
        actor: "조찬희",
        intersectionId: "284401",
        rule: "",
        issueId: "",
        summary: "인천시청앞 평일 사이클 110초 → 120초",
        beforeRaw: "—",
        beforePub: "사이클 110초",
        afterRaw: "—",
        afterPub: "사이클 120초"
      },
      {
        id: "CL-F1",
        at: "2026-09-25 18:02:41",
        type: "FIELD_REQUEST",
        actor: "조찬희",
        intersectionId: "284318",
        rule: "R05",
        issueId: "",
        summary: "주안역 현시 순서 확인 요청 · 요청 상태 DONE",
        beforeRaw: "현시 순서 스냅샷 유지",
        beforePub: "제공 중지였음",
        afterRaw: "변경 없음",
        afterPub: "현장 요청 DONE · 제공 재개"
      }
    ];

    var autoTargets = ["284155", "284318", "284770", "284221", "284119", "284512", "284088", "284745", "284255", "284044", "284668", "284147"];
    autoTargets.forEach(function (id, i) {
      var hh = 8 + Math.floor(i / 2);
      var mm = 10 + i * 3;
      logs.push({
        id: "CL-A" + (i + 1),
        at: "2026-09-27 " + String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + ":08",
        type: "AUTO_INFO",
        actor: "시스템",
        intersectionId: id,
        rule: i % 2 === 0 ? "R12" : "R02",
        issueId: "",
        summary: i % 2 === 0 ? "코드값 정규화 18000cs → 180초" : "잔여시간 경미 이탈 보정",
        beforeRaw: i % 2 === 0 ? "18000 cs" : "잔여 33초 (원본)",
        beforePub: i % 2 === 0 ? "18000 (미정규화)" : "33초",
        afterRaw: "변경 없음 (원본 불변)",
        afterPub: i % 2 === 0 ? "180초" : "30초"
      });
    });

    logs.sort(function (a, b) { return a.at < b.at ? 1 : -1; });

    var plans = intersections.map(function (inter) {
      return {
        id: "P-" + inter.id,
        intersectionId: inter.id,
        source: inter.planSource,
        active: inter.mapped !== "미매핑",
        cycle: 120,
        offset: inter.id === "284101" ? 4 : 0,
        tod: "06:30–22:00",
        days: "평일",
        updated: "2026-09-26 18:20:00",
        phases: [
          { dir: "북·남", kind: "직진", hold: 30, ring: "A" },
          { dir: "북·남", kind: "좌회전", hold: 15, ring: "A" },
          { dir: "북·남", kind: "보행", hold: 20, ring: "B" },
          { dir: "동·서", kind: "직진", hold: 25, ring: "A" },
          { dir: "동·서", kind: "좌회전", hold: 12, ring: "A" },
          { dir: "동·서", kind: "보행", hold: 13, ring: "B" },
          { dir: "전방향", kind: "전적", hold: 5, ring: "A" }
        ],
        constraints: [
          "북·남 직진 진행과 북 보행 진행은 동시에 둘 수 없음",
          "동·서 직진 진행과 동 보행 진행은 동시에 둘 수 없음"
        ]
      };
    });

    var maps = intersections.map(function (inter, i) {
      var special = {
        "284101": ["18421", 12],
        "284214": ["18488", 20],
        "284401": ["18501", 8],
        "284501": ["19002", 48],
        "284620": ["19110", 86],
        "284812": ["19240", 120]
      };
      var pair = special[inter.id] || [String(18000 + i), 8 + (i % 17)];
      return {
        intersectionId: inter.id,
        uticNo: inter.mapped === "미매핑" ? pair[0] : pair[0],
        meters: pair[1],
        status: inter.mapped
      };
    });

    var rules = [
      ["R01", "필수 필드 누락", "필수 필드", "교차로·방향·점등·잔여·시각", "ERROR"],
      ["R02", "잔여시간 범위", "계획 유지 여유(초)", "5", "ERROR"],
      ["R03", "잔여시간 역증가", "허용 증가(초)", "0", "ERROR"],
      ["R04", "잔여시간 급감", "설명 불가 감소(초)", "15", "ERROR"],
      ["R05", "현시 순서 위반", "순서 이탈", "불허", "ERROR"],
      ["R06", "충돌 현시 동시 녹색", "동시 진행", "불허", "CRITICAL"],
      ["R07", "수신 지연", "WARN / ERROR (초)", "30 / 90", "WARN"],
      ["R08", "중복 수신", "동일 키", "자동 제거", "INFO"],
      ["R09", "시각 역행", "허용 역행(초)", "2", "ERROR"],
      ["R10", "TOD 불일치", "운영시각 이탈(분)", "5", "ERROR"],
      ["R11", "점등·잔여 불일치", "적색 중 진행 구간", "불허", "ERROR"],
      ["R12", "코드 정규화 실패", "매핑 실패", "이슈", "ERROR"]
    ].map(function (r) {
      return { id: r[0], name: r[1], param: r[2], value: r[3], grade: r[4] };
    });

    var statDays = [
      { label: "09-21", critical: 0, error: 3, warn: 5 },
      { label: "09-22", critical: 1, error: 2, warn: 4 },
      { label: "09-23", critical: 0, error: 4, warn: 3 },
      { label: "09-24", critical: 0, error: 2, warn: 6 },
      { label: "09-25", critical: 1, error: 3, warn: 4 },
      { label: "09-26", critical: 0, error: 2, warn: 5 },
      { label: "09-27", critical: 1, error: 1, warn: 4 }
    ];

    var statHours = [
      { label: "08", critical: 0, error: 0, warn: 1 },
      { label: "09", critical: 0, error: 1, warn: 1 },
      { label: "10", critical: 0, error: 0, warn: 2 },
      { label: "11", critical: 0, error: 0, warn: 1 },
      { label: "12", critical: 1, error: 1, warn: 0 }
    ];

    var statRows = [
      ["2026-09-27", "284101", "R06", "CRITICAL", 1],
      ["2026-09-27", "284214", "R03", "ERROR", 1],
      ["2026-09-27", "284501", "R07", "WARN", 1],
      ["2026-09-27", "284276", "R02", "WARN", 1],
      ["2026-09-27", "284188", "R04", "WARN", 1],
      ["2026-09-27", "284642", "R10", "WARN", 1],
      ["2026-09-26", "284360", "R11", "ERROR", 1],
      ["2026-09-26", "284401", "R02", "WARN", 2],
      ["2026-09-25", "284318", "R05", "CRITICAL", 1],
      ["2026-09-25", "284770", "R07", "WARN", 2],
      ["2026-09-24", "284221", "R04", "ERROR", 1],
      ["2026-09-24", "284119", "R07", "WARN", 3],
      ["2026-09-23", "284512", "R03", "ERROR", 2],
      ["2026-09-22", "284088", "R02", "ERROR", 1],
      ["2026-09-22", "284101", "R06", "CRITICAL", 1],
      ["2026-09-21", "284745", "R11", "ERROR", 1],
      ["2026-09-21", "284255", "R07", "WARN", 2]
    ].map(function (r) {
      return { day: r[0], intersectionId: r[1], rule: r[2], severity: r[3], count: r[4] };
    });

    return {
      scenario: "2026-09-27 12:04:11",
      pipelineLagSec: 8,
      settings: {
        pollSec: 30,
        collectMin: 15,
        mapHours: 24,
        quotaUsed: 2880,
        quotaLimit: 5000,
        randomErrors: false,
        randomErrorCount: 6
      },
      intersections: intersections,
      issues: issues,
      comments: comments,
      logs: logs,
      plans: plans,
      maps: maps,
      rules: rules,
      statDays: statDays,
      statHours: statHours,
      statRows: statRows
    };
  }

  function defaultUsers() {
    return {
      admin: { loginId: "admin", password: "demo", name: "조찬희", role: "ADMIN", active: true },
      operator: { loginId: "operator", password: "demo", name: "기경현", role: "OPERATOR", active: true },
      soomin: { loginId: "soomin", password: "demo", name: "이수민", role: "OPERATOR", active: true }
    };
  }

  return { createSeed: createSeed, defaultUsers: defaultUsers, coords: COORDS };
})();

window.SG_DOCS = [
  {
    id: "def",
    phase: "분석",
    week: "1–3",
    title: "프로젝트정의서",
    path: "프로젝트정의서.md",
    note: "왜 만드는가, 범위, 데이터"
  },
  {
    id: "rfp",
    phase: "분석",
    week: "1–3",
    title: "제안요청서 요구사항 대응표",
    path: "분석/제안요청서요구사항대응표.md",
    note: "RFP 39건 대응"
  },
  {
    id: "req",
    phase: "분석",
    week: "1–3",
    title: "요구사항정의서",
    path: "분석/요구사항정의서.md",
    note: "무엇을, 수용 기준"
  },
  {
    id: "uc",
    phase: "분석",
    week: "1–3",
    title: "유스케이스 · 사용자 스토리",
    path: "분석/유스케이스사용자스토리.md",
    note: "UC 11 · US 33"
  },
  {
    id: "wbs",
    phase: "분석",
    week: "1–3",
    title: "제품 백로그 · WBS",
    path: "백로그WBS.md",
    note: "언제, 누가, 얼마나"
  },
  {
    id: "arch",
    phase: "설계",
    week: "4",
    title: "시스템 아키텍처",
    path: "설계/시스템아키텍처.md",
    note: "5계층 · 컴포넌트"
  },
  {
    id: "arch-img",
    phase: "설계",
    week: "4",
    title: "시스템 아키텍처 구조도",
    path: "설계/시스템 아키텍처 구조도.png",
    type: "image",
    note: "논리 구성도"
  },
  {
    id: "ia",
    phase: "설계",
    week: "4",
    title: "화면 IA · 와이어",
    path: "설계/화면IA.md",
    note: "필수 6화면"
  },
  {
    id: "erd",
    phase: "설계",
    week: "4",
    title: "논리 ERD",
    path: "설계/ERD.md",
    note: "원본 / 제공 분리"
  },
  {
    id: "api",
    phase: "설계",
    week: "4",
    title: "REST API 명세",
    path: "설계/API명세.md",
    note: "/api/v1 · RBAC"
  }
];

window.SG = window.SG || {};

SG.base = function () {
  const raw = document.documentElement.getAttribute("data-base");
  return raw == null || raw === "" ? "" : raw;
};

SG.docUrl = function (path) {
  return encodeURI(SG.base() + path);
};

SG.findDoc = function (id) {
  return SG_DOCS.find((d) => d.id === id);
};

SG.renderDocInto = async function (el, doc) {
  el.innerHTML = "";
  const head = document.createElement("div");
  head.className = "doc-head";
  head.innerHTML =
    "<div><p class='file-tag'>" +
    doc.path +
    "</p><h2>" +
    doc.title +
    "</h2><p class='note'>" +
    doc.phase +
    " · " +
    doc.week +
    "주 · " +
    doc.note +
    "</p></div>";
  el.appendChild(head);

  const body = document.createElement("div");
  body.className = "doc-body md";
  el.appendChild(body);

  if (doc.type === "image") {
    const img = document.createElement("img");
    img.src = SG.docUrl(doc.path);
    img.alt = doc.title;
    body.appendChild(img);
    return;
  }

  try {
    const res = await fetch(SG.docUrl(doc.path));
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    if (window.marked) {
      body.innerHTML = marked.parse(text, { gfm: true, breaks: false });
    } else {
      body.innerHTML = "<pre class='raw'></pre>";
      body.querySelector("pre").textContent = text;
    }
  } catch (err) {
    body.innerHTML =
      "<div class='card'><h3>원문을 읽지 못했습니다</h3>" +
      "<p>파일 위치: <b>" +
      doc.path +
      "</b></p></div>";
  }
};

window.SG_WEEKS = [
  {
    week: "3주차",
    title: "주간 보고",
    href: "발표/3주차.html",
    note: "분석 단계 마무리"
  },
  {
    week: "4주차",
    title: "주간 보고",
    href: "발표/4주차.html",
    note: "설계 1주차 산출물"
  }
];

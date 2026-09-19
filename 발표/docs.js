window.SG_DOCS = [
  {
    id: "def",
    phase: "분석",
    week: "1–3",
    title: "프로젝트 정의서",
    path: "프로젝트정의서.md"
  },
  {
    id: "rfp-src",
    phase: "분석",
    week: "1–3",
    title: "제안 요청서",
    path: "분석/제안요청서(실시간 교통신호 상태정보 오류검지 시스템 구축)_공고.hwp",
    type: "file"
  },
  {
    id: "req",
    phase: "분석",
    week: "1–3",
    title: "요구사항 정의서",
    path: "분석/요구사항정의서.md"
  },
  {
    id: "rfp",
    phase: "분석",
    week: "1–3",
    title: "요구사항 대응표",
    path: "분석/제안요청서요구사항대응표.md"
  },
  {
    id: "uc",
    phase: "분석",
    week: "1–3",
    title: "유스케이스 사용자 스토리",
    path: "분석/유스케이스사용자스토리.md"
  },
  {
    id: "backlog",
    phase: "분석",
    week: "1–3",
    title: "백로그",
    path: "백로그WBS.md",
    heading: "3. 제품 백로그"
  },
  {
    id: "wbs",
    phase: "분석",
    week: "1–3",
    title: "WBS",
    path: "백로그WBS.md",
    heading: "4. WBS"
  },
  {
    id: "arch",
    phase: "설계",
    week: "4",
    title: "시스템 아키텍처 설계서 및 구조도",
    path: "설계/시스템아키텍처.md",
    image: "설계/시스템 아키텍처 구조도.png"
  },
  {
    id: "ia",
    phase: "설계",
    week: "4",
    title: "화면 IA 설계서",
    path: "설계/화면IA.md"
  },
  {
    id: "erd",
    phase: "설계",
    week: "4",
    title: "ERD",
    path: "설계/ERD.md"
  },
  {
    id: "api",
    phase: "설계",
    week: "4",
    title: "API 명세",
    path: "설계/API명세.md"
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
  if (id === "arch-img") id = "arch";
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
    "</h2></div>";
  el.appendChild(head);

  const body = document.createElement("div");
  body.className = "doc-body md";
  el.appendChild(body);

  if (doc.image) {
    const img = document.createElement("img");
    img.src = SG.docUrl(doc.image);
    img.alt = doc.title;
    body.appendChild(img);
  }

  if (doc.type === "file") {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML =
      "<h3>원본 파일</h3><p>브라우저에서 바로 보이지 않는 형식이면 파일을 내려받아 여세요.</p>";
    const a = document.createElement("a");
    a.className = "ghost primary";
    a.href = SG.docUrl(doc.path);
    a.textContent = "원본 열기";
    card.appendChild(a);
    body.appendChild(card);
    return;
  }

  if (doc.type === "image") {
    if (!doc.image) {
      const img = document.createElement("img");
      img.src = SG.docUrl(doc.path);
      img.alt = doc.title;
      body.appendChild(img);
    }
    return;
  }

  try {
    const res = await fetch(SG.docUrl(doc.path));
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    const md = document.createElement("div");
    if (window.marked) {
      md.innerHTML = marked.parse(text, { gfm: true, breaks: false });
    } else {
      md.innerHTML = "<pre class='raw'></pre>";
      md.querySelector("pre").textContent = text;
    }
    body.appendChild(md);
  } catch (err) {
    const fail = document.createElement("div");
    fail.className = "card";
    fail.innerHTML =
      "원문을 읽지 못했습니다. 파일 위치: <b>" +
      doc.path +
      "</b>";
    body.appendChild(fail);
  }
};

window.SG_WEEKS = [
  {
    week: "4주차",
    title: "주간 보고",
    href: "발표/4주차.html",
    note: "이번 주"
  },
  {
    week: "3주차",
    title: "주간 보고",
    href: "발표/3주차.html",
    note: "지난주"
  }
];

const statusLabel = { eligible: "Eligible", possible: "Possibly eligible", "not-eligible": "Not eligible" };

let scholarships = [];
let student = null;
let currentFilter = "all";
let selectedId = null;

const grid = document.getElementById("grid");

/* ------------------------------------------------------------
   STICKY HEADER BACKDROP
   ------------------------------------------------------------ */
const topBar = document.querySelector(".top-bar");

function updateTopBarBackdrop() {
  if (!topBar) return;
  const isScrolled = window.scrollY > 0;
  topBar.classList.toggle("is-scrolled", isScrolled);
  topBar.style.setProperty("--top-bar-height", `${topBar.getBoundingClientRect().height}px`);
}

if (topBar) {
  updateTopBarBackdrop();
  window.addEventListener("scroll", updateTopBarBackdrop, { passive: true });
  window.addEventListener("resize", updateTopBarBackdrop);
}

/* ------------------------------------------------------------
   INIT
   ------------------------------------------------------------ */
async function init() {
  const meRes = await fetch("/api/student/me");
  if (meRes.status === 401) {
    window.location.href = "student-login.html";
    return;
  }
  student = await meRes.json();

  document.getElementById("greeting").textContent = `Welcome back, ${student.name.split(" ")[0]}`;
  document.getElementById("avatarInitial").textContent = student.name.charAt(0).toUpperCase();
  document.getElementById("student-name").textContent = student.name;

  document.getElementById("profile-details").innerHTML = `
    <div class="profile-detail-row"><span>Institution</span><span>${student.institution_name}</span></div>
    <div class="profile-detail-row"><span>State</span><span>${student.state}</span></div>
    <div class="profile-detail-row"><span>Course</span><span>${student.course}</span></div>
    <div class="profile-detail-row"><span>Category</span><span>${student.category.toUpperCase()}</span></div>
    <div class="profile-detail-row"><span>GPA</span><span>${student.gpa}</span></div>
    <div class="profile-detail-row"><span>Age</span><span>${student.age}</span></div>
  `;

  await loadScholarships();
}

async function loadScholarships() {
  const res = await fetch("/api/scholarships");
  if (res.status === 401) {
    window.location.href = "student-login.html";
    return;
  }
  scholarships = await res.json();
  renderGrid();
  updateBadge();
  if (selectedId !== null) {
    const still = scholarships.find((s) => s.id === selectedId);
    if (still) showDetails(selectedId);
  }
}

/* ------------------------------------------------------------
   GRID
   ------------------------------------------------------------ */
function renderGrid() {
  grid.innerHTML = "";
  const list = scholarships.filter((s) => currentFilter === "all" || s.eligibility === currentFilter);
  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#f0ede4; padding:30px;">No scholarships match this filter yet.</div>`;
    return;
  }
  list.forEach((s) => {
    const card = document.createElement("div");
    card.className = "card" + (s.id === selectedId ? " selected" : "");
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="strip ${s.eligibility}"></div>
      <div class="card-body">
        <span class="status-tag ${s.eligibility}">${statusLabel[s.eligibility]}</span>
        <h3>${s.name}</h3>
        <div class="institution">${s.institution}</div>
        <div class="card-meta"><span>Deadline <b>${s.deadline}</b></span><span>${s.score}% match</span></div>
      </div>
      <div class="card-actions">
        <button class="btn btn-primary" data-action="view">View details</button>
        <button class="btn btn-add ${s.added_to_checklist ? "added" : ""}" data-action="add">${s.added_to_checklist ? "\u2713 Added" : "+ Checklist"}</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

grid.addEventListener("click", async (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const id = Number(card.dataset.id);
  const action = e.target.dataset.action;
  if (action === "add") {
    await toggleAdd(id);
    return;
  }
  showDetails(id);
});

async function toggleAdd(id) {
  const s = scholarships.find((x) => x.id === id);
  const endpoint = s.added_to_checklist ? `/api/checklist/${id}/remove` : `/api/checklist/${id}/add`;
  await fetch(endpoint, { method: "POST" });
  await loadScholarships();
}

function updateBadge() {
  const count = scholarships.filter((s) => s.added_to_checklist).length;
  document.getElementById("checklistCount").textContent = count;
}

/* ------------------------------------------------------------
   DETAILS — tick/cross for every rule
   ------------------------------------------------------------ */
function showDetails(id) {
  selectedId = id;
  document.querySelectorAll(".card").forEach((c) => c.classList.toggle("selected", Number(c.dataset.id) === id));
  const s = scholarships.find((x) => x.id === id);
  document.getElementById("detailsEmpty").style.display = "none";
  const content = document.getElementById("detailsContent");
  content.classList.add("show");

  const ruleItems = s.rule_results
    .map(
      (r) => `
        <li>
          <span class="rule-icon ${r.passed ? "pass" : "fail"}">${r.passed ? "\u2713" : "\u2715"}</span>
          <span>${r.label}: ${r.detail}</span>
          <span class="rule-weight">wt ${r.weight}</span>
        </li>`
    )
    .join("");

  content.innerHTML = `
    <div class="d-top">
      <div>
        <span class="status-tag ${s.eligibility}">${statusLabel[s.eligibility]}</span>
        <h3>${s.name}</h3>
        <div class="d-inst">${s.institution}</div>
      </div>
      <div class="d-amount">${s.score}%<span>weighted match</span></div>
    </div>

    <p class="score-line">You met <b>${s.rule_results.filter((r) => r.passed).length} of ${s.rule_results.length}</b> eligibility rules, weighted by importance.</p>

    <div class="d-body">
      <div>
        <h4>Eligibility rules</h4>
        <ul class="rule-check-list">${ruleItems}</ul>
        <h4>Documents required</h4>
        <ul class="req-list">${(s.required_documents || []).map((r) => `<li>${r}</li>`).join("")}</ul>
      </div>
      <div class="d-side">
        <div class="d-stat"><div class="label">Application deadline</div><div class="value">${s.deadline}</div></div>
        <div class="d-stat"><div class="label">Providing institution</div><div class="value">${s.institution}</div></div>
        <div class="d-actions">
          <a class="btn btn-outline" href="${s.notice_link}" target="_blank" rel="noopener">Official notice &#8599;</a>
          <button class="btn btn-add ${s.added_to_checklist ? "added" : ""}" onclick="toggleAdd(${s.id}).then(() => showDetails(${s.id}))">${s.added_to_checklist ? "\u2713 Added to checklist" : "+ Add to checklist"}</button>
        </div>
      </div>
    </div>
  `;
  document.querySelector(".details-heading h2").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("filters").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  currentFilter = chip.dataset.filter;
  renderGrid();
});

/* ------------------------------------------------------------
   CHECKLIST DRAWER
   ------------------------------------------------------------ */
const overlay = document.getElementById("overlay");
const drawer = document.getElementById("drawer");

document.getElementById("checklistBtn").addEventListener("click", () => {
  overlay.classList.add("show");
  drawer.classList.add("show");
  renderDrawer();
});

function closeDrawer() {
  overlay.classList.remove("show");
  drawer.classList.remove("show");
}

document.getElementById("drawerClose").addEventListener("click", closeDrawer);
overlay.addEventListener("click", closeDrawer);

function renderDrawer() {
  const body = document.getElementById("drawerBody");
  const added = scholarships.filter((s) => s.added_to_checklist);
  if (added.length === 0) {
    body.innerHTML = `<div class="drawer-empty">Nothing here yet. Add a scholarship from its card or details view to start tracking documents.</div>`;
    return;
  }
  body.innerHTML = "";
  added.forEach((s) => {
    const checked = new Set(s.checked_documents);
    const item = document.createElement("div");
    item.className = "checklist-item";
    item.innerHTML = `
      <h4>${s.name}</h4>
      <div class="inst">${s.institution}</div>
      ${(s.required_documents || [])
        .map(
          (r) => `
        <label class="doc-row ${checked.has(r) ? "done" : ""}">
          <input type="checkbox" data-sid="${s.id}" data-doc="${r}" ${checked.has(r) ? "checked" : ""}>
          ${r}
        </label>`
        )
        .join("")}
    `;
    body.appendChild(item);
  });
}

document.getElementById("drawerBody").addEventListener("change", async (e) => {
  if (e.target.type !== "checkbox") return;
  const sid = Number(e.target.dataset.sid);
  const doc = e.target.dataset.doc;
  const checked = e.target.checked;
  await fetch(`/api/checklist/${sid}/document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document: doc, checked }),
  });
  await loadScholarships();
  renderDrawer();
});

/* ------------------------------------------------------------
   STUDENT DROPDOWN
   ------------------------------------------------------------ */
const studentMenuButton = document.getElementById("student-menu-button");
const studentDropdown = document.getElementById("student-dropdown");

function closeStudentDropdown() {
  studentDropdown.hidden = true;
  studentMenuButton.setAttribute("aria-expanded", "false");
}

studentMenuButton.addEventListener("click", (e) => {
  e.stopPropagation();
  const willOpen = studentDropdown.hidden;
  studentDropdown.hidden = !willOpen;
  studentMenuButton.setAttribute("aria-expanded", String(willOpen));
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".admin-menu")) closeStudentDropdown();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeStudentDropdown();
});

document.getElementById("student-signout").addEventListener("click", async () => {
  await fetch("/api/student/logout", { method: "POST" });
  window.location.href = "student-login.html";
});

init();
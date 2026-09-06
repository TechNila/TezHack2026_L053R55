/* ------------------------------------------------------------
   FIXED RULE FIELDS — mirrors the backend's FIELD_DEFS exactly.
   Weight is fixed per field; admins cannot set it, and each field
   can only be used once per scholarship.
   ------------------------------------------------------------ */
const FIELD_DEFS = {
  gpa: { label: "Minimum GPA", weight: 3, inputType: "number", step: "0.01", min: "0", max: "10", placeholder: "e.g. 7.5" },
  income: { label: "Maximum annual income (\u20B9)", weight: 3, inputType: "number", min: "0", placeholder: "e.g. 300000" },
  course: {
    label: "Course level", weight: 2, inputType: "select",
    options: [["school", "School"], ["ug", "Undergraduate (UG)"], ["pg", "Postgraduate (PG)"], ["diploma", "Diploma / vocational"], ["phd", "Doctoral (PhD)"]],
  },
  category: {
    label: "Max reservation tier", weight: 2, inputType: "select",
    options: [["gen", "General (Gen)"], ["gen-ews", "General \u2013 EWS"], ["obc", "OBC"], ["sc", "SC"], ["st", "ST"]],
    hint: "Students at or below this tier qualify",
  },
  state: { label: "Eligible state", weight: 1, inputType: "text", placeholder: "e.g. Assam, or All for national" },
  age: { label: "Maximum age", weight: 1, inputType: "number", min: "0", placeholder: "e.g. 25" },
};

const rulesList = document.getElementById("rules-list");
const rulesError = document.getElementById("rulesError");
const fieldPicker = document.getElementById("ruleFieldPicker");
const documentsList = document.getElementById("documents-list");

function usedFields() {
  return Array.from(rulesList.querySelectorAll(".rule-row")).map((r) => r.dataset.field);
}

function refreshFieldPicker() {
  const used = usedFields();
  fieldPicker.innerHTML = '<option value="">Add a rule&hellip;</option>';
  Object.entries(FIELD_DEFS).forEach(([key, def]) => {
    if (used.includes(key)) return;
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${def.label} (weight ${def.weight})`;
    fieldPicker.appendChild(opt);
  });
}

function ruleInputHtml(field, value) {
  const def = FIELD_DEFS[field];
  if (def.inputType === "select") {
    const opts = def.options
      .map(([v, label]) => `<option value="${v}" ${v === value ? "selected" : ""}>${label}</option>`)
      .join("");
    return `<select class="rule-value">${opts}</select>`;
  }
  const attrs = [
    def.min !== undefined ? `min="${def.min}"` : "",
    def.max !== undefined ? `max="${def.max}"` : "",
    def.step !== undefined ? `step="${def.step}"` : "",
  ].join(" ");
  return `<input type="number" class="rule-value" ${attrs} placeholder="${def.placeholder || ""}" value="${value !== undefined ? value : ""}" />`;
}

function addRuleRow(field, value) {
  const def = FIELD_DEFS[field];
  if (!def) return;

  const row = document.createElement("div");
  row.className = "rule-row";
  row.dataset.field = field;
  row.innerHTML = `
    <div class="rule-row-label">
      <span class="field-name">${def.label}</span>
      <span class="weight-badge">Weight ${def.weight}</span>
    </div>
    ${ruleInputHtml(field, value)}
    <button type="button" class="remove-row-btn" aria-label="Remove rule">&times;</button>
  `;
  row.querySelector(".remove-row-btn").addEventListener("click", () => {
    row.remove();
    refreshFieldPicker();
  });
  rulesList.appendChild(row);
  refreshFieldPicker();
}

document.getElementById("addRuleBtn").addEventListener("click", () => {
  const field = fieldPicker.value;
  if (!field) return;
  addRuleRow(field, undefined);
});

function addDocumentRow(value) {
  const row = document.createElement("div");
  row.className = "document-row";
  row.innerHTML = `
    <input type="text" class="document-name" placeholder="e.g. Income certificate" value="${value || ""}" />
    <button type="button" class="remove-row-btn" aria-label="Remove document">&times;</button>
  `;
  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  documentsList.appendChild(row);
}

document.getElementById("add-document-btn").addEventListener("click", () => addDocumentRow());

refreshFieldPicker();
addRuleRow("state", undefined);
addDocumentRow();

/* ------------------------------------------------------------
   ADMIN DROPDOWN
   ------------------------------------------------------------ */
const adminMenuButton = document.getElementById("admin-menu-button");
const adminDropdown = document.getElementById("admin-dropdown");

document.getElementById("admin-name").textContent =
  sessionStorage.getItem("scholarsetu_admin_username") || "Admin";

function closeAdminDropdown() {
  adminDropdown.hidden = true;
  adminMenuButton.setAttribute("aria-expanded", "false");
}

adminMenuButton.addEventListener("click", function (event) {
  event.stopPropagation();
  const willOpen = adminDropdown.hidden;
  adminDropdown.hidden = !willOpen;
  adminMenuButton.setAttribute("aria-expanded", String(willOpen));
});

document.addEventListener("click", function (event) {
  if (!event.target.closest(".admin-menu")) closeAdminDropdown();
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeAdminDropdown();
});

document.getElementById("admin-signout").addEventListener("click", async function () {
  await fetch("/api/admin/logout", { method: "POST" });
  sessionStorage.removeItem("scholarsetu_admin_username");
  window.location.href = "admin-login.html";
});

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
   ADD / EDIT SCHOLARSHIP FORM
   ------------------------------------------------------------ */
const form = document.getElementById("scholarshipForm");
const formHeading = document.getElementById("formHeading");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formError = document.getElementById("formError");
const formSuccess = document.getElementById("formSuccess");

let editingId = null;

function resetToAddMode() {
  editingId = null;
  form.reset();
  rulesList.innerHTML = "";
  documentsList.innerHTML = "";
  addRuleRow("state", undefined);
  addDocumentRow();
  refreshFieldPicker();
  formHeading.textContent = "Add a new scholarship";
  submitBtn.textContent = "Add scholarship";
  cancelEditBtn.classList.add("hidden");
  formError.classList.remove("show");
  formSuccess.classList.remove("show");
}

cancelEditBtn.addEventListener("click", resetToAddMode);

function enterEditMode(sch) {
  editingId = sch.id;
  document.getElementById("name").value = sch.name;
  document.getElementById("institution").value = sch.institution;
  document.getElementById("deadline").value = sch.deadline;
  document.getElementById("notice_link").value = sch.notice_link;
  document.getElementById("description").value = sch.description;

  rulesList.innerHTML = "";
  (sch.rules || []).forEach((r) => addRuleRow(r.field, r.value));

  documentsList.innerHTML = "";
  (sch.required_documents || []).forEach((d) => addDocumentRow(d));
  if ((sch.required_documents || []).length === 0) addDocumentRow();

  formHeading.textContent = `Editing "${sch.name}"`;
  submitBtn.textContent = "Save changes";
  cancelEditBtn.classList.remove("hidden");
  formError.classList.remove("show");
  formSuccess.classList.remove("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function collectRules() {
  const rows = Array.from(rulesList.querySelectorAll(".rule-row"));
  const rules = [];
  for (const row of rows) {
    const field = row.dataset.field;
    const valueEl = row.querySelector(".rule-value");
    const value = valueEl.value;
    if (value === "" || value === null) {
      rulesError.textContent = `Fill in a value for "${FIELD_DEFS[field].label}", or remove that rule.`;
      rulesError.classList.add("show");
      return null;
    }
    rules.push({ field, value });
  }
  rulesError.classList.remove("show");
  return rules;
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  formError.classList.remove("show");
  formSuccess.classList.remove("show");

  const rules = collectRules();
  if (rules === null) return;

  if (rules.length === 0) {
    formError.textContent = "Add at least one eligibility rule.";
    formError.classList.add("show");
    return;
  }

  const required_documents = Array.from(documentsList.querySelectorAll(".document-name"))
    .map((el) => el.value.trim())
    .filter(Boolean);

  if (required_documents.length === 0) {
    formError.textContent = "Add at least one required document.";
    formError.classList.add("show");
    return;
  }

  const payload = {
    name: document.getElementById("name").value.trim(),
    institution: document.getElementById("institution").value.trim(),
    deadline: document.getElementById("deadline").value,
    notice_link: document.getElementById("notice_link").value.trim(),
    description: document.getElementById("description").value.trim(),
    rules,
    required_documents,
  };

  const url = editingId ? `/api/admin/scholarships/${editingId}` : "/api/admin/scholarships";
  const method = editingId ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.status === 401) {
      window.location.href = "admin-login.html";
      return;
    }
    if (!res.ok) {
      formError.textContent = data.error || "Something went wrong.";
      formError.classList.add("show");
      return;
    }

    formSuccess.textContent = editingId ? "Scholarship updated." : "Scholarship added.";
    formSuccess.classList.add("show");
    resetToAddMode();
    loadScholarships();
  } catch (err) {
    formError.textContent = "Could not reach the server. Please try again.";
    formError.classList.add("show");
  }
});

/* ------------------------------------------------------------
   EXISTING SCHOLARSHIPS LIST
   ------------------------------------------------------------ */
const listEl = document.getElementById("scholarshipList");

async function loadScholarships() {
  const res = await fetch("/api/admin/scholarships");
  if (res.status === 401) {
    window.location.href = "admin-login.html";
    return;
  }
  const data = await res.json();
  renderList(data);
}

function renderList(items) {
  if (items.length === 0) {
    listEl.innerHTML = `<p class="list-empty">No scholarships added yet. Use the form to add your first one.</p>`;
    return;
  }
  listEl.innerHTML = "";
  items.forEach((s) => {
    const card = document.createElement("div");
    card.className = "sch-card";
    const chips = (s.rules || [])
      .map((r) => `<span class="rule-chip">${FIELD_DEFS[r.field] ? FIELD_DEFS[r.field].label : r.field}: ${r.value}</span>`)
      .join("");
    card.innerHTML = `
      <h3>${s.name}</h3>
      <div class="inst">${s.institution}</div>
      <div class="sch-meta">
        <span>Deadline: ${s.deadline}</span>
        <span>${(s.required_documents || []).length} document(s)</span>
        <span>${(s.rules || []).length} rule(s)</span>
      </div>
      <div class="rule-chips">${chips}</div>
      <button type="button" class="sch-edit-btn">Edit</button>
      <button type="button" class="sch-delete-btn">Delete</button>
    `;
    card.querySelector(".sch-edit-btn").addEventListener("click", () => enterEditMode(s));
    card.querySelector(".sch-delete-btn").addEventListener("click", () => deleteScholarship(s.id, s.name));
    listEl.appendChild(card);
  });
}

async function deleteScholarship(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  const res = await fetch(`/api/admin/scholarships/${id}`, { method: "DELETE" });
  if (res.status === 401) {
    window.location.href = "admin-login.html";
    return;
  }
  if (res.ok) loadScholarships();
}

loadScholarships();
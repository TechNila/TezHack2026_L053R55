/* ==============================================================
   ADD SCHOLARSHIP PAGE — add-scholarship.js
   ============================================================== */

const RULE_FIELDS = [
  { value: "gpa", label: "GPA" },
  { value: "income", label: "Annual income" },
  { value: "state", label: "State" },
  { value: "category", label: "Category" },
  { value: "course", label: "Course" },
  { value: "age", label: "Age" },
];

const RULE_OPERATORS = [
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "==", label: "=" },
  { value: "!=", label: "!=" },
  { value: "in", label: "is one of" },
];

const ADMIN_SESSION_KEY = "scholarsetu_current_admin";

const rulesList = document.getElementById("rules-list");
const documentsList = document.getElementById("documents-list");

function optionsHtml(options) {
  return options.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
}

function addRuleRow() {
  const row = document.createElement("div");
  row.className = "rule-row";
  row.innerHTML = `
    <select class="rule-field">${optionsHtml(RULE_FIELDS)}</select>
    <select class="rule-operator">${optionsHtml(RULE_OPERATORS)}</select>
    <input type="text" class="rule-value" placeholder="Value" />
    <button type="button" class="remove-row-btn" aria-label="Remove rule">&times;</button>
  `;
  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  rulesList.appendChild(row);
}

function addDocumentRow() {
  const row = document.createElement("div");
  row.className = "document-row";
  row.innerHTML = `
    <input type="text" class="document-name" placeholder="e.g. Income certificate" />
    <button type="button" class="remove-row-btn" aria-label="Remove document">&times;</button>
  `;
  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  documentsList.appendChild(row);
}

document.getElementById("add-rule-btn").addEventListener("click", addRuleRow);
document.getElementById("add-document-btn").addEventListener("click", addDocumentRow);

addRuleRow();
addDocumentRow();

/* ------------------------------------------------------------
   ADMIN DROPDOWN
   ------------------------------------------------------------ */
const adminMenuButton = document.getElementById("admin-menu-button");
const adminDropdown = document.getElementById("admin-dropdown");

function getSignedInAdmin() {
  const raw =
    sessionStorage.getItem(ADMIN_SESSION_KEY) ||
    localStorage.getItem(ADMIN_SESSION_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function populateAdminDetails() {
  const admin = getSignedInAdmin();

  const name = admin?.fullName || "Admin";
  const email = admin?.email || "No email available";
  const adminId = admin?.adminId || "No Admin ID available";

  document.getElementById("admin-badge-label").textContent = name;
  document.getElementById("admin-name").textContent = name;
  document.getElementById("admin-email").textContent = email;
  document.getElementById("admin-id").textContent = `Admin ID: ${adminId}`;
}

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
  if (!event.target.closest(".admin-menu")) {
    closeAdminDropdown();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeAdminDropdown();
  }
});

document.getElementById("admin-signout").addEventListener("click", function () {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
  window.location.href = "admin-login.html";
});

populateAdminDetails();

/* ------------------------------------------------------------
   FORM SUBMIT — still a UI/data-schema stub
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   STICKY HEADER BACKDROP
   ------------------------------------------------------------ */
const topBar = document.querySelector(".top-bar");

function updateTopBarBackdrop() {
  if (!topBar) return;

  const isScrolled = window.scrollY > 0;
  topBar.classList.toggle("is-scrolled", isScrolled);

  // Keep the opaque section exactly as tall as the real header.
  topBar.style.setProperty("--top-bar-height", `${topBar.getBoundingClientRect().height}px`);
}

if (topBar) {
  updateTopBarBackdrop();
  window.addEventListener("scroll", updateTopBarBackdrop, { passive: true });
  window.addEventListener("resize", updateTopBarBackdrop);
}

const form = document.getElementById("add-scholarship-form");

form.addEventListener("submit", function (event) {
  event.preventDefault();

  console.log("Save clicked — scholarship isn't actually saved yet.");
});

/* ==============================================================
   TODO — MASTER TODO LIST IS MAINTAINED IN scholarSetu-TODO.txt
   ============================================================== */

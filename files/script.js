/* ==============================================================
   ADMIN LOGIN PAGE — script.js
   ============================================================== */

const ADD_SCHOLARSHIP_PAGE_URL = "add-scholarship.html";
const ADMIN_SESSION_KEY = "scholarsetu_current_admin";

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

const form = document.getElementById("admin-login-form");

if (form) {
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const fullName = document.getElementById("full-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const adminId = document.getElementById("admin-id").value.trim();
    const password = document.getElementById("password").value;
    const keepSignedIn = document.getElementById("keep-signed-in").checked;

    if (!fullName || !email || !adminId || !password) {
      form.reportValidity();
      return;
    }

    /*
     * This is still demo/local authentication. Replace the credential
     * check with the real backend when the Flask/API layer is ready.
     * The session object is stored so the scholarship page can display
     * the currently signed-in admin in its dropdown.
     */
    const adminData = {
      fullName,
      email,
      adminId
    };

    const storage = keepSignedIn ? localStorage : sessionStorage;
    storage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminData));

    window.location.href = ADD_SCHOLARSHIP_PAGE_URL;
  });
}

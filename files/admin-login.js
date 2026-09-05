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
   LOGIN
   ------------------------------------------------------------ */
const form = document.getElementById("adminLoginForm");
const errorEl = document.getElementById("adminLoginError");

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  errorEl.classList.remove("show");

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    errorEl.textContent = "Enter your username and password.";
    errorEl.classList.add("show");
    return;
  }

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    // if (!res.ok) {
    //   errorEl.textContent = data.error || "Login failed.";
    //   errorEl.classList.add("show");
    //   return;
    // }

    sessionStorage.setItem("scholarsetu_admin_username", username);
    window.location.href = "add-scholarship.html";
  } catch (err) {
    errorEl.textContent = "Could not reach the server. Please try again.";
    errorEl.classList.add("show");
  }
});
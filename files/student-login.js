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
   TABS
   ------------------------------------------------------------ */
const tabs = document.querySelectorAll(".tab");
const loginForm = document.getElementById("studentLoginForm");
const signupForm = document.getElementById("studentSignupForm");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isLogin = tab.dataset.tab === "login";
    loginForm.classList.toggle("hidden", !isLogin);
    signupForm.classList.toggle("hidden", isLogin);
  });
});

/* ------------------------------------------------------------
   LOGIN
   ------------------------------------------------------------ */
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  loginError.classList.remove("show");

  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || "Login failed.";
      loginError.classList.add("show");
      return;
    }

    window.location.href = "student-dash.html";
  } catch (err) {
    loginError.textContent = "Could not reach the server. Please try again.";
    loginError.classList.add("show");
  }
});

/* ------------------------------------------------------------
   SIGN UP
   ------------------------------------------------------------ */
const signupError = document.getElementById("signupError");
const signupSuccess = document.getElementById("signupSuccess");

signupForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  signupError.classList.remove("show");
  signupSuccess.classList.remove("show");

  const formData = new FormData(signupForm);
  const payload = Object.fromEntries(formData.entries());
  payload.annual_income = Number(payload.annual_income);
  payload.gpa = Number(payload.gpa);
  payload.age = Number(payload.age);

  if (payload.gpa < 0 || payload.gpa > 10) {
    signupError.textContent = "GPA must be between 0 and 10.";
    signupError.classList.add("show");
    return;
  }

  if (payload.age < 2 || payload.age > 100) {
    signupError.textContent = "Age must be between 2 and 100.";
    signupError.classList.add("show");
    return;
  }

  try {
    const res = await fetch("/api/student/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      signupError.textContent = data.error || "Something went wrong.";
      signupError.classList.add("show");
      return;
    }

    signupSuccess.textContent = "Account created. Switch to Log in to continue.";
    signupSuccess.classList.add("show");
    signupForm.reset();
  } catch (err) {
    signupError.textContent = "Could not reach the server. Please try again.";
    signupError.classList.add("show");
  }
});

/* ------------------------------------------------------------
   FORGOT PASSWORD MODAL
   ------------------------------------------------------------ */
const forgotBtn = document.getElementById("forgotPasswordBtn");
const forgotOverlay = document.getElementById("forgotModalOverlay");
const forgotClose = document.getElementById("forgotModalClose");

forgotBtn.addEventListener("click", () => forgotOverlay.classList.add("show"));
forgotClose.addEventListener("click", () => forgotOverlay.classList.remove("show"));
forgotOverlay.addEventListener("click", (e) => {
  if (e.target === forgotOverlay) forgotOverlay.classList.remove("show");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") forgotOverlay.classList.remove("show");
});
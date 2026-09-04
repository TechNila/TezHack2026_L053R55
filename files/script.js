/* ==============================================================
   ADMIN LOGIN PAGE — script.js
   ==============================================================
   Nothing here is wired to real logic yet. See the TODO list at
   the bottom of this file for everything left to build.
   ============================================================== */

/* ------------------------------------------------------------
   2. STORAGE LAYER
   ------------------------------------------------------------
   Everything is stored under a few fixed localStorage keys.
   These are the ONLY functions that ever touch localStorage
   directly — every other function in this file calls these.
   Keep it this way; it makes swapping to a real backend later
   (Flask etc.) a one-file change instead of a rewrite.
   ------------------------------------------------------------ */

// TODO: implement once the storage schema is locked as a team.
// function saveAdmin(adminData) { }
// function getAdmin(adminId) { }


/* ------------------------------------------------------------
   NEXT PAGE (after successful login)
   Leave blank until the "add scholarship" page exists.
   ------------------------------------------------------------ */
const ADD_SCHOLARSHIP_PAGE_URL = "";

/* ------------------------------------------------------------
   FORM SUBMIT
   Intentionally does almost nothing yet — just stops the page
   from reloading. Validation + auth + redirect all TODO.
   ------------------------------------------------------------ */
const form = document.getElementById("admin-login-form");

form.addEventListener("submit", function (event) {
  event.preventDefault();

  // const fullName = document.getElementById("full-name").value;
  // const email     = document.getElementById("email").value;
  // const adminId   = document.getElementById("admin-id").value;
  // const password  = document.getElementById("password").value;
  // const keepSignedIn = document.getElementById("keep-signed-in").checked;

  // TODO: validate fields
  // TODO: check credentials against storage layer (or later, Flask API)
  // TODO: on success -> window.location.href = ADD_SCHOLARSHIP_PAGE_URL;
  // TODO: on failure -> show an inline error, don't just fail silently

  console.log("Submit clicked — auth logic not implemented yet.");
});


/* ==============================================================
   TODO — THINGS LEFT TO IMPLEMENT
   ==============================================================
   1. Background artwork: set the real image URL in styles.css
      (.bg-layer { background-image: url("...") })
   2. Admin/teacher vector illustration: set src on .illustration
      in admin-login.html
   3. "Back to home" link: currently href="#"
   4. Redirect target after login: ADD_SCHOLARSHIP_PAGE_URL above,
      point it at the "add scholarship" page once it exists
   5. Storage layer functions (saveAdmin/getAdmin/etc.) — stubbed,
      not implemented
   6. Actual authentication logic in the submit handler
   7. "Forgot password?" flow — link currently goes nowhere
   8. "Keep me signed in" — checkbox exists, no persistence logic
   9. Inline form validation / error messages (beyond native
      HTML5 "required" validation)
   ============================================================== */

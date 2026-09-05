// ScholarSetu — interaction layer
// Kept intentionally small: header scroll state, mobile nav toggle,
// footer year, and a graceful fallback if no hero video is supplied yet.

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('siteHeader');
  const navToggle = document.getElementById('navToggle');
  const heroVideo = document.getElementById('heroVideo');
  const yearEl = document.getElementById('year');

  // --- Header background toggles once the hero has scrolled past ---
  const onScroll = () => {
    const scrolled = window.scrollY > 40;
    header.classList.toggle('is-scrolled', scrolled);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // --- Mobile nav toggle ---
  navToggle.addEventListener('click', () => {
    const isOpen = header.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close mobile nav when a link is tapped
  document.querySelectorAll('.main-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // --- Hero video: if no real src has been added yet, hide the <video>
  // element so the CSS gradient background (in .hero-media) shows cleanly
  // instead of a broken player. Once you add a real src in index.html,
  // this will just work. ---
  const hasSource = heroVideo.querySelector('source')?.getAttribute('src');
  if (!hasSource) {
    heroVideo.style.display = 'none';
  } else {
    heroVideo.addEventListener('error', () => {
      heroVideo.style.display = 'none';
    });
  }

  // --- Footer year ---
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});

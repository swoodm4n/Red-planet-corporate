// app.js — sidebar navigation + page router for the mockup
(function () {
  const main = document.getElementById('main');
  const sidebar = document.getElementById('sidebar');
  const sidebarBrand = document.getElementById('sidebarBrand');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const navItems = document.querySelectorAll('.navitem');

  function renderPage(pageKey) {
    main.innerHTML = `<div class="page active">${PAGES[pageKey] || '<p>Page not found.</p>'}</div>`;
  }

  function setActiveNav(pageKey) {
    navItems.forEach(n => n.classList.toggle('active', n.dataset.page === pageKey));
  }

  function toggleSidebar() {
    sidebar.classList.toggle('expanded');
    sidebarBackdrop.classList.toggle('visible', sidebar.classList.contains('expanded'));
  }

  function collapseSidebar() {
    sidebar.classList.remove('expanded');
    sidebarBackdrop.classList.remove('visible');
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageKey = item.dataset.page;
      setActiveNav(pageKey);
      renderPage(pageKey);
      window.scrollTo({ top: 0, behavior: 'instant' });
      // On mobile, selecting a page also collapses the overlay sidebar
      if (window.innerWidth <= 640) collapseSidebar();
    });
  });

  sidebarToggle.addEventListener('click', toggleSidebar);
  sidebarBrand.addEventListener('click', toggleSidebar);
  sidebarBackdrop.addEventListener('click', collapseSidebar);

  // Selecting building cards on the colony page (delegated, since content is re-rendered)
  main.addEventListener('click', (e) => {
    const card = e.target.closest('.bldg-card');
    if (card && card.parentElement.classList.contains('bldg-list')) {
      card.parentElement.querySelectorAll('.bldg-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    }
  });

  // Initial render
  renderPage('dashboard');
})();

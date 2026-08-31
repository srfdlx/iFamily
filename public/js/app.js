(function () {
  'use strict';

  // ---------- Zustand ----------
  const state = {
    sessionToken: localStorage.getItem('ifamily_session'),
    user: null,
    family: null,
    tasks: [],
    lists: [],
    view: 'tasks', // 'tasks' | 'lists'
    filters: { status: 'aktiv', assignee: 'alle', priority: 'alle', category: 'alle' },
    sort: 'due',
    search: '',
    showDone: false,
    drawerOpen: false,
    dialog: null, // { type, task? }
    login: { step: 'form', email: '', error: null, busy: false }
  };

  const STATUS = [
    { key: 'offen', label: 'Offen' },
    { key: 'in_arbeit', label: 'In Bearbeitung' },
    { key: 'erledigt', label: 'Abgeschlossen' }
  ];
  const PRIORITIES = [
    { key: 'hoch', label: 'Hoch' },
    { key: 'mittel', label: 'Mittel' },
    { key: 'niedrig', label: 'Niedrig' }
  ];
  const CATEGORIES = [
    { key: 'allgemein', label: 'Allgemein' },
    { key: 'einkauf', label: 'Einkauf' },
    { key: 'haushalt', label: 'Haushalt' },
    { key: 'persoenlich', label: 'Persönlich' }
  ];
  const RECURRENCES = [
    { key: '', label: 'Keine Wiederholung' },
    { key: 'taeglich', label: 'Täglich' },
    { key: 'woechentlich', label: 'Wöchentlich' },
    { key: 'monatlich', label: 'Monatlich' }
  ];

  const labelOf = (list, key) => (list.find((e) => e.key === key) || {}).label || key;

  const app = document.getElementById('app');

  // ---------- Hilfsfunktionen ----------
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function icon(name, size = 18) {
    const paths = {
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
      close: '<path d="M6 6l12 12M18 6L6 18"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
      moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
      check: '<path d="m4 12 5 5L20 6"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      bell: '<path d="M6 9a6 6 0 1 1 12 0c0 4 2 5 2 5H4s2-1 2-5z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      repeat: '<path d="M4 10a6 6 0 0 1 6-6h9m0 0-3-3m3 3-3 3"/><path d="M20 14a6 6 0 0 1-6 6H5m0 0 3 3m-3-3 3-3"/>',
      cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
      list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
      trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
      inbox: '<path d="M4 13h4l2 3h4l2-3h4"/><path d="M4 13 6 5h12l2 8v6H4z"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  // Farbe stabil aus dem Namen ableiten, damit jede Person immer gleich aussieht
  function avatarColor(name) {
    let hash = 0;
    for (const ch of String(name || '')) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    return `hsl(${hash}, 58%, 42%)`;
  }

  function avatarHtml(name, cls = '') {
    return `<span class="avatar ${cls}" style="background:${avatarColor(name)}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
  }

  function member(id) {
    return (state.family?.members || []).find((m) => m.id === Number(id)) || null;
  }
  function memberName(id) {
    const m = member(id);
    return m ? m.display_name : null;
  }

  function fmtDate(value) {
    if (!value) return '';
    const d = new Date(value.replace(' ', 'T'));
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay
      ? d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function toInputValue(value) {
    return value ? value.replace(' ', 'T').slice(0, 16) : '';
  }

  function isOverdue(task) {
    return task.status !== 'erledigt' && task.due_at && new Date(task.due_at.replace(' ', 'T')) < new Date();
  }

  // ---------- API ----------
  async function api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (state.sessionToken) headers.Authorization = 'Bearer ' + state.sessionToken;
    const res = await fetch('/api' + path, Object.assign({}, options, { headers }));
    let data = null;
    try { data = await res.json(); } catch (err) { /* leerer Body */ }
    if (res.status === 401) {
      logout();
      throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
    }
    if (!res.ok) throw new Error((data && data.error) || 'Fehler bei der Anfrage.');
    return data;
  }

  // Kurze Kennung des Datenstands; null, wenn sie gerade nicht zu holen ist.
  let syncVersion = null;
  let syncTimer = null;

  async function currentVersion() {
    try {
      return (await api('/sync/version')).version;
    } catch (err) {
      return null;
    }
  }

  function logout() {
    localStorage.removeItem('ifamily_session');
    localStorage.removeItem('ifamily_user');
    state.sessionToken = null;
    state.user = null;
    render();
  }

  async function loadAll() {
    const version = await currentVersion();
    const [me, family, taskRes, listRes] = await Promise.all([
      api('/auth/me'), api('/family'), api('/tasks'), api('/lists')
    ]);
    state.user = me.user;
    state.family = family;
    state.tasks = taskRes.tasks;
    state.lists = listRes.lists;
    syncVersion = version;
  }

  // Wichtig: die Kennung IMMER vor dem Laden der Daten holen. Andersherum
  // wuerde eine Aenderung, die genau dazwischen passiert, als bereits bekannt
  // gelten und nie mehr nachgeladen.
  const refreshTasks = async () => {
    const version = await currentVersion();
    state.tasks = (await api('/tasks')).tasks;
    syncVersion = version;
  };
  const refreshLists = async () => {
    const version = await currentVersion();
    state.lists = (await api('/lists')).lists;
    syncVersion = version;
  };

  // ---------- Farbschema ----------
  function isDark() {
    return document.documentElement.dataset.theme === 'dark';
  }
  function toggleTheme() {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('ifamily_theme', next); } catch (err) { /* egal */ }
    const btn = document.getElementById('theme-btn');
    if (btn) {
      btn.innerHTML = icon(isDark() ? 'sun' : 'moon');
      btn.setAttribute('aria-label', isDark() ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln');
    }
  }

  // ---------- Wurzel ----------
  function render() {
    if (!state.sessionToken) return renderLogin();
    if (!state.user) {
      app.innerHTML = '<div class="auth-screen"><p class="subtitle">Lädt …</p></div>';
      loadAll().then(render).catch((err) => {
        app.innerHTML = `<div class="auth-screen"><p class="subtitle">${escapeHtml(err.message)}</p></div>`;
      });
      return;
    }
    renderShell();
  }

  // ---------- Anmeldung ----------
  function renderLogin() {
    const { step, email, error, busy } = state.login;

    if (step === 'code') {
      app.innerHTML = `
        <div class="auth-screen">
          <h1>iFamily</h1>
          <p class="subtitle">Code eingeben</p>
          <form class="auth-card" id="code-form">
            <p style="margin-top:0">Wir haben einen sechsstelligen Code an <strong>${escapeHtml(email)}</strong> geschickt.</p>
            <label for="code">Anmeldecode</label>
            <input type="text" id="code" class="code-input" inputmode="numeric" autocomplete="one-time-code"
                   pattern="[0-9]*" maxlength="6" placeholder="000000" required />
            ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ''}
            <button type="submit" class="btn btn-primary btn-block" ${busy ? 'disabled' : ''}>${busy ? 'Prüfe …' : 'Anmelden'}</button>
            <p class="hint-text" style="margin-top:12px">Der Link in der E-Mail funktioniert auch, öffnet aber den Browser statt dieser App.</p>
            <button type="button" class="btn btn-ghost btn-block" id="back-to-form">Andere E-Mail verwenden</button>
          </form>
        </div>`;

      document.getElementById('back-to-form').onclick = () => {
        state.login = { step: 'form', email: '', error: null, busy: false };
        render();
      };
      const codeInput = document.getElementById('code');
      codeInput.focus();
      document.getElementById('code-form').onsubmit = async (event) => {
        event.preventDefault();
        const code = codeInput.value.replace(/\D/g, '');
        state.login.busy = true;
        state.login.error = null;
        render();
        try {
          const data = await api('/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) });
          localStorage.setItem('ifamily_session', data.sessionToken);
          localStorage.setItem('ifamily_user', JSON.stringify(data.user));
          state.sessionToken = data.sessionToken;
          state.login = { step: 'form', email: '', error: null, busy: false };
        } catch (err) {
          state.login.error = err.message;
        } finally {
          state.login.busy = false;
          render();
        }
      };
      return;
    }

    app.innerHTML = `
      <div class="auth-screen">
        <h1>iFamily</h1>
        <p class="subtitle">Aufgaben &amp; Listen für die ganze Familie</p>
        <form class="auth-card" id="login-form">
          <label for="email">E-Mail-Adresse</label>
          <input type="email" id="email" required placeholder="du@beispiel.ch" autocomplete="email" />
          ${error ? `<p class="error-text">${escapeHtml(error)}</p>` : ''}
          <button type="submit" class="btn btn-primary btn-block" ${busy ? 'disabled' : ''}>${busy ? 'Sende Code …' : 'Anmeldecode senden'}</button>
        </form>
      </div>`;

    document.getElementById('login-form').onsubmit = async (event) => {
      event.preventDefault();
      const payload = { email: document.getElementById('email').value };
      state.login.busy = true;
      state.login.error = null;
      render();
      try {
        await api('/auth/request-link', { method: 'POST', body: JSON.stringify(payload) });
        state.login = { step: 'code', email: payload.email.trim().toLowerCase(), error: null, busy: false };
      } catch (err) {
        state.login.error = err.message;
        state.login.busy = false;
      }
      render();
    };
  }

  // ---------- Grundgerüst ----------
  function renderShell() {
    app.innerHTML = `
      <header class="appbar">
        <button class="icon-btn" id="menu-btn" aria-label="Navigation öffnen" aria-expanded="false">${icon('menu', 20)}</button>
        <div class="brand"><span class="brand-mark">${icon('list', 18)}</span>iFamily</div>
        <button class="icon-btn" id="theme-btn" aria-label="${isDark() ? 'Zu hellem Design wechseln' : 'Zu dunklem Design wechseln'}">${icon(isDark() ? 'sun' : 'moon')}</button>
        <button class="avatar" id="account-btn" style="background:${avatarColor(state.user.displayName)}"
                aria-label="Konto und Familie">${escapeHtml(initials(state.user.displayName))}</button>
      </header>
      <div class="layout">
        <nav class="sidebar" id="sidebar" aria-label="Filter"></nav>
        <main>
          <div class="toolbar">
            <div class="search-wrap">
              <span class="search-icon">${icon('search', 17)}</span>
              <label for="search" class="visually-hidden">Aufgaben durchsuchen</label>
              <input type="search" id="search" placeholder="Aufgaben durchsuchen …" value="${escapeHtml(state.search)}" />
            </div>
            <button class="btn btn-primary" id="new-task-btn">${icon('plus', 17)}<span class="new-label">Neue Aufgabe</span></button>
          </div>
          <div id="content"></div>
        </main>
      </div>
      <button class="fab" id="fab" aria-label="Neue Aufgabe">${icon('plus', 24)}</button>
      <div id="overlays"></div>`;

    // Auf Mobile ist die Seitenleiste eine Schublade
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menu-btn');
    const applyDrawer = () => {
      const mobile = window.matchMedia('(max-width: 820px)').matches;
      sidebar.style.display = !mobile || state.drawerOpen ? '' : 'none';
      menuBtn.style.display = mobile ? '' : 'none';
      menuBtn.setAttribute('aria-expanded', String(state.drawerOpen));
    };
    menuBtn.onclick = () => { state.drawerOpen = !state.drawerOpen; applyDrawer(); renderOverlays(); };
    window.addEventListener('resize', applyDrawer);
    applyDrawer();

    document.getElementById('theme-btn').onclick = toggleTheme;
    document.getElementById('account-btn').onclick = () => openDialog({ type: 'account' });
    document.getElementById('new-task-btn').onclick = () => openDialog({ type: 'task' });
    document.getElementById('fab').onclick = () => openDialog({ type: 'task' });

    const search = document.getElementById('search');
    search.oninput = () => { state.search = search.value; renderContent(); renderSidebar(); };

    renderSidebar();
    renderContent();
    renderOverlays();
    startSync();
  }

  function closeDrawer() {
    state.drawerOpen = false;
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.matchMedia('(max-width: 820px)').matches) sidebar.style.display = 'none';
    document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
    renderOverlays();
  }

  // ---------- Seitenleiste ----------
  function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const all = state.tasks;
    const countBy = (fn) => all.filter(fn).length;

    const group = (title, buttons) => `
      <div class="filter-group">
        <h2>${title}</h2>
        ${buttons}
      </div>`;

    const btn = (key, group, label, iconName, count) => `
      <button class="filter-btn" data-filter="${group}" data-value="${key}"
              aria-pressed="${state.filters[group] === key}">
        ${iconName ? icon(iconName, 17) : ''}<span>${label}</span>
        ${count === undefined ? '' : `<span class="count">${count}</span>`}
      </button>`;

    sidebar.innerHTML = `
      <div class="drawer-head">
        <strong>Navigation</strong>
        <button class="icon-btn" id="drawer-close" aria-label="Navigation schliessen">${icon('close', 18)}</button>
      </div>
      ${group('Ansicht',
        `<button class="filter-btn" data-view="tasks" aria-pressed="${state.view === 'tasks'}">${icon('check', 17)}<span>Aufgaben</span></button>
         <button class="filter-btn" data-view="lists" aria-pressed="${state.view === 'lists'}">${icon('cart', 17)}<span>Sammellisten</span><span class="count">${state.lists.length}</span></button>`
      )}
      ${state.view !== 'tasks' ? '' : `
        ${group('Status',
          btn('aktiv', 'status', 'Alle offenen', 'inbox', countBy((t) => t.status !== 'erledigt')) +
          STATUS.map((s) => btn(s.key, 'status', s.label, s.key === 'erledigt' ? 'check' : s.key === 'in_arbeit' ? 'user' : 'inbox', countBy((t) => t.status === s.key))).join('')
        )}
        ${group('Zuweisung',
          btn('alle', 'assignee', 'Alle', 'user') +
          btn('mir', 'assignee', 'Mir zugewiesen', 'user', countBy((t) => Number(t.assigned_to) === state.user.id && t.status !== 'erledigt'))
        )}
        ${group('Priorität',
          btn('alle', 'priority', 'Alle Prioritäten') +
          PRIORITIES.map((p) => btn(p.key, 'priority', p.label, null, countBy((t) => t.priority === p.key && t.status !== 'erledigt'))).join('')
        )}
        ${group('Kategorie',
          btn('alle', 'category', 'Alle Kategorien') +
          CATEGORIES.map((c) => btn(c.key, 'category', c.label, null, countBy((t) => t.category === c.key && t.status !== 'erledigt'))).join('')
        )}
        <div class="filter-group">
          <h2>Sortierung</h2>
          <label for="sort" class="visually-hidden">Sortierung</label>
          <select id="sort">
            <option value="due" ${state.sort === 'due' ? 'selected' : ''}>Fälligkeitsdatum</option>
            <option value="priority" ${state.sort === 'priority' ? 'selected' : ''}>Priorität</option>
            <option value="created" ${state.sort === 'created' ? 'selected' : ''}>Erstellungsdatum</option>
            <option value="title" ${state.sort === 'title' ? 'selected' : ''}>Titel</option>
          </select>
        </div>`}
      <div class="sidebar-foot">
        <button class="filter-btn" id="ics-btn">${icon('clock', 17)}<span>Kalender exportieren (.ics)</span></button>
      </div>`;

    sidebar.querySelectorAll('[data-filter]').forEach((el) => {
      el.onclick = () => {
        state.filters[el.dataset.filter] = el.dataset.value;
        closeDrawer();
        renderSidebar();
        renderContent();
      };
    });
    sidebar.querySelectorAll('[data-view]').forEach((el) => {
      el.onclick = () => {
        state.view = el.dataset.view;
        closeDrawer();
        renderSidebar();
        renderContent();
      };
    });
    document.getElementById('drawer-close').onclick = closeDrawer;
    const sort = document.getElementById('sort');
    if (sort) sort.onchange = () => { state.sort = sort.value; renderContent(); };
    document.getElementById('ics-btn').onclick = () => { exportIcs(); closeDrawer(); };
  }

  // ---------- Inhalt ----------
  function visibleTasks() {
    const q = state.search.trim().toLowerCase();
    const f = state.filters;

    let list = state.tasks.filter((t) => {
      if (f.status === 'aktiv' ? t.status === 'erledigt' : f.status !== 'alle' && t.status !== f.status) return false;
      if (f.assignee === 'mir' && Number(t.assigned_to) !== state.user.id) return false;
      if (f.priority !== 'alle' && t.priority !== f.priority) return false;
      if (f.category !== 'alle' && t.category !== f.category) return false;
      if (q && !((t.title || '') + ' ' + (t.notes || '')).toLowerCase().includes(q)) return false;
      return true;
    });

    const rank = { hoch: 0, mittel: 1, niedrig: 2 };
    const byDue = (a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return a.due_at.localeCompare(b.due_at);
    };
    const sorters = {
      due: byDue,
      priority: (a, b) => (rank[a.priority] - rank[b.priority]) || byDue(a, b),
      created: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
      title: (a, b) => a.title.localeCompare(b.title, 'de')
    };
    return list.sort(sorters[state.sort] || byDue);
  }

  function renderContent() {
    const content = document.getElementById('content');
    if (!content) return;
    if (state.view === 'lists') return renderListsView(content);

    const tasks = visibleTasks();
    const active = tasks.filter((t) => t.status !== 'erledigt');
    const done = tasks.filter((t) => t.status === 'erledigt');
    const showDoneSection = state.filters.status === 'aktiv' || state.filters.status === 'alle';
    const doneAll = state.tasks.filter((t) => t.status === 'erledigt');

    content.innerHTML = `
      ${active.length
        ? `<div class="task-grid">${active.map(taskCard).join('')}</div>`
        : `<div class="empty-state">${state.search || state.filters.priority !== 'alle' || state.filters.category !== 'alle'
            ? 'Keine Aufgabe passt zu dieser Auswahl.'
            : 'Keine offenen Aufgaben. Tippe auf „Neue Aufgabe“, um eine anzulegen.'}</div>`}

      ${showDoneSection && doneAll.length ? `
        <button class="btn btn-ghost" id="toggle-done" style="margin-top:22px" aria-expanded="${state.showDone}">
          ${state.showDone ? 'Erledigte ausblenden' : `Erledigte Aufgaben anzeigen (${doneAll.length})`}
        </button>
        ${state.showDone ? `<div class="task-grid" style="margin-top:10px">${(done.length ? done : doneAll).map(taskCard).join('')}</div>` : ''}
      ` : ''}`;

    const toggle = document.getElementById('toggle-done');
    if (toggle) toggle.onclick = () => { state.showDone = !state.showDone; renderContent(); };

    content.querySelectorAll('[data-check]').forEach((el) => {
      el.onclick = async (event) => {
        event.stopPropagation();
        const task = state.tasks.find((t) => t.id === Number(el.dataset.check));
        await api(`/tasks/${task.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: task.status === 'erledigt' ? 'offen' : 'erledigt' })
        });
        await refreshTasks();
        renderContent();
        renderSidebar();
      };
    });

    content.querySelectorAll('[data-open]').forEach((el) => {
      el.onclick = () => openDialog({ type: 'task', task: state.tasks.find((t) => t.id === Number(el.dataset.open)) });
    });
  }

  function taskCard(task) {
    const assignee = memberName(task.assigned_to);
    const starter = memberName(task.started_by);
    const items = task.items || [];
    const doneItems = items.filter((i) => Number(i.checked) === 1).length;
    const isDone = task.status === 'erledigt';

    return `
      <article class="task-card ${isDone ? 'is-done' : ''}">
        <button class="check-btn ${isDone ? 'is-done' : ''}" data-check="${task.id}"
                aria-label="${isDone ? 'Als offen markieren' : 'Als erledigt markieren'}">${icon('check', 15)}</button>
        <div class="task-main" data-open="${task.id}" role="button" tabindex="0">
          <div class="badge-row">
            <span class="badge badge-${task.status}">${labelOf(STATUS, task.status)}</span>
            <span class="badge badge-${task.priority} plain">${labelOf(PRIORITIES, task.priority)}</span>
            ${task.category !== 'allgemein' ? `<span class="badge badge-cat plain">${labelOf(CATEGORIES, task.category)}</span>` : ''}
          </div>
          <div class="task-title">${escapeHtml(task.title)}</div>
          ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ''}
          <div class="task-foot">
            ${assignee ? `${avatarHtml(assignee, 'sm')}<span>${escapeHtml(assignee)}</span>` : `${icon('user', 14)}<span>Nicht zugewiesen</span>`}
            ${task.status === 'in_arbeit' && starter ? `<span>· ${escapeHtml(starter)} ist dran</span>` : ''}
            <span class="spacer"></span>
            ${items.length ? `<span class="progress-chip">${icon('cart', 13)}${doneItems}/${items.length}</span>` : ''}
            ${task.recurrence_rule ? `<span title="${labelOf(RECURRENCES, task.recurrence_rule)}">${icon('repeat', 13)}</span>` : ''}
            ${task.remind_at && !isDone ? `<span title="Erinnerung ${fmtDate(task.remind_at)}">${icon('bell', 13)}</span>` : ''}
            ${task.due_at ? `<span class="${isOverdue(task) ? 'overdue' : ''}">${icon('clock', 13)} ${fmtDate(task.due_at)}</span>` : ''}
          </div>
        </div>
      </article>`;
  }

  // ---------- Sammellisten ----------
  function renderListsView(content) {
    content.innerHTML = `
      <button class="btn btn-primary" id="new-list-btn" style="margin-bottom:14px">${icon('plus', 17)} Neue Liste</button>
      ${state.lists.length ? state.lists.map((list) => `
        <section class="panel">
          <h2>${escapeHtml(list.name)}</h2>
          ${list.items.map((item) => `
            <div class="shopping-row">
              <button class="tick ${Number(item.checked) ? 'checked' : ''}" data-toggle-item="${list.id}:${item.id}"
                      aria-label="${Number(item.checked) ? 'Nicht erledigt' : 'Erledigt'}">${icon('check', 12)}</button>
              <span class="text ${Number(item.checked) ? 'checked' : ''}">${escapeHtml(item.text)}</span>
              <button class="icon-btn" data-del-item="${list.id}:${item.id}" aria-label="Eintrag löschen">${icon('trash', 15)}</button>
            </div>`).join('') || '<p class="hint-text">Noch keine Einträge.</p>'}
          <form class="shopping-add" data-add-item="${list.id}">
            <label class="visually-hidden" for="add-${list.id}">Eintrag hinzufügen</label>
            <input id="add-${list.id}" type="text" placeholder="Hinzufügen …" required />
            <button type="submit" class="btn">${icon('plus', 16)}</button>
          </form>
        </section>`).join('')
        : '<div class="empty-state">Noch keine Sammelliste angelegt.</div>'}`;

    document.getElementById('new-list-btn').onclick = async () => {
      const name = prompt('Name der Liste:');
      if (!name || !name.trim()) return;
      await api('/lists', { method: 'POST', body: JSON.stringify({ name }) });
      await refreshLists();
      renderContent();
      renderSidebar();
    };

    content.querySelectorAll('[data-toggle-item]').forEach((el) => {
      el.onclick = async () => {
        const [listId, itemId] = el.dataset.toggleItem.split(':');
        const list = state.lists.find((l) => l.id === Number(listId));
        const item = list.items.find((i) => i.id === Number(itemId));
        await api(`/lists/${listId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ checked: !Number(item.checked) }) });
        await refreshLists();
        renderContent();
      };
    });

    content.querySelectorAll('[data-del-item]').forEach((el) => {
      el.onclick = async () => {
        const [listId, itemId] = el.dataset.delItem.split(':');
        await api(`/lists/${listId}/items/${itemId}`, { method: 'DELETE' });
        await refreshLists();
        renderContent();
      };
    });

    content.querySelectorAll('[data-add-item]').forEach((form) => {
      form.onsubmit = async (event) => {
        event.preventDefault();
        const input = form.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        await api(`/lists/${form.dataset.addItem}/items`, { method: 'POST', body: JSON.stringify({ text }) });
        await refreshLists();
        renderContent();
      };
    });
  }

  // ---------- Dialoge ----------
  function openDialog(dialog) {
    state.dialog = dialog;
    if (dialog.type === 'task') {
      state.draftItems = (dialog.task?.items || []).map((i) => ({ text: i.text, checked: Number(i.checked) === 1 }));
    }
    renderOverlays();
  }

  function closeDialog() {
    state.dialog = null;
    renderOverlays();
  }

  function renderOverlays() {
    const overlays = document.getElementById('overlays');
    if (!overlays) return;

    const drawerBackdrop = state.drawerOpen ? '<div class="drawer-backdrop" id="drawer-backdrop"></div>' : '';
    let dialogHtml = '';
    if (state.dialog?.type === 'task') dialogHtml = taskDialog();
    if (state.dialog?.type === 'account') dialogHtml = accountDialog();

    overlays.innerHTML = drawerBackdrop + dialogHtml;

    document.getElementById('drawer-backdrop')?.addEventListener('click', closeDrawer);
    const backdrop = document.getElementById('dialog-backdrop');
    if (backdrop) {
      backdrop.onclick = (event) => { if (event.target === backdrop) closeDialog(); };
      document.getElementById('dialog-close').onclick = closeDialog;
      if (state.dialog.type === 'task') attachTaskDialog();
      if (state.dialog.type === 'account') attachAccountDialog();
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (state.dialog) closeDialog();
    else if (state.drawerOpen) closeDrawer();
  });

  function taskDialog() {
    const task = state.dialog.task || null;
    const members = state.family.members;
    const remindMode = task ? (task.remind_mode || '') : '';
    const category = task ? task.category : 'allgemein';

    const options = (list, selected) => list
      .map((e) => `<option value="${e.key}" ${e.key === selected ? 'selected' : ''}>${escapeHtml(e.label)}</option>`).join('');

    return `
      <div class="backdrop" id="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div class="dialog">
          <div class="dialog-head">
            <h2 id="dialog-title">${task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h2>
            <button class="icon-btn" id="dialog-close" aria-label="Schliessen">${icon('close', 18)}</button>
          </div>
          <form id="task-form">
            <label for="t-title">Titel</label>
            <input type="text" id="t-title" required placeholder="z. B. Einkaufen gehen" value="${task ? escapeHtml(task.title) : ''}" />

            <label for="t-notes">Beschreibung</label>
            <textarea id="t-notes" rows="2" placeholder="Details …">${task && task.notes ? escapeHtml(task.notes) : ''}</textarea>

            <div class="field-row">
              <div>
                <label for="t-category">Kategorie</label>
                <select id="t-category">${options(CATEGORIES, category)}</select>
              </div>
              <div>
                <label for="t-priority">Priorität</label>
                <select id="t-priority">${options(PRIORITIES, task ? task.priority : 'mittel')}</select>
              </div>
            </div>

            <div id="shopping-wrap" style="display:${category === 'einkauf' ? 'block' : 'none'}">
              <label>Einkaufsliste</label>
              <div class="shopping-editor" id="shopping-editor"></div>
            </div>

            ${task ? `
              <label id="status-label">Status</label>
              <div class="pill-group" id="t-status" role="group" aria-labelledby="status-label">
                ${STATUS.map((s) => `<button type="button" data-status="${s.key}" aria-pressed="${task.status === s.key}">${s.label}</button>`).join('')}
              </div>` : ''}

            <label for="t-assignee">Zugewiesen an</label>
            <select id="t-assignee">
              <option value="">Niemand</option>
              ${members.map((m) => `<option value="${m.id}" ${task && Number(task.assigned_to) === m.id ? 'selected' : ''}>${escapeHtml(m.display_name)}</option>`).join('')}
            </select>

            <label for="t-due">Fälligkeitsdatum</label>
            <input type="datetime-local" id="t-due" value="${task ? toInputValue(task.due_at) : ''}" />

            <label id="remind-label">Erinnerung</label>
            <div class="pill-group" id="remind-mode" role="group" aria-labelledby="remind-label">
              <button type="button" data-mode="" aria-pressed="${remindMode === ''}">Keine</button>
              <button type="button" data-mode="fest" aria-pressed="${remindMode === 'fest'}">Feste Zeit</button>
              <button type="button" data-mode="vorlauf" aria-pressed="${remindMode === 'vorlauf'}">Vorlaufzeit</button>
            </div>
            <input type="datetime-local" id="t-remind-at" style="display:${remindMode === 'fest' ? 'block' : 'none'}"
                   value="${task && remindMode === 'fest' ? toInputValue(task.remind_at) : ''}" />
            <div id="lead-wrap" style="display:${remindMode === 'vorlauf' ? 'block' : 'none'}">
              <select id="t-remind-lead">
                ${[[60, '1 Stunde vorher'], [180, '3 Stunden vorher'], [1440, '1 Tag vorher'], [4320, '3 Tage vorher'], [10080, '1 Woche vorher']]
                  .map(([v, l]) => `<option value="${v}" ${task && Number(task.remind_lead_minutes) === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
              <p class="hint-text">Benötigt ein Fälligkeitsdatum.</p>
            </div>

            <label for="t-recurrence">Wiederholung</label>
            <select id="t-recurrence">${options(RECURRENCES, task ? (task.recurrence_rule || '') : '')}</select>

            <button type="submit" class="btn btn-primary btn-block" style="margin-top:6px">${task ? 'Änderungen speichern' : 'Aufgabe erstellen'}</button>
            ${task ? '<button type="button" class="btn btn-danger btn-block" id="delete-task" style="margin-top:8px">Aufgabe löschen</button>' : ''}
          </form>
        </div>
      </div>`;
  }

  function renderShoppingEditor() {
    const editor = document.getElementById('shopping-editor');
    if (!editor) return;
    const items = state.draftItems;

    editor.innerHTML = `
      ${items.map((item, index) => `
        <div class="shopping-row">
          <button type="button" class="tick ${item.checked ? 'checked' : ''}" data-item-check="${index}"
                  aria-label="${item.checked ? 'Nicht erledigt' : 'Erledigt'}">${icon('check', 12)}</button>
          <span class="text ${item.checked ? 'checked' : ''}">${escapeHtml(item.text)}</span>
          <button type="button" class="icon-btn" data-item-del="${index}" aria-label="Artikel entfernen">${icon('trash', 15)}</button>
        </div>`).join('') || '<p class="hint-text" style="margin:0 0 6px">Noch keine Artikel.</p>'}
      <div class="shopping-add">
        <label class="visually-hidden" for="item-input">Artikel hinzufügen</label>
        <input type="text" id="item-input" placeholder="Artikel hinzufügen …" />
        <button type="button" class="btn" id="item-add">${icon('plus', 16)}</button>
      </div>`;

    editor.querySelectorAll('[data-item-check]').forEach((el) => {
      el.onclick = () => {
        const item = items[Number(el.dataset.itemCheck)];
        item.checked = !item.checked;
        renderShoppingEditor();
      };
    });
    editor.querySelectorAll('[data-item-del]').forEach((el) => {
      el.onclick = () => { items.splice(Number(el.dataset.itemDel), 1); renderShoppingEditor(); };
    });

    const input = document.getElementById('item-input');
    const add = () => {
      const text = input.value.trim();
      if (!text) return;
      items.push({ text, checked: false });
      renderShoppingEditor();
      document.getElementById('item-input').focus();
    };
    document.getElementById('item-add').onclick = add;
    input.onkeydown = (event) => {
      if (event.key === 'Enter') { event.preventDefault(); add(); }
    };
  }

  function attachTaskDialog() {
    const task = state.dialog.task || null;
    let remindMode = task ? (task.remind_mode || '') : '';
    let status = task ? task.status : 'offen';

    const category = document.getElementById('t-category');
    category.onchange = () => {
      document.getElementById('shopping-wrap').style.display = category.value === 'einkauf' ? 'block' : 'none';
      if (category.value === 'einkauf') renderShoppingEditor();
    };
    if (category.value === 'einkauf') renderShoppingEditor();

    document.querySelectorAll('#remind-mode button').forEach((btn) => {
      btn.onclick = () => {
        remindMode = btn.dataset.mode;
        document.querySelectorAll('#remind-mode button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        document.getElementById('t-remind-at').style.display = remindMode === 'fest' ? 'block' : 'none';
        document.getElementById('lead-wrap').style.display = remindMode === 'vorlauf' ? 'block' : 'none';
      };
    });

    document.querySelectorAll('#t-status button').forEach((btn) => {
      btn.onclick = () => {
        status = btn.dataset.status;
        document.querySelectorAll('#t-status button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      };
    });

    const del = document.getElementById('delete-task');
    if (del) {
      del.onclick = async () => {
        if (!confirm(`„${task.title}“ wirklich löschen?`)) return;
        try {
          await api(`/tasks/${task.id}`, { method: 'DELETE' });
          closeDialog();
          await refreshTasks();
          renderContent();
          renderSidebar();
        } catch (err) { alert(err.message); }
      };
    }

    document.getElementById('task-form').onsubmit = async (event) => {
      event.preventDefault();
      const payload = {
        title: document.getElementById('t-title').value,
        notes: document.getElementById('t-notes').value || null,
        category: category.value,
        priority: document.getElementById('t-priority').value,
        assignedTo: document.getElementById('t-assignee').value || null,
        dueAt: document.getElementById('t-due').value || null,
        remindMode: remindMode || null,
        remindAt: document.getElementById('t-remind-at').value || null,
        remindLeadMinutes: remindMode === 'vorlauf' ? document.getElementById('t-remind-lead').value : null,
        recurrenceRule: document.getElementById('t-recurrence').value || null,
        items: category.value === 'einkauf' ? state.draftItems : []
      };
      if (task) payload.status = status;

      try {
        await api(task ? `/tasks/${task.id}` : '/tasks', {
          method: task ? 'PATCH' : 'POST',
          body: JSON.stringify(payload)
        });
        closeDialog();
        await refreshTasks();
        renderContent();
        renderSidebar();
      } catch (err) { alert(err.message); }
    };
  }

  function accountDialog() {
    const f = state.family;
    return `
      <div class="backdrop" id="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div class="dialog">
          <div class="dialog-head">
            <h2 id="dialog-title">Familie &amp; Konto</h2>
            <button class="icon-btn" id="dialog-close" aria-label="Schliessen">${icon('close', 18)}</button>
          </div>

          <section class="panel">
            <h2>${escapeHtml(f.name)}</h2>
            ${f.members.map((m) => `
              <div class="member-row">
                ${avatarHtml(m.display_name)}
                <div>
                  <div>${escapeHtml(m.display_name)}${m.id === state.user.id ? ' (du)' : ''}</div>
                  <div class="email">${escapeHtml(m.email)}</div>
                </div>
              </div>`).join('')}
          </section>

          <p class="hint-text">Wer sich anmelden darf, legt der Server fest (Einstellung <code>ALLOWED_USERS</code>).</p>

          <button class="btn btn-block" id="enable-push" style="margin-bottom:8px">${icon('bell', 17)} Erinnerungen aktivieren</button>
          <button class="btn btn-ghost btn-block" id="logout-btn">Abmelden</button>
        </div>
      </div>`;
  }

  function attachAccountDialog() {
    document.getElementById('enable-push').onclick = enablePush;
    document.getElementById('logout-btn').onclick = logout;
  }

  // ---------- Kalender-Export ----------
  function icsStamp(value) {
    const d = value ? new Date(value.replace(' ', 'T')) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  }

  function exportIcs() {
    const withDate = state.tasks.filter((t) => t.due_at && t.status !== 'erledigt');
    if (!withDate.length) {
      alert('Keine Aufgaben mit Fälligkeitsdatum vorhanden.');
      return;
    }

    const rrule = { taeglich: 'DAILY', woechentlich: 'WEEKLY', monatlich: 'MONTHLY' };
    const escapeIcs = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//iFamily//DE', 'CALSCALE:GREGORIAN'];
    for (const task of withDate) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:ifamily-${task.id}@${location.hostname}`);
      lines.push(`DTSTAMP:${icsStamp(null)}`);
      lines.push(`DTSTART:${icsStamp(task.due_at)}`);
      lines.push(`SUMMARY:${escapeIcs(task.title)}`);
      if (task.notes) lines.push(`DESCRIPTION:${escapeIcs(task.notes)}`);
      if (task.recurrence_rule) lines.push(`RRULE:FREQ=${rrule[task.recurrence_rule]}`);
      if (task.remind_lead_minutes) {
        lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${task.remind_lead_minutes}M`,
          `DESCRIPTION:${escapeIcs(task.title)}`, 'END:VALARM');
      }
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ifamily-aufgaben.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- Abgleich zwischen Geraeten ----------
  // Alle paar Sekunden nur eine kurze Versionskennung holen und die Daten nur
  // dann nachladen, wenn jemand anders etwas geaendert hat.
  async function checkForChanges() {
    if (!state.sessionToken || !state.user) return;
    if (document.hidden) return;
    // Nicht dazwischenfunken, solange jemand einen Dialog ausgefuellt hat
    if (state.dialog) return;

    try {
      const version = await currentVersion();
      if (version === null || version === syncVersion) return;

      await refreshTasks();
      await refreshLists();
      renderContent();
      renderSidebar();
    } catch (err) {
      // Netzwerkaussetzer einfach beim naechsten Durchgang erneut versuchen
    }
  }

  function startSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(checkForChanges, 5000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForChanges();
    });
  }

  // ---------- Push ----------
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push-Benachrichtigungen werden auf diesem Gerät oder Browser nicht unterstützt.');
      return;
    }
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        alert('Benachrichtigungen wurden nicht erlaubt.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await api('/push/public-key');
      if (!publicKey) {
        alert('Der Server hat Push noch nicht konfiguriert (VAPID-Schlüssel fehlen).');
        return;
      }
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      await api('/push/subscribe', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
      alert('Erinnerungen sind aktiviert.');
    } catch (err) {
      alert('Konnte Push nicht aktivieren: ' + err.message);
    }
  }

  // ---------- Start ----------
  if ('serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('/service-worker.js').catch((err) => console.error('SW-Fehler:', err));
  }

  render();
})();

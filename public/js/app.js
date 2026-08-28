(function () {
  'use strict';

  const state = {
    sessionToken: localStorage.getItem('ifamily_session'),
    user: null,
    family: null,
    tasks: [],
    lists: [],
    tab: 'tasks',
    showCompleted: false,
    sheet: null, // { type: 'task' | 'list' }
    loginStep: 'form', // 'form' | 'sent'
    loginError: null,
    busy: false
  };

  const app = document.getElementById('app');

  // ---------- API ----------
  async function api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (state.sessionToken) headers.Authorization = 'Bearer ' + state.sessionToken;
    const res = await fetch('/api' + path, Object.assign({}, options, { headers }));
    let data = null;
    try { data = await res.json(); } catch (err) { /* no body */ }
    if (res.status === 401) {
      logout();
      throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
    }
    if (!res.ok) {
      throw new Error((data && data.error) || 'Fehler bei der Anfrage.');
    }
    return data;
  }

  function logout() {
    localStorage.removeItem('ifamily_session');
    localStorage.removeItem('ifamily_user');
    state.sessionToken = null;
    state.user = null;
    render();
  }

  // ---------- Data loading ----------
  async function loadAll() {
    const [me, family, taskRes, listRes] = await Promise.all([
      api('/auth/me'),
      api('/family'),
      api('/tasks'),
      api('/lists')
    ]);
    state.user = me.user;
    state.family = family;
    state.tasks = taskRes.tasks;
    state.lists = listRes.lists;
  }

  async function refreshTasks() {
    const res = await api('/tasks');
    state.tasks = res.tasks;
  }

  async function refreshLists() {
    const res = await api('/lists');
    state.lists = res.lists;
  }

  // ---------- Formatting ----------
  function fmtDateTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function memberName(id) {
    if (!id) return null;
    const member = (state.family?.members || []).find((m) => m.id === id);
    return member ? member.display_name : null;
  }

  function isOverdue(task) {
    return task.status === 'offen' && task.due_at && new Date(task.due_at) < new Date();
  }

  // ---------- Render root ----------
  function render() {
    if (!state.sessionToken) {
      renderLogin();
    } else if (!state.user) {
      app.innerHTML = '<div class="login-screen"><p class="subtitle">Lädt …</p></div>';
      loadAll().then(render).catch((err) => {
        app.innerHTML = `<div class="login-screen"><p class="subtitle">${escapeHtml(err.message)}</p></div>`;
      });
    } else {
      renderApp();
    }
  }

  // ---------- Login ----------
  function renderLogin() {
    if (state.loginStep === 'sent') {
      app.innerHTML = `
        <div class="login-screen">
          <h1>iFamily</h1>
          <p class="subtitle">E-Mail unterwegs</p>
          <div class="card">
            <p>Wir haben dir einen Anmelde-Link geschickt. Öffne dein Postfach auf diesem Gerät und tippe auf den Link.</p>
          </div>
          <button class="link" id="back-to-form">Andere E-Mail verwenden</button>
        </div>`;
      document.getElementById('back-to-form').onclick = () => { state.loginStep = 'form'; render(); };
      return;
    }

    app.innerHTML = `
      <div class="login-screen">
        <h1>iFamily</h1>
        <p class="subtitle">Aufgaben &amp; Listen für die ganze Familie</p>
        <form id="login-form" class="card">
          <div class="field-group">
            <label for="email">E-Mail-Adresse</label>
            <input type="email" id="email" required placeholder="du@beispiel.ch" />
          </div>
          <div class="field-group">
            <label for="name">Name (nur beim ersten Mal nötig)</label>
            <input type="text" id="name" placeholder="Vorname" />
          </div>
          <div class="field-group">
            <label for="invite">Einladungscode (falls du einer bestehenden Familie beitrittst)</label>
            <input type="text" id="invite" placeholder="z. B. AB12CD34" />
          </div>
          ${state.loginError ? `<p class="error-text">${escapeHtml(state.loginError)}</p>` : ''}
          <button type="submit" class="primary" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Sende Link …' : 'Anmelde-Link senden'}</button>
        </form>
      </div>`;

    document.getElementById('login-form').onsubmit = async (event) => {
      event.preventDefault();
      state.busy = true;
      state.loginError = null;
      render();
      try {
        await api('/auth/request-link', {
          method: 'POST',
          body: JSON.stringify({
            email: document.getElementById('email').value,
            displayName: document.getElementById('name').value,
            inviteCode: document.getElementById('invite').value
          })
        });
        state.loginStep = 'sent';
      } catch (err) {
        state.loginError = err.message;
      } finally {
        state.busy = false;
        render();
      }
    };
  }

  // ---------- App shell ----------
  function renderApp() {
    const titles = { tasks: 'Aufgaben', lists: 'Listen', family: 'Familie' };
    app.innerHTML = `
      <header class="topbar">
        <h1>${escapeHtml(titles[state.tab])}</h1>
      </header>
      <main id="main"></main>
      ${state.tab !== 'family' ? `<button class="fab" id="fab">+</button>` : ''}
      <nav class="tabbar">
        <button data-tab="tasks" class="${state.tab === 'tasks' ? 'active' : ''}"><span class="icon">✅</span>Aufgaben</button>
        <button data-tab="lists" class="${state.tab === 'lists' ? 'active' : ''}"><span class="icon">🛒</span>Listen</button>
        <button data-tab="family" class="${state.tab === 'family' ? 'active' : ''}"><span class="icon">👪</span>Familie</button>
      </nav>
      ${state.sheet ? renderSheet() : ''}
    `;

    document.querySelectorAll('nav.tabbar button').forEach((btn) => {
      btn.onclick = () => { state.tab = btn.dataset.tab; state.sheet = null; render(); };
    });

    const fab = document.getElementById('fab');
    if (fab) {
      fab.onclick = () => {
        state.sheet = { type: state.tab === 'lists' ? 'list' : 'task' };
        render();
      };
    }

    const main = document.getElementById('main');
    if (state.tab === 'tasks') renderTasksTab(main);
    else if (state.tab === 'lists') renderListsTab(main);
    else renderFamilyTab(main);

    attachSheetHandlers();
  }

  // ---------- Tasks tab ----------
  function renderTasksTab(main) {
    const openTasks = state.tasks.filter((t) => t.status === 'offen');
    const doneTasks = state.tasks.filter((t) => t.status === 'erledigt');

    if (openTasks.length === 0) {
      main.innerHTML = `<div class="empty-state">Keine offenen Aufgaben. 🎉<br>Tippe auf + um eine hinzuzufügen.</div>`;
    } else {
      main.innerHTML = `<div class="card">${openTasks.map(taskRow).join('')}</div>`;
    }

    main.innerHTML += `
      <button class="link" id="toggle-completed">${state.showCompleted ? 'Erledigte ausblenden' : `Erledigte anzeigen (${doneTasks.length})`}</button>
      ${state.showCompleted ? `<div class="card">${doneTasks.length ? doneTasks.map(taskRow).join('') : '<div class="empty-state">Noch nichts erledigt.</div>'}</div>` : ''}
    `;

    document.getElementById('toggle-completed').onclick = () => { state.showCompleted = !state.showCompleted; render(); };

    main.querySelectorAll('[data-toggle-task]').forEach((box) => {
      box.onclick = async () => {
        const id = Number(box.dataset.toggleTask);
        const task = state.tasks.find((t) => t.id === id);
        await api(`/tasks/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: task.status === 'offen' ? 'erledigt' : 'offen' })
        });
        await refreshTasks();
        render();
      };
    });
  }

  function taskRow(task) {
    const assignee = memberName(task.assigned_to);
    const metaParts = [];
    if (task.due_at) metaParts.push(`<span class="${isOverdue(task) ? 'overdue' : ''}">Fällig ${fmtDateTime(task.due_at)}</span>`);
    if (assignee) metaParts.push(escapeHtml(assignee));
    if (task.recurrence_rule) metaParts.push('🔁 ' + recurrenceLabel(task.recurrence_rule));
    return `
      <div class="task-item">
        <button class="checkbox ${task.status === 'erledigt' ? 'checked' : ''}" data-toggle-task="${task.id}">${task.status === 'erledigt' ? '✓' : ''}</button>
        <div class="task-body">
          <div class="task-title ${task.status === 'erledigt' ? 'done' : ''}">${escapeHtml(task.title)}</div>
          ${metaParts.length ? `<div class="task-meta">${metaParts.join(' · ')}</div>` : ''}
        </div>
      </div>`;
  }

  function recurrenceLabel(rule) {
    return { taeglich: 'täglich', woechentlich: 'wöchentlich', monatlich: 'monatlich' }[rule] || rule;
  }

  // ---------- Lists tab ----------
  function renderListsTab(main) {
    if (state.lists.length === 0) {
      main.innerHTML = `<div class="empty-state">Noch keine Liste. Tippe auf + um z. B. eine Einkaufsliste anzulegen.</div>`;
      return;
    }
    main.innerHTML = state.lists.map((list) => `
      <div class="card" data-list-card="${list.id}">
        <strong>${escapeHtml(list.name)}</strong>
        <div class="list-items">
          ${list.items.map((item) => `
            <div class="list-item">
              <button class="checkbox ${item.checked ? 'checked' : ''}" data-toggle-item="${list.id}:${item.id}">${item.checked ? '✓' : ''}</button>
              <div class="item-body">${escapeHtml(item.text)}</div>
              <button class="link" data-delete-item="${list.id}:${item.id}">✕</button>
            </div>`).join('') || '<div class="hint-text">Noch keine Einträge.</div>'}
        </div>
        <form data-add-item="${list.id}" style="display:flex; gap:8px; margin-top:8px;">
          <input type="text" placeholder="Hinzufügen …" style="margin-bottom:0;" required />
          <button type="submit" class="secondary">+</button>
        </form>
      </div>
    `).join('');

    main.querySelectorAll('[data-toggle-item]').forEach((box) => {
      box.onclick = async () => {
        const [listId, itemId] = box.dataset.toggleItem.split(':');
        const list = state.lists.find((l) => l.id === Number(listId));
        const item = list.items.find((i) => i.id === Number(itemId));
        await api(`/lists/${listId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ checked: !item.checked }) });
        await refreshLists();
        render();
      };
    });

    main.querySelectorAll('[data-delete-item]').forEach((btn) => {
      btn.onclick = async () => {
        const [listId, itemId] = btn.dataset.deleteItem.split(':');
        await api(`/lists/${listId}/items/${itemId}`, { method: 'DELETE' });
        await refreshLists();
        render();
      };
    });

    main.querySelectorAll('[data-add-item]').forEach((form) => {
      form.onsubmit = async (event) => {
        event.preventDefault();
        const input = form.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        await api(`/lists/${form.dataset.addItem}/items`, { method: 'POST', body: JSON.stringify({ text }) });
        await refreshLists();
        render();
      };
    });
  }

  // ---------- Family tab ----------
  function renderFamilyTab(main) {
    const f = state.family;
    main.innerHTML = `
      <div class="card">
        <label>Familie</label>
        <strong style="font-size:1.1rem;">${escapeHtml(f.name)}</strong>
      </div>
      <div class="card">
        <label>Mitglieder</label>
        ${f.members.map((m) => `<div class="task-item"><div class="task-body">${escapeHtml(m.display_name)}<div class="task-meta">${escapeHtml(m.email)}</div></div></div>`).join('')}
      </div>
      <div class="card">
        <label>Einladungscode für neue Mitglieder</label>
        <div class="invite-code">${escapeHtml(f.inviteCode)}</div>
        <button class="secondary" id="share-invite" style="width:100%;">Einladung teilen</button>
      </div>
      <div class="card">
        <button class="secondary" id="enable-push" style="width:100%; margin-bottom:10px;">🔔 Erinnerungen aktivieren</button>
        <button class="secondary" id="logout" style="width:100%;">Abmelden</button>
      </div>
    `;

    document.getElementById('share-invite').onclick = async () => {
      const text = `Tritt unserer Familie auf iFamily bei! Öffne die App und gib den Code ${f.inviteCode} ein: ${location.origin}`;
      if (navigator.share) {
        try { await navigator.share({ text }); } catch (err) { /* abgebrochen */ }
      } else {
        await navigator.clipboard.writeText(text);
        alert('Einladungstext kopiert.');
      }
    };

    document.getElementById('enable-push').onclick = enablePush;
    document.getElementById('logout').onclick = logout;
  }

  // ---------- Add sheets ----------
  function renderSheet() {
    if (state.sheet.type === 'task') return renderTaskSheet();
    if (state.sheet.type === 'list') return renderListSheet();
    return '';
  }

  function renderTaskSheet() {
    const members = state.family.members;
    return `
      <div class="sheet-backdrop" id="sheet-backdrop">
        <div class="sheet">
          <h2>Neue Aufgabe</h2>
          <form id="task-form">
            <div class="field-group">
              <label for="t-title">Titel</label>
              <input type="text" id="t-title" required placeholder="z. B. Einkaufen gehen" />
            </div>
            <div class="field-group">
              <label for="t-assignee">Zuweisen an</label>
              <select id="t-assignee">
                <option value="">Niemand Bestimmtes</option>
                ${members.map((m) => `<option value="${m.id}">${escapeHtml(m.display_name)}</option>`).join('')}
              </select>
            </div>
            <div class="field-group">
              <label for="t-due">Fällig am (optional)</label>
              <input type="datetime-local" id="t-due" />
            </div>
            <div class="field-group">
              <label>Erinnerung</label>
              <div class="pill-group" id="remind-mode">
                <button type="button" data-mode="">Keine</button>
                <button type="button" data-mode="fest">Feste Zeit</button>
                <button type="button" data-mode="vorlauf">Vorlaufzeit</button>
              </div>
              <input type="datetime-local" id="t-remind-at" style="display:none;" />
              <div id="lead-wrap" style="display:none;">
                <input type="number" id="t-remind-lead" placeholder="Minuten vor Fälligkeit" min="1" />
                <p class="hint-text">Benötigt ein Fälligkeitsdatum oben.</p>
              </div>
            </div>
            <div class="field-group">
              <label for="t-recurrence">Wiederholung</label>
              <select id="t-recurrence">
                <option value="">Keine</option>
                <option value="taeglich">Täglich</option>
                <option value="woechentlich">Wöchentlich</option>
                <option value="monatlich">Monatlich</option>
              </select>
            </div>
            <button type="submit" class="primary">Aufgabe erstellen</button>
            <button type="button" class="link" id="cancel-sheet" style="width:100%; text-align:center;">Abbrechen</button>
          </form>
        </div>
      </div>`;
  }

  function renderListSheet() {
    return `
      <div class="sheet-backdrop" id="sheet-backdrop">
        <div class="sheet">
          <h2>Neue Liste</h2>
          <form id="list-form">
            <div class="field-group">
              <label for="l-name">Name</label>
              <input type="text" id="l-name" required placeholder="z. B. Einkaufsliste" />
            </div>
            <button type="submit" class="primary">Liste erstellen</button>
            <button type="button" class="link" id="cancel-sheet" style="width:100%; text-align:center;">Abbrechen</button>
          </form>
        </div>
      </div>`;
  }

  function attachSheetHandlers() {
    const backdrop = document.getElementById('sheet-backdrop');
    if (!backdrop) return;
    backdrop.onclick = (event) => { if (event.target === backdrop) { state.sheet = null; render(); } };
    const cancel = document.getElementById('cancel-sheet');
    if (cancel) cancel.onclick = () => { state.sheet = null; render(); };

    const taskForm = document.getElementById('task-form');
    if (taskForm) {
      let remindMode = '';
      document.querySelectorAll('#remind-mode button').forEach((btn) => {
        btn.onclick = () => {
          remindMode = btn.dataset.mode;
          document.querySelectorAll('#remind-mode button').forEach((b) => b.classList.toggle('active', b === btn));
          document.getElementById('t-remind-at').style.display = remindMode === 'fest' ? 'block' : 'none';
          document.getElementById('lead-wrap').style.display = remindMode === 'vorlauf' ? 'block' : 'none';
        };
      });

      taskForm.onsubmit = async (event) => {
        event.preventDefault();
        try {
          await api('/tasks', {
            method: 'POST',
            body: JSON.stringify({
              title: document.getElementById('t-title').value,
              assignedTo: document.getElementById('t-assignee').value || null,
              dueAt: document.getElementById('t-due').value || null,
              remindMode: remindMode || null,
              remindAt: document.getElementById('t-remind-at').value || null,
              remindLeadMinutes: document.getElementById('t-remind-lead').value || null,
              recurrenceRule: document.getElementById('t-recurrence').value || null
            })
          });
          state.sheet = null;
          await refreshTasks();
          render();
        } catch (err) {
          alert(err.message);
        }
      };
    }

    const listForm = document.getElementById('list-form');
    if (listForm) {
      listForm.onsubmit = async (event) => {
        event.preventDefault();
        try {
          await api('/lists', { method: 'POST', body: JSON.stringify({ name: document.getElementById('l-name').value }) });
          state.sheet = null;
          await refreshLists();
          render();
        } catch (err) {
          alert(err.message);
        }
      };
    }
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
      alert('Push-Benachrichtigungen werden auf diesem Gerät/Browser nicht unterstützt.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
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

  // ---------- Utils ----------
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Init ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => console.error('SW-Fehler:', err));
  }

  render();
})();

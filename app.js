(() => {
  'use strict';
  const STORAGE_KEY = 'bluetodo.tasks.v1';
  const $ = (selector) => document.querySelector(selector);
  const today = () => localDateString(new Date());
  const localDateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = (dateString, amount) => { const d = parseLocalDate(dateString); d.setDate(d.getDate() + amount); return localDateString(d); };
  const parseLocalDate = (value) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12); };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const formatDate = (value, options = { month: 'short', day: 'numeric' }) => value ? parseLocalDate(value).toLocaleDateString(undefined, options) : 'No deadline';
  const weekday = (date) => date.toLocaleDateString(undefined, { weekday: 'short' });
  const now = new Date();
  const seedTasks = [
    { id: uid(), title: 'Gather notes for the week ahead', date: today(), priority: 'High', duration: 25, done: false, createdAt: Date.now() - 20000 },
    { id: uid(), title: 'Take a proper lunch break', date: today(), priority: 'Normal', duration: 30, done: false, createdAt: Date.now() - 10000 },
    { id: uid(), title: 'Review one thing you learned', date: addDays(today(), 1), priority: 'Normal', duration: 20, done: true, createdAt: Date.now() - 30000 }
  ];
  let tasks;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    tasks = Array.isArray(stored) ? stored.filter((item) => item && typeof item.title === 'string') : seedTasks;
  } catch { tasks = seedTasks; }
  if (!localStorage.getItem(STORAGE_KEY)) persist();
  let activeView = 'today';
  let draftSuggestions = [];
  let editingTaskId = null;
  let weekOffset = 0;
  let toastTimer;

  function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch { showToast('Could not save: browser storage may be full.'); } }
  function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2700); }
  function setGeminiStatus(state, message) {
    const badge = $('#gemini-status');
    badge.className = `connection-badge ${state}`;
    $('#gemini-status-text').textContent = message;
    badge.title = state === 'connected' ? 'Gemini connection verified. Click to check again.' : 'Click to test Gemini connection.';
  }
  async function checkGeminiConnection() {
    const badge = $('#gemini-status');
    badge.disabled = true;
    setGeminiStatus('checking', 'Checking Gemini…');
    try {
      const response = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const payload = await response.json();
      if (!response.ok || !payload.connected) throw new Error(payload.error || 'Gemini connection check failed.');
      setGeminiStatus('connected', `Gemini connected · ${payload.model}`);
    } catch (error) {
      const message = error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'Gemini check timed out. Try again.'
        : (error.message || 'Could not check Gemini connection.');
      setGeminiStatus('error', 'Gemini not connected · click to retry');
      badge.title = message;
    } finally {
      badge.disabled = false;
    }
  }
  function escapeIcs(value) { return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  function priorityClass(priority) { return priority === 'Urgent' ? 'urgent' : priority === 'High' ? 'high' : ''; }
  function openTasks() { return tasks.filter((task) => !task.done); }
  function render() { renderHeader(); renderStats(); renderTasks(); renderCalendar(); }
  function renderHeader() {
    const date = new Date();
    $('#header-date').textContent = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    $('#date-chip').textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    $('#today-count').textContent = openTasks().filter((task) => task.date === today()).length;
    const names = { today: 'Today', upcoming: 'Upcoming', completed: 'Completed', calendar: 'Calendar' };
    $('#breadcrumb-view').textContent = names[activeView];
    $('#page-title').textContent = activeView === 'today' ? 'Make room for what matters.' : activeView === 'upcoming' ? 'One step at a time.' : activeView === 'completed' ? 'Look how far you’ve come.' : 'A little space to plan ahead.';
    $('#page-subtitle').textContent = activeView === 'today' ? 'A little progress adds up. Here’s your day at a glance.' : activeView === 'upcoming' ? 'See what’s coming up, without taking it all on at once.' : activeView === 'completed' ? 'Every small finish is worth noticing.' : 'Your week, laid out gently. No calendar sync, just your plan.';
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === activeView));
  }
  function renderStats() {
    const upcoming = openTasks();
    const done = tasks.filter((task) => task.done).length;
    $('#stat-open').textContent = upcoming.length;
    $('#stat-done').textContent = done;
    $('#stat-priority').textContent = upcoming.filter((task) => task.priority === 'High' || task.priority === 'Urgent').length;
    const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    $('#completion-percent').textContent = `${pct}%`;
    const todayList = upcoming.filter((task) => task.date === today());
    const todayDone = tasks.filter((task) => task.done && task.date === today()).length;
    const progress = todayList.length + todayDone ? Math.round(todayDone / (todayList.length + todayDone) * 100) : 0;
    $('#today-progress').style.width = `${progress}%`;
    $('#progress-label').textContent = `${progress}% done`;
  }
  function visibleTasks() {
    if (activeView === 'completed') return tasks.filter((task) => task.done).sort(byDate);
    if (activeView === 'upcoming') return openTasks().filter((task) => task.date && task.date > today()).sort(byDate);
    return openTasks().filter((task) => task.date === today() || !task.date || task.date < today()).sort(byDate);
  }
  function byDate(a, b) { return (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99') || (b.createdAt || 0) - (a.createdAt || 0); }
  function renderTasks() {
    const isCalendar = activeView === 'calendar';
    $('#calendar-panel').classList.toggle('hidden', !isCalendar);
    $('#dashboard-grid').classList.toggle('hidden', isCalendar);
    $('#stats-row').classList.toggle('hidden', isCalendar);
    $('#capture-card').classList.toggle('hidden', isCalendar || activeView === 'completed');
    if (isCalendar) return;
    const labels = { today: ['YOUR FOCUS', 'Today’s tasks'], upcoming: ['AHEAD OF YOU', 'Upcoming tasks'], completed: ['SMALL WINS', 'Completed tasks'] };
    $('#task-eyebrow').textContent = labels[activeView][0];
    $('#task-heading').firstChild.textContent = `${labels[activeView][1]} `;
    const shown = visibleTasks();
    $('#task-count').textContent = shown.length;
    $('#empty-state').classList.toggle('hidden', shown.length > 0);
    $('#task-list').innerHTML = shown.map((task) => taskMarkup(task)).join('');
    $('#task-list').classList.toggle('hidden', shown.length === 0);
    $('#today-count').textContent = openTasks().filter((task) => task.date === today()).length;
  }
  function taskMarkup(task) {
    const overdue = !task.done && task.date && task.date < today();
    const dueToday = !task.done && task.date === today();
    return `<article class="task-card ${task.done ? 'done' : ''}" data-task="${escapeHtml(task.id)}"><button class="task-check" data-action="toggle" aria-label="${task.done ? 'Mark incomplete' : 'Mark complete'}">${task.done ? '✓' : ''}</button><div class="task-main"><div class="task-title">${escapeHtml(task.title)}</div><div class="task-meta"><span class="priority-pill priority-${escapeHtml(task.priority || 'Normal')}">${escapeHtml(task.priority || 'Normal')}</span><span class="task-date ${overdue || dueToday ? 'due-today' : ''}">${overdue ? 'Overdue · ' : dueToday ? 'Due today · ' : ''}${escapeHtml(formatDate(task.date))}</span></div></div>${task.duration ? `<span class="task-duration">◷ ${escapeHtml(task.duration)} min</span>` : ''}<div class="task-tools"><button data-action="edit" title="Edit task" aria-label="Edit task">✎</button><button data-action="delete" title="Delete task" aria-label="Delete task">×</button></div></article>`;
  }
  function renderCalendar() {
    const base = new Date(); base.setDate(base.getDate() + weekOffset * 7);
    const monday = new Date(base); const day = (monday.getDay() + 6) % 7; monday.setDate(monday.getDate() - day); monday.setHours(12, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return date; });
    $('#week-title').textContent = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    $('#week-grid').innerHTML = days.map((date) => {
      const key = localDateString(date);
      const events = tasks.filter((task) => task.date === key).sort(byDate).map((task) => `<div class="calendar-event ${priorityClass(task.priority)}" title="${escapeHtml(task.title)}">${task.done ? '✓ ' : ''}${escapeHtml(task.title)}</div>`).join('');
      return `<div class="day-column ${key === today() ? 'today' : ''}"><div class="day-head">${weekday(date)}<strong>${date.getDate()}</strong></div><div class="day-events">${events}</div></div>`;
    }).join('');
  }
  async function createPlan(prompt) {
    const button = $('#plan-button');
    const startedAt = Date.now();
    button.disabled = true;
    button.innerHTML = '<span>◌</span> Asking Gemini…';
    setGeminiStatus('checking', 'Gemini is making your plan…');
    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context: tasks.slice(0, 30) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Gemini API returned ${response.status}.`);
      const plan = payload.plan;
      if (!plan || typeof plan.goal !== 'string' || !Array.isArray(plan.tasks) || plan.tasks.length < 1 || plan.tasks.length > 12) {
        throw new Error('Gemini returned an invalid plan. Please try again.');
      }
      draftSuggestions = plan.tasks.map((task) => ({
        id: uid(),
        title: String(task.title || '').slice(0, 160),
        date: typeof task.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.deadline) ? task.deadline : '',
        priority: ['Urgent', 'High', 'Normal'].includes(task.priority) ? task.priority : 'Normal',
        duration: Number.isInteger(task.duration_minutes) && task.duration_minutes >= 5 && task.duration_minutes <= 480 ? task.duration_minutes : null
      })).filter((task) => task.title.trim());
      if (!draftSuggestions.length) throw new Error('Gemini did not return any usable tasks. Please try again.');
      $('#plan-goal').textContent = plan.goal;
      $('#plan-model').textContent = `GEMINI · ${payload.model || 'GEMINI API'}`;
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      setGeminiStatus('connected', `Gemini ready · ${elapsedSeconds}s`);
      const clarifications = Array.isArray(plan.clarification_needed) ? plan.clarification_needed.filter((item) => typeof item === 'string' && item.trim()) : [];
      $('#plan-reason').textContent = `${plan.reason || 'Review these suggested steps before saving.'}${clarifications.length ? ` Questions to consider: ${clarifications.join(' ')}` : ''} Dates and estimates are suggestions—please review them.`;
      $('#suggestion-count').textContent = draftSuggestions.length;
      $('#suggestion-list').innerHTML = draftSuggestions.map((suggestion, index) => suggestionMarkup(suggestion, index)).join('');
      $('#plan-panel').classList.remove('hidden');
      $('#plan-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      console.warn('Gemini planning request failed:', error);
      const message = error.message || 'Gemini could not make a plan. Check the server setup and try again.';
      setGeminiStatus('error', 'Gemini request failed · click to retry');
      $('#gemini-status').title = message;
      showToast(message);
    } finally {
      button.disabled = false;
      button.innerHTML = '<span>✧</span> Make me a plan <span class="button-arrow">→</span>';
    }
  }
  function suggestionMarkup(suggestion, index) {
    return `<div class="suggestion-row" data-suggestion="${escapeHtml(suggestion.id)}"><span class="suggestion-number">${index + 1}</span><input class="suggestion-title" aria-label="Task title" maxlength="120" value="${escapeHtml(suggestion.title)}"><input class="suggestion-date" aria-label="Deadline" type="date" value="${escapeHtml(suggestion.date)}"><select class="suggestion-priority" aria-label="Priority"><option ${suggestion.priority === 'Normal' ? 'selected' : ''}>Normal</option><option ${suggestion.priority === 'High' ? 'selected' : ''}>High</option><option ${suggestion.priority === 'Urgent' ? 'selected' : ''}>Urgent</option></select><button class="remove-suggestion" aria-label="Remove suggestion">×</button></div>`;
  }
  function syncDraftFromForm() {
    document.querySelectorAll('.suggestion-row').forEach((row) => {
      const item = draftSuggestions.find((suggestion) => suggestion.id === row.dataset.suggestion);
      if (!item) return;
      item.title = row.querySelector('.suggestion-title').value.trim();
      item.date = row.querySelector('.suggestion-date').value;
      item.priority = row.querySelector('.suggestion-priority').value;
    });
    draftSuggestions = draftSuggestions.filter((item) => item.title);
  }
  function approvePlan() {
    syncDraftFromForm();
    if (!draftSuggestions.length) { showToast('Add at least one task to your plan.'); return; }
    const newTasks = draftSuggestions.map((item) => ({ ...item, done: false, createdAt: Date.now() }));
    tasks = [...newTasks, ...tasks]; persist(); draftSuggestions = []; $('#plan-panel').classList.add('hidden'); render(); showToast(`${newTasks.length} ${newTasks.length === 1 ? 'task' : 'tasks'} added to your list.`);
  }
  function openTaskModal(task = null) {
    editingTaskId = task?.id || null;
    $('#modal-title').textContent = task ? 'Edit your task' : 'Add a task';
    $('#task-title-input').value = task?.title || '';
    $('#task-date-input').value = task?.date || '';
    $('#task-priority-input').value = task?.priority || 'Normal';
    $('#task-duration-input').value = task?.duration || '';
    $('#task-modal').classList.remove('hidden'); $('#task-title-input').focus();
  }
  function closeTaskModal() { $('#task-modal').classList.add('hidden'); editingTaskId = null; }
  function exportCalendar() {
    const entries = tasks.filter((task) => task.date);
    if (!entries.length) { showToast('Add a deadline to a task before exporting.'); return; }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const events = entries.map((task) => {
      const start = task.date.replace(/-/g, ''); const end = addDays(task.date, 1).replace(/-/g, '');
      return ['BEGIN:VEVENT', `UID:${escapeIcs(task.id)}@bluetodo.local`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${escapeIcs(task.title)}`, `DESCRIPTION:${escapeIcs(`${task.priority || 'Normal'} priority${task.duration ? ` · ${task.duration} minutes` : ''}${task.done ? ' · Completed' : ''}`)}`, 'END:VEVENT'].join('\r\n');
    });
    const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BlueTodo//Personal Planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...events, 'END:VCALENDAR'].join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' })); link.download = 'bluetodo-plan.ics'; link.click(); URL.revokeObjectURL(link.href); showToast('Your calendar file is ready to import.');
  }

  $('#planner-form').addEventListener('submit', (event) => { event.preventDefault(); const prompt = $('#planner-input').value.trim(); if (!prompt) return; createPlan(prompt); });
  $('#approve-plan').addEventListener('click', approvePlan);
  $('#discard-plan').addEventListener('click', () => { draftSuggestions = []; $('#plan-panel').classList.add('hidden'); });
  $('#reject-plan').addEventListener('click', () => { draftSuggestions = []; $('#plan-panel').classList.add('hidden'); });
  $('#suggestion-list').addEventListener('click', (event) => { const button = event.target.closest('.remove-suggestion'); if (!button) return; const row = button.closest('.suggestion-row'); draftSuggestions = draftSuggestions.filter((item) => item.id !== row.dataset.suggestion); row.remove(); $('#suggestion-count').textContent = draftSuggestions.length; });
  $('#task-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const card = button.closest('[data-task]'); const task = tasks.find((item) => item.id === card.dataset.task); if (!task) return;
    if (button.dataset.action === 'toggle') { task.done = !task.done; task.completedAt = task.done ? Date.now() : null; persist(); render(); }
    if (button.dataset.action === 'delete') { tasks = tasks.filter((item) => item.id !== task.id); persist(); render(); showToast('Task removed.'); }
    if (button.dataset.action === 'edit') openTaskModal(task);
  });
  $('#task-form').addEventListener('submit', (event) => {
    event.preventDefault(); const data = { title: $('#task-title-input').value.trim(), date: $('#task-date-input').value, priority: $('#task-priority-input').value, duration: Number($('#task-duration-input').value) || null };
    if (editingTaskId) tasks = tasks.map((task) => task.id === editingTaskId ? { ...task, ...data } : task);
    else tasks.unshift({ ...data, id: uid(), done: false, createdAt: Date.now() });
    persist(); closeTaskModal(); render(); showToast(editingTaskId ? 'Task updated.' : 'Task added to your list.');
  });
  $('#modal-close').addEventListener('click', closeTaskModal); $('#modal-cancel').addEventListener('click', closeTaskModal);
  $('#task-modal').addEventListener('click', (event) => { if (event.target.id === 'task-modal') closeTaskModal(); });
  $('#quick-add').addEventListener('click', () => openTaskModal());
  $('#empty-plan').addEventListener('click', () => { $('#planner-input').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#focus-button').addEventListener('click', () => { $('#planner-input').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#export-button').addEventListener('click', exportCalendar);
  $('#gemini-status').addEventListener('click', checkGeminiConnection);
  document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => { activeView = item.dataset.view; render(); $('#sidebar').classList.remove('open'); }));
  $('#week-prev').addEventListener('click', () => { weekOffset -= 1; renderCalendar(); }); $('#week-next').addEventListener('click', () => { weekOffset += 1; renderCalendar(); }); $('#week-today').addEventListener('click', () => { weekOffset = 0; renderCalendar(); });
  $('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#planner-input').addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) $('#planner-form').requestSubmit(); });
  render();
  checkGeminiConnection();
})();

// ─────────────────────────────────────────────────────────────
//  مدیریت وظایف و حضور و غیاب کارکنان فروشگاه یاسایی
// ─────────────────────────────────────────────────────────────
import { html as h, icon, esc, fmtNum, fmtDate, timeAgo, applyDyn } from '../../lib/dom.mjs';
import { t, isFa } from '../../i18n.mjs';
import { api } from '../../lib/api.mjs';
import { S, can } from '../../state.mjs';
import { tableHtml, field, selectField, emptyState, errorState } from '../../components.mjs';
import { toastSuccess, toastApiError, withBusy, confirmDialog } from '../../ui.mjs';
import { act } from '../../actions.mjs';
import { refresh } from '../../router.mjs';

const L = (fa, en) => (isFa() ? fa : en);

const TF = { status: '', priority: '' };
let TASKS_CACHE = [];
let PRESENCE_CACHE = [];
let STAFF_CACHE = [];

export async function render(ctx) {
  const sec = ctx.params.section;
  if (sec === 'presence') return renderPresence();
  return renderTasks();
}

// ── حضور و غیاب کارکنان ─────────────────────────────────────
async function renderPresence() {
  try {
    const res = await api.get('/api/admin/presence');
    PRESENCE_CACHE = res.items || [];
  } catch (err) {
    return errorState({ title: err?.message || t('err.generic') });
  }

  const onlineCount = PRESENCE_CACHE.filter((x) => x.status === 'online').length;
  const idleCount = PRESENCE_CACHE.filter((x) => x.status === 'idle').length;

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('clock')} ${L('حضور و غیاب کارکنان یاسایی', 'Staff Presence')}</h2>
        <p class="muted small">${fmtNum(PRESENCE_CACHE.length)} ${L('کارمند و مدیر ثبت‌شده', 'registered staff')} · <span class="badge-pill bp-success tiny">${fmtNum(onlineCount)} ${L('آنلاین', 'online')}</span> · <span class="badge-pill bp-warn tiny">${fmtNum(idleCount)} ${L('بیکار', 'idle')}</span></p>
      </div>
      <div class="row row-wrap">
        <a class="btn btn-outline btn-sm" href="#/admin/tasks">${icon('check-circle')} ${L('مدیریت وظایف', 'Tasks')}</a>
        <button type="button" class="btn btn-ghost btn-sm" data-act="adm-presence-refresh">${icon('refresh')} ${t('common.refresh')}</button>
      </div>
    </div>

    <div class="card">
      ${tableHtml(
        [
          { label: t('common.user') },
          { label: t('adm.uRole') },
          { label: t('common.status') },
          { label: L('آخرین فعالیت', 'Last Active') },
          { label: L('ورود به سامانه', 'Login Time') },
          { label: t('adm.uDevice') },
          { label: 'IP' },
        ],
        PRESENCE_CACHE.map((p) => h`
          <tr>
            <td>
              <span class="b">${esc(p.name || p.username)}</span>
              <div class="tiny mono muted">@${esc(p.username)}</div>
            </td>
            <td><span class="badge-pill ${p.role === 'owner' ? 'bp-accent' : 'bp-info'}">${p.role === 'owner' ? L('مالک', 'Owner') : L('کارمند', 'Staff')}</span></td>
            <td>${presenceBadge(p.status)}</td>
            <td class="tiny">${p.lastActiveAt ? timeAgo(p.lastActiveAt) : h`<span class="muted">—</span>`}</td>
            <td class="tiny">${p.loginAt ? fmtDate(p.loginAt) : h`<span class="muted">—</span>`}</td>
            <td class="tiny">${p.os || p.device ? `${esc(p.os || '')} · ${esc(p.device || '')} (${esc(p.browser || '')})` : h`<span class="muted">—</span>`}</td>
            <td class="mono tiny">${esc(p.lastIp || '—')}</td>
          </tr>`),
        { emptyText: L('اطلاعات حضوری ثبت نشده است.', 'No presence records.') }
      )}
    </div>`;
}

function presenceBadge(status) {
  if (status === 'online') return h`<span class="badge-pill bp-success">${L('آنلاین', 'Online')}</span>`;
  if (status === 'idle') return h`<span class="badge-pill bp-warn">${L('بیکار (عدم تعامل)', 'Idle')}</span>`;
  return h`<span class="badge-pill bp-muted">${L('آفلاین', 'Offline')}</span>`;
}

// ── مدیریت وظایف کارکنان ────────────────────────────────────
async function renderTasks() {
  try {
    const [tRes, uRes] = await Promise.all([
      api.get(api.url('/api/admin/tasks', { status: TF.status, priority: TF.priority })),
      api.get('/api/admin/users?role=staff').catch(() => ({ items: [] })),
    ]);
    TASKS_CACHE = tRes.items || [];
    STAFF_CACHE = (uRes.items || []).filter((u) => ['staff', 'owner'].includes(u.role));
  } catch (err) {
    return errorState({ title: err?.message || t('err.generic') });
  }

  return h`
    <div class="row row-between row-wrap mb">
      <div>
        <h2 class="section-title">${icon('check-circle')} ${L('تخصیص و پیگیری وظایف کارکنان', 'Staff Tasks')}</h2>
        <p class="muted small">${fmtNum(TASKS_CACHE.length)} ${L('وظیفه ثبت‌شده', 'tasks')}</p>
      </div>
      <div class="row row-wrap">
        <a class="btn btn-outline btn-sm" href="#/admin/presence">${icon('clock')} ${L('حضور و غیاب کارکنان', 'Presence')}</a>
        <button type="button" class="btn btn-primary btn-sm" data-act="adm-task-new">${icon('plus')} ${L('وظیفه جدید', 'New Task')}</button>
      </div>
    </div>

    <!-- فیلتر وظایف -->
    <form class="card mb adm-filter" data-act="adm-task-filter">
      <div class="form-grid">
        ${selectField({
          label: t('common.status'), name: 'status', value: TF.status,
          options: [
            { value: '', label: t('common.all') },
            { value: 'pending', label: L('در انتظار شروع', 'Pending') },
            { value: 'in_progress', label: L('در حال انجام', 'In Progress') },
            { value: 'done', label: L('تکمیل شده', 'Done') },
            { value: 'cancelled', label: L('لغو شده', 'Cancelled') },
          ],
        })}
        ${selectField({
          label: L('اولویت', 'Priority'), name: 'priority', value: TF.priority,
          options: [
            { value: '', label: t('common.all') },
            { value: 'urgent', label: L('فوری', 'Urgent') },
            { value: 'important', label: L('مهم', 'Important') },
            { value: 'normal', label: L('عادی', 'Normal') },
          ],
        })}
      </div>
      <div class="row row-wrap mt-s">
        <button class="btn btn-primary btn-sm" type="submit">${icon('filter')} ${t('common.apply')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="adm-task-clear">${icon('close')} ${t('catalog.f.clear')}</button>
      </div>
    </form>

    <!-- فرم وظیفه جدید (مخفی پیش‌فرض) -->
    <form class="card mb" id="admNewTaskForm" data-act="adm-task-create" hidden>
      <strong>${icon('plus')} ${L('ثبت وظیفه جدید', 'Create New Task')}</strong>
      <div class="form-grid mt-s">
        ${field({ label: L('عنوان وظیفه', 'Task Title'), name: 'title', required: true })}
        ${selectField({
          label: L('اولویت', 'Priority'), name: 'priority', value: 'normal',
          options: [
            { value: 'normal', label: L('عادی', 'Normal') },
            { value: 'important', label: L('مهم', 'Important') },
            { value: 'urgent', label: L('فوری', 'Urgent') },
          ],
        })}
        ${selectField({
          label: L('مسئول انجام', 'Assignee'), name: 'assignedTo', value: '',
          options: [{ value: '', label: L('بدون تخصیص', 'Unassigned') }, ...STAFF_CACHE.map((s) => ({ value: s.id, label: s.name || s.username }))],
        })}
        ${field({ label: L('مهلت انجام', 'Due Date'), name: 'dueDate', type: 'date' })}
      </div>
      <div class="mt-s">
        <label class="field"><span class="label">${t('pdp.description')}</span>
          <textarea class="input" name="description" rows="3" placeholder="${L('توضیحات و دستورالعمل وظیفه...', 'Task instructions...')}"></textarea>
        </label>
      </div>
      <div class="row row-wrap mt-s">
        <button class="btn btn-primary btn-sm" type="submit">${icon('save')} ${L('ثبت و واگذاری', 'Save & Assign')}</button>
        <button class="btn btn-ghost btn-sm" type="button" data-act="adm-task-cancel">${t('common.cancel')}</button>
      </div>
    </form>

    <!-- فهرست وظایف -->
    ${!TASKS_CACHE.length ? emptyState({ icon: 'check-circle', title: L('هیچ وظیفه‌ای با این مشخصات یافت نشد.', 'No tasks found.') }) : h`
      <div class="grid gap-3">
        ${TASKS_CACHE.map((task) => h`
          <div class="card pad border">
            <div class="row row-between row-wrap">
              <div>
                <span class="b" style="font-size: 1.05rem;">${esc(task.title)}</span>
                <span class="ms-2">${taskPriorityBadge(task.priority)}</span>
                <span class="ms-1">${taskStatusBadge(task.status)}</span>
              </div>
              <div class="row row-wrap tiny muted">
                <span>${L('مسئول:', 'Assignee:')} <b>${esc(task.assignedToName || L('تخصیص‌نیافته', 'Unassigned'))}</b></span>
                ${task.dueDate ? h`<span>· ${L('مهلت:', 'Due:')} ${fmtDate(task.dueDate, { time: false })}</span>` : ''}
                <span>· ${L('ایجادکننده:', 'By:')} ${esc(task.createdBy || '')}</span>
              </div>
            </div>
            ${task.description ? h`<p class="muted small mt-s">${esc(task.description)}</p>` : ''}

            <!-- یادداشت‌های پیشرفت -->
            <div class="mt pad-s rounded bg-soft" style="background: var(--surface-2); border-radius: 8px; padding: 10px 14px;">
              <strong class="tiny">${icon('file')} ${L('یادداشت‌های پیشرفت', 'Progress Notes')} (${fmtNum((task.notes || []).length)})</strong>
              ${(task.notes || []).length ? h`
                <div class="grid gap-1 mt-xs">
                  ${task.notes.map((n) => h`
                    <div class="tiny">
                      <span class="b text-accent">${esc(n.by || '')}:</span> ${esc(n.text)} <span class="muted tiny">(${timeAgo(n.at)})</span>
                    </div>`)}
                </div>` : h`<p class="muted tiny mt-xs">${L('هنوز یادداشتی برای این وظیفه ثبت نشده است.', 'No progress notes yet.')}</p>`}
              
              <form class="row mt-s" data-act="adm-task-add-note" data-id="${task.id}">
                <input class="input input-sm flex-1" name="text" placeholder="${L('افزودن یادداشت جدید...', 'Add progress note...')}" required>
                <button class="btn btn-ghost btn-sm" type="submit">${icon('send')} ${L('افزودن', 'Add')}</button>
              </form>
            </div>

            <div class="row row-between row-wrap mt-s pt-s" style="border-top: 1px solid var(--border);">
              <div class="row">
                <span class="tiny muted">${L('تغییر وضعیت:', 'Change status:')}</span>
                <select class="input input-sm" data-act="adm-task-status" data-id="${task.id}">
                  <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>${L('در انتظار', 'Pending')}</option>
                  <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>${L('در حال انجام', 'In Progress')}</option>
                  <option value="done" ${task.status === 'done' ? 'selected' : ''}>${L('تکمیل شده', 'Done')}</option>
                  <option value="cancelled" ${task.status === 'cancelled' ? 'selected' : ''}>${L('لغو شده', 'Cancelled')}</option>
                </select>
              </div>
              <button class="btn btn-ghost btn-danger btn-xs" data-act="adm-task-del" data-id="${task.id}">${icon('trash')} ${t('common.delete')}</button>
            </div>
          </div>`)}
      </div>`}`;
}

function taskPriorityBadge(priority) {
  if (priority === 'urgent') return h`<span class="badge-pill bp-danger">${L('فوری', 'Urgent')}</span>`;
  if (priority === 'important') return h`<span class="badge-pill bp-warn">${L('مهم', 'Important')}</span>`;
  return h`<span class="badge-pill bp-info">${L('عادی', 'Normal')}</span>`;
}

function taskStatusBadge(status) {
  if (status === 'done') return h`<span class="badge-pill bp-success">${L('تکمیل شده', 'Done')}</span>`;
  if (status === 'in_progress') return h`<span class="badge-pill bp-warn">${L('در حال انجام', 'In Progress')}</span>`;
  if (status === 'cancelled') return h`<span class="badge-pill bp-muted">${L('لغو شده', 'Cancelled')}</span>`;
  return h`<span class="badge-pill bp-info">${L('در انتظار', 'Pending')}</span>`;
}

// ── کنش‌های وظایف و حضور ────────────────────────────────────
act('adm-presence-refresh', () => refresh(true));

act('adm-task-new', () => {
  const f = document.getElementById('admNewTaskForm');
  if (f) { f.hidden = false; f.scrollIntoView({ behavior: 'smooth' }); }
});

act('adm-task-cancel', () => {
  const f = document.getElementById('admNewTaskForm');
  if (f) { f.hidden = true; f.reset(); }
});

act('adm-task-filter', (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  TF.status = fd.get('status') || '';
  TF.priority = fd.get('priority') || '';
  refresh(true);
});

act('adm-task-clear', () => {
  TF.status = '';
  TF.priority = '';
  refresh(true);
});

act('adm-task-create', async (e, form) => {
  e.preventDefault();
  const fd = new FormData(form);
  const payload = {
    title: fd.get('title'),
    priority: fd.get('priority'),
    assignedTo: fd.get('assignedTo') || null,
    dueDate: fd.get('dueDate') || null,
    description: fd.get('description') || '',
  };
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.post('/api/admin/tasks', payload);
      toastSuccess(L('وظیفه با موفقیت ثبت شد.', 'Task created.'));
      form.hidden = true;
      form.reset();
      refresh(true);
    } catch (err) {
      toastApiError(err);
    }
  });
});

act('adm-task-status', async (e, select) => {
  const id = select.dataset.id;
  const status = select.value;
  try {
    await api.patch(`/api/admin/tasks/${id}`, { status });
    toastSuccess(L('وضعیت وظیفه به‌روز شد.', 'Task status updated.'));
    refresh(true);
  } catch (err) {
    toastApiError(err);
  }
});

act('adm-task-add-note', async (e, form) => {
  e.preventDefault();
  const id = form.dataset.id;
  const text = form.text.value;
  if (!text.trim()) return;
  await withBusy(form.querySelector('button[type=submit]'), async () => {
    try {
      await api.post(`/api/admin/tasks/${id}/notes`, { text });
      toastSuccess(L('یادداشت اضافه شد.', 'Note added.'));
      form.reset();
      refresh(true);
    } catch (err) {
      toastApiError(err);
    }
  });
});

act('adm-task-del', async (e, el) => {
  const ok = await confirmDialog({ text: L('این وظیفه حذف شود؟', 'Delete this task?') });
  if (!ok) return;
  await withBusy(el, async () => {
    try {
      await api.del(`/api/admin/tasks/${el.dataset.id}`);
      toastSuccess(L('وظیفه حذف شد.', 'Task deleted.'));
      refresh(true);
    } catch (err) {
      toastApiError(err);
    }
  });
});

export function mount(root) {
  applyDyn(root);
  return null;
}

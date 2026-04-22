/* ============================================================
   IMEHR Mobile Mockup — v4
   Web-parity terminology + 15-tab patient detail.
   ============================================================ */

(function () {
  'use strict';

  const TODAY = new Date(2026, 3, 22);

  const PROFILES = {
    clinician: { name: 'Dr. James Wilson', roleLine: 'Clinician · Main Clinic', email: 'james@testmd.com', initials: 'JW', greeting: 'Dr. James Wilson', role: 'Clinician' },
    nurse:     { name: 'Ashley Brooks',    roleLine: 'Nurse / MA · Main Clinic', email: 'ashley@testmd.com', initials: 'AB', greeting: 'Nurse Ashley', role: 'Nurse' }
  };
  const ROLE_ICONS = { clinician: 'medkit-outline', nurse: 'heart-outline' };

  // 8 steps with EXACT web labels
  const STEPS = [
    { idx: 0, label: 'Vitals',            owner: 'nurse',     voice: true  },
    { idx: 1, label: 'History Review',    owner: 'nurse',     voice: true  },
    { idx: 2, label: 'CC & HPI',          owner: 'nurse',     voice: true  },
    { idx: 3, label: 'Clinical Note',     owner: 'clinician', voice: false },
    { idx: 4, label: 'Orders & Referrals',owner: 'clinician', voice: false },
    { idx: 5, label: 'Prescriptions',     owner: 'clinician', voice: false },
    { idx: 6, label: 'Dx & CPT Codes',    owner: 'clinician', voice: false },
    { idx: 7, label: 'Checkout',          owner: 'clinician', voice: false }
  ];

  // Stat cards per role (mirrors web)
  const STATS = {
    clinician: [
      { icon: 'calendar-outline',         cls: 'primary', num: 8,  lbl: 'Today' },
      { icon: 'clipboard-outline',        cls: 'info',    num: 3,  lbl: 'Pending Orders' },
      { icon: 'person-remove-outline',    cls: 'warn',    num: 1,  lbl: 'No Show' },
      { icon: 'alert-circle-outline',     cls: 'danger',  num: 0,  lbl: 'Missed' }
    ],
    nurse: [
      { icon: 'calendar-outline',         cls: 'primary', num: 8,  lbl: 'Today' },
      { icon: 'clipboard-outline',        cls: 'info',    num: 3,  lbl: 'Pending Orders' },
      { icon: 'hourglass-outline',        cls: 'warn',    num: 4,  lbl: 'Triage' }
    ]
  };

  // Appointments (status matches web enum)
  const appointments = [
    { time: '09:00', mer: 'AM', name: 'John Carter',     initials: 'JC', type: 'Annual Physical',   reason: 'Annual physical',        room: 'Room 1', status: 'completed' },
    { time: '09:30', mer: 'AM', name: 'Priya Patel',     initials: 'PP', type: 'Follow-Up',         reason: 'Diabetes follow-up',     room: 'Room 2', status: 'checked-in' },
    { time: '10:00', mer: 'AM', name: 'Emma Martinez',   initials: 'EM', type: 'Follow-Up',         reason: 'Hypertension follow-up', room: 'Room 3', status: 'in-progress' },
    { time: '10:30', mer: 'AM', name: 'Liam Chen',       initials: 'LC', type: 'New Patient',       reason: 'New patient · HTN',      room: 'Room 1', status: 'scheduled' },
    { time: '11:00', mer: 'AM', name: 'Ava Robinson',    initials: 'AR', type: 'Consultation',      reason: 'Back pain',              room: 'Room 2', status: 'scheduled' },
    { time: '01:30', mer: 'PM', name: 'Noah Williams',   initials: 'NW', type: 'Med Review',        reason: 'Medication review',      room: 'Room 3', status: 'scheduled' },
    { time: '02:00', mer: 'PM', name: 'Sophia Ahmed',    initials: 'SA', type: 'Follow-Up',         reason: 'Follow-up · asthma',     room: 'Room 1', status: 'scheduled' },
    { time: '03:00', mer: 'PM', name: 'Isabella Nguyen', initials: 'IN', type: 'Procedure',         reason: 'Pre-op evaluation',      room: 'Room 2', status: 'scheduled' }
  ];

  // Patient list with web PatientStatus: Active/Inactive/Discharged
  const patients = [
    { initials: 'AR', name: 'Ava Robinson',     sex: 'F', age: 42, mrn: '100221', status: 'Active',     lastVisit: 'Apr 5, 2026',  primaryIns: 'Aetna' },
    { initials: 'EM', name: 'Emma Martinez',    sex: 'F', age: 34, mrn: '102384', status: 'Active',     lastVisit: 'Today',         primaryIns: 'Blue Cross' },
    { initials: 'IN', name: 'Isabella Nguyen',  sex: 'F', age: 58, mrn: '110945', status: 'Active',     lastVisit: 'Mar 14, 2026', primaryIns: 'Medicare' },
    { initials: 'JC', name: 'John Carter',      sex: 'M', age: 67, mrn: '098112', status: 'Active',     lastVisit: 'Today',         primaryIns: 'Medicare' },
    { initials: 'LC', name: 'Liam Chen',        sex: 'M', age: 29, mrn: '114277', status: 'Active',     lastVisit: '—',             primaryIns: 'United' },
    { initials: 'NW', name: 'Noah Williams',    sex: 'M', age: 51, mrn: '104519', status: 'Inactive',   lastVisit: 'Jan 8, 2025',  primaryIns: 'Cigna' },
    { initials: 'PP', name: 'Priya Patel',      sex: 'F', age: 46, mrn: '099874', status: 'Active',     lastVisit: 'Today',         primaryIns: 'Aetna' },
    { initials: 'SA', name: 'Sophia Ahmed',     sex: 'F', age: 38, mrn: '107223', status: 'Discharged', lastVisit: 'Oct 3, 2025',  primaryIns: '—' }
  ];

  // 15 tabs per web patient-detail chart (with icons)
  const PATIENT_TABS = [
    { key: 'overview',      label: 'Overview',      icon: 'person-circle-outline' },
    { key: 'problems',      label: 'Problems',      icon: 'list-outline' },
    { key: 'medications',   label: 'Medications',   icon: 'medkit-outline' },
    { key: 'allergies',     label: 'Allergies',     icon: 'warning-outline' },
    { key: 'vitals',        label: 'Vitals',        icon: 'pulse-outline' },
    { key: 'immunizations', label: 'Immunizations', icon: 'shield-checkmark-outline' },
    { key: 'history',       label: 'History',       icon: 'people-outline' },
    { key: 'insurance',     label: 'Insurance',     icon: 'card-outline' },
    { key: 'encounters',    label: 'Encounters',    icon: 'briefcase-outline' },
    { key: 'prescriptions', label: 'Prescriptions', icon: 'bandage-outline' },
    { key: 'orders',        label: 'Orders',        icon: 'clipboard-outline' },
    { key: 'attachments',   label: 'Attachments',   icon: 'attach-outline' },
    { key: 'consent',       label: 'Consent',       icon: 'document-lock-outline' },
    { key: 'appt-notes',    label: 'Appt / Notes',  icon: 'calendar-number-outline' },
    { key: 'finance',       label: 'Finance',       icon: 'wallet-outline' }
  ];

  // ---------- State ----------
  const state = {
    currentScreen: 'login',
    currentTab: 'schedule',
    role: 'clinician',
    encounterStep: 3,
    encounterStepsDone: [false, false, false, false, false, false, false, false],
    voiceRecording: false,
    voicePanelOpen: false,
    currentAppt: null,
    patientTab: 'overview',
    patientSubTab: 'visits',
    history: []  // for back nav
  };

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const TAB_SCREENS = ['schedule', 'patients', 'more'];

  // ---------- Navigation ----------
  function showScreen(id, pushHistory = true) {
    if (pushHistory && state.currentScreen && state.currentScreen !== id) {
      state.history.push(state.currentScreen);
      if (state.history.length > 20) state.history.shift();
    }
    $$('.screen').forEach(s => s.hidden = true);
    const target = $(`.screen[data-screen="${id}"]`);
    if (!target) { console.warn('missing', id); return; }
    target.hidden = false;
    target.scrollTop = 0;
    state.currentScreen = id;

    const isTab = TAB_SCREENS.includes(id);
    $('#tabbar').hidden = !isTab;
    if (isTab) { state.currentTab = id; updateActiveTab(id); }
  }
  function updateActiveTab(id) { $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === id)); }

  // ---------- Role ----------
  function applyRole(role) {
    state.role = role;
    const prof = PROFILES[role];
    const isN = role === 'nurse';

    $('#greeting-name').textContent = prof.greeting;
    const badge = $('#role-badge');
    $('#role-badge-label').textContent = prof.role;
    badge.classList.remove('nurse');
    if (isN) badge.classList.add('nurse');
    badge.querySelector('ion-icon').setAttribute('name', ROLE_ICONS[role]);

    $('#login-role-sub').textContent = prof.role.toUpperCase();
    $('#login-email').value = prof.email;
    $('#otp-email').textContent = prof.email;

    $('#profile-initials').textContent = prof.initials;
    $('#profile-name').textContent = prof.name;
    $('#profile-role-line').textContent = prof.roleLine;
    $('#profile-email').textContent = prof.email;

    const encBadge = $('#enc-role-badge');
    encBadge.classList.remove('nurse');
    if (isN) encBadge.classList.add('nurse');
    encBadge.innerHTML = `<ion-icon name="${ROLE_ICONS[role]}"></ion-icon>${prof.role}`;

    $$('#role-seg button, #role-seg-aside button, .role-demo-picker button').forEach(b => {
      const k = b.dataset.role || b.dataset.demoRole;
      b.classList.toggle('active', k === role);
    });

    state.encounterStep = isN ? 0 : 3;

    renderStats();
    renderAppointments();
    renderSteps();
    applyAppointmentActions();

    // Active Visit banner
    const inProg = appointments.find(a => a.status === 'in-progress');
    const rb = $('#resume-banner');
    if (inProg) { rb.hidden = false; $('#rb-patient').textContent = inProg.name; }
    else rb.hidden = true;
  }

  function renderStats() {
    const host = $('#stats-row');
    if (!host) return;
    const cards = STATS[state.role];
    host.classList.toggle('c3', cards.length === 3);
    host.innerHTML = '';
    cards.forEach(c => {
      const card = document.createElement('div');
      card.className = `stat-card ${c.cls}`;
      card.innerHTML = `
        <div class="sc-ico"><ion-icon name="${c.icon}"></ion-icon></div>
        <span class="sc-num">${c.num}</span>
        <span class="sc-lbl">${c.lbl}</span>`;
      host.appendChild(card);
    });
  }

  // ---------- Schedule ----------
  function renderDateStrip() {
    const strip = $('#date-strip');
    if (!strip) return;
    strip.innerHTML = '';
    const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    for (let i = -2; i <= 4; i++) {
      const d = new Date(TODAY);
      d.setDate(d.getDate() + i);
      const chip = document.createElement('div');
      chip.className = 'date-chip' + (i === 0 ? ' active today' : '');
      chip.innerHTML = `<div class="d-day">${days[d.getDay()]}</div><div class="d-num">${d.getDate()}</div>`;
      strip.appendChild(chip);
    }
    strip.onclick = (e) => {
      const chip = e.target.closest('.date-chip');
      if (!chip) return;
      $$('.date-chip', strip).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    };
  }

  function statusMeta(s) {
    // Web palette: Scheduled=primary, Checked In=info, In Progress=warning, Completed=success, No Show/Missed=danger, Cancelled=secondary
    switch (s) {
      case 'completed':   return { label: 'Completed',   cls: 'chip-success' };
      case 'checked-in':  return { label: 'Checked In',  cls: 'chip-info' };
      case 'in-progress': return { label: 'In Progress', cls: 'chip-warning' };
      case 'no-show':     return { label: 'No Show',     cls: 'chip-danger' };
      case 'cancelled':   return { label: 'Cancelled',   cls: 'chip-neutral' };
      case 'confirmed':   return { label: 'Confirmed',   cls: 'chip-info' };
      default:            return { label: 'Scheduled',   cls: 'chip-primary' };
    }
  }

  function renderAppointments() {
    const list = $('#appt-list');
    if (!list) return;
    list.innerHTML = '';
    appointments.forEach(a => {
      const s = statusMeta(a.status);
      const card = document.createElement('div');
      card.className = 'appt-card';
      card.onclick = () => { state.currentAppt = a; App.go('appt-detail'); };

      let action = '';
      if (a.status === 'scheduled' || a.status === 'confirmed') {
        action = `<button class="appt-action primary" onclick="event.stopPropagation(); App.quickCheckIn('${a.name}')">
                    <ion-icon name="log-in-outline"></ion-icon> Check In
                  </button>`;
      } else if (a.status === 'checked-in') {
        action = `<button class="appt-action warn" onclick="event.stopPropagation(); App.quickStart('${a.name}')">
                    <ion-icon name="play-circle-outline"></ion-icon> Start
                  </button>`;
      } else if (a.status === 'in-progress') {
        action = `<button class="appt-action success" onclick="event.stopPropagation(); App.quickResume('${a.name}')">
                    <ion-icon name="play-forward-outline"></ion-icon> Resume
                  </button>`;
      } else if (a.status === 'completed') {
        action = `<button class="appt-action ghost" onclick="event.stopPropagation(); App.openSignedNote()">
                    <ion-icon name="document-text-outline"></ion-icon> View
                  </button>`;
      }

      card.innerHTML = `
        <div class="appt-time"><span class="t-hr">${a.time}</span><span class="t-mer">${a.mer}</span></div>
        <div class="appt-body">
          <p class="a-name">${a.name}</p>
          <p class="a-reason">${a.type} · ${a.reason}</p>
          <p class="a-room">${a.room}</p>
        </div>
        <div class="appt-right">
          <span class="chip sm ${s.cls}">${s.label}</span>
          ${action}
        </div>`;
      list.appendChild(card);
    });
  }

  function applyAppointmentActions() {
    const host = $('#appt-actions');
    if (!host) return;
    const a = state.currentAppt || appointments.find(x => x.status === 'in-progress') || appointments[3];
    const statusChip = $('#appt-status-chip');
    const s = statusMeta(a.status);
    statusChip.textContent = s.label;
    statusChip.className = 'chip sm ' + s.cls;

    const prog = $('#appt-enc-progress');
    const dots = $('#appt-progress-dots');
    if (a.status === 'in-progress') {
      prog.hidden = false;
      const active = state.role === 'nurse' ? 1 : 4;
      dots.innerHTML = STEPS.map((st, i) => {
        let cls = 'enc-pdot';
        if (i < active) cls += ' done';
        else if (i === active) cls += ' active';
        return `<div class="${cls}"></div>`;
      }).join('');
    } else prog.hidden = true;

    host.innerHTML = '';
    const mk = (cls, html, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls + ' btn-block'; b.innerHTML = html; b.onclick = fn; host.appendChild(b); };
    switch (a.status) {
      case 'scheduled':
      case 'confirmed':
        mk('btn-primary', '<ion-icon name="log-in-outline"></ion-icon> Check In', () => App.showCheckIn());
        break;
      case 'checked-in':
        mk('btn-primary', '<ion-icon name="play-circle-outline"></ion-icon> Start Visit', () => App.startVisit());
        break;
      case 'in-progress':
        mk('btn-primary', '<ion-icon name="play-forward-outline"></ion-icon> Resume Visit', () => App.openEncounter());
        mk('btn-ghost', '<ion-icon name="videocam-outline"></ion-icon> Telehealth link', () => App.toast('Telehealth link copied'));
        break;
      case 'completed':
        mk('btn-secondary', '<ion-icon name="document-text-outline"></ion-icon> View signed note', () => App.openSignedNote());
        break;
    }
  }

  // ---------- Patients list ----------
  function renderPatients() {
    const list = $('#patient-list');
    if (!list) return;
    list.innerHTML = '';
    patients.forEach(p => {
      const row = document.createElement('div');
      row.className = 'patient-list-item';
      row.onclick = () => App.go('patient-detail');
      const stCls = p.status === 'Active' ? 'chip-success' : p.status === 'Inactive' ? 'chip-warning' : 'chip-neutral';
      row.innerHTML = `
        <div class="avatar">${p.initials}</div>
        <div class="pli-body">
          <p class="pli-name">${p.name}</p>
          <p class="pli-meta">MRN ${p.mrn} · ${p.sex} · ${p.age} yrs · Last: ${p.lastVisit}</p>
        </div>
        <span class="chip sm ${stCls}">${p.status}</span>`;
      list.appendChild(row);
    });
  }

  // ---------- Encounter wizard ----------
  function renderSteps() {
    const stepper = $('#stepper');
    if (!stepper) return;
    stepper.innerHTML = '';
    STEPS.forEach((st, i) => {
      const isNurse = state.role === 'nurse';
      const locked = isNurse && st.owner === 'clinician';
      const done = state.encounterStepsDone[i];
      const active = i === state.encounterStep;
      const chip = document.createElement('div');
      chip.className = 'step-chip' + (active ? ' active' : '') + (done ? ' done' : '') + (locked ? ' locked' : '');
      chip.innerHTML = `
        <div class="sc-num">${locked ? '<ion-icon name="lock-closed" style="font-size:12px;"></ion-icon>' : (done && !active ? '✓' : (i + 1))}</div>
        <div class="sc-lbl">${st.label}</div>`;
      chip.onclick = () => {
        if (locked) { App.toast('This step is for clinicians'); return; }
        App.goStep(i);
      };
      stepper.appendChild(chip);
    });
  }

  function showStep(n) {
    state.encounterStep = n;
    $$('.step-pane').forEach(p => p.hidden = parseInt(p.dataset.step, 10) !== n);
    renderSteps();

    const vbar = $('#voice-bar');
    const showVoice = STEPS[n].voice;
    vbar.hidden = !showVoice;
    if (!showVoice) $('#voice-panel').hidden = true;

    $('#step-prev').disabled = n === 0;
    const next = $('#step-next');
    if (n === 7) {
      next.innerHTML = '<ion-icon name="create-outline"></ion-icon> Sign & Close';
      next.onclick = () => App.openSheet('sig-sheet');
    } else {
      next.innerHTML = 'Next <ion-icon name="arrow-forward-outline"></ion-icon>';
      next.onclick = () => App.stepNext();
    }

    for (let i = 0; i < n; i++) state.encounterStepsDone[i] = true;
    renderSteps();
    const panes = $('#step-panes');
    if (panes) panes.scrollTop = 0;
  }

  function recalcBMI() {
    const w = parseFloat($('#vital-weight').value);
    const h = parseFloat($('#vital-height').value);
    if (!w || !h) return;
    $('#vital-bmi').value = ((w / (h * h)) * 703).toFixed(1);
  }

  // ---------- Patient detail (15 tabs) ----------
  function renderPatientDetail() {
    const strip = $('#pd-tabstrip');
    strip.innerHTML = '';
    PATIENT_TABS.forEach(t => {
      const b = document.createElement('button');
      b.className = 'pd-tab' + (state.patientTab === t.key ? ' active' : '');
      b.innerHTML = `<ion-icon name="${t.icon}"></ion-icon>${t.label}`;
      b.onclick = () => { state.patientTab = t.key; renderPatientDetail(); };
      strip.appendChild(b);
      if (state.patientTab === t.key) setTimeout(() => b.scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'}), 10);
    });
    $('#pd-content').innerHTML = patientTabContent(state.patientTab);
    wirePatientTabEvents();
  }

  function patientTabContent(tab) {
    switch (tab) {
      case 'overview': return `
        <div class="pd-pane">
          <p class="pd-sec-title">Basic information</p>
          <div class="kv-grid">
            <div class="kv-card"><span>DOB</span><strong>Jun 14, 1991</strong></div>
            <div class="kv-card"><span>Age</span><strong>34</strong></div>
            <div class="kv-card"><span>Gender</span><strong>Female</strong></div>
            <div class="kv-card"><span>Phone</span><strong>(555) 201-8844</strong></div>
            <div class="kv-card"><span>Email</span><strong>emma.m@example.com</strong></div>
            <div class="kv-card"><span>MRN</span><strong>102384</strong></div>
          </div>
          <p class="pd-sec-title">Address</p>
          <div class="kv-grid">
            <div class="kv-card"><span>Street</span><strong>214 Oak Ave</strong></div>
            <div class="kv-card"><span>City</span><strong>Austin</strong></div>
            <div class="kv-card"><span>State</span><strong>TX</strong></div>
            <div class="kv-card"><span>ZIP</span><strong>78701</strong></div>
          </div>
          <p class="pd-sec-title">Emergency contact</p>
          <div class="kv-grid">
            <div class="kv-card"><span>Name</span><strong>Carlos Martinez</strong></div>
            <div class="kv-card"><span>Relationship</span><strong>Spouse</strong></div>
            <div class="kv-card"><span>Phone</span><strong>(555) 201-8845</strong></div>
            <div class="kv-card"><span>Alternate</span><strong>—</strong></div>
          </div>
        </div>`;

      case 'problems': return `
        <div class="pd-pane">
          <div class="section-head"><h3 class="section-title sm">Problem List (2)</h3><button class="chip-btn"><ion-icon name="add"></ion-icon> Add Problem</button></div>
          <p class="pd-sec-title">Active</p>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Essential hypertension</strong></p><p class="muted">I10 · Onset 2023</p></div><span class="chip sm chip-success">Active</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Hyperlipidemia</strong></p><p class="muted">E78.5 · Onset 2023</p></div><span class="chip sm chip-success">Active</span></div>
          </div>
          <p class="pd-sec-title">Resolved</p>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Acute bronchitis</strong></p><p class="muted">J20.9 · Resolved Feb 2024</p></div><span class="chip sm chip-neutral">Resolved</span></div>
          </div>
        </div>`;

      case 'medications': return `
        <div class="pd-pane">
          <div class="section-head"><h3 class="section-title sm">Medications (2)</h3><button class="chip-btn"><ion-icon name="add"></ion-icon> Add Medication</button></div>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Lisinopril 10 mg</strong></p><p class="muted">1 tab PO daily · Since 2024-01</p></div><span class="chip sm chip-success">Active</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Atorvastatin 20 mg</strong></p><p class="muted">1 tab PO QHS · Since 2023-08</p></div><span class="chip sm chip-success">Active</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Amoxicillin 500 mg</strong></p><p class="muted">Course completed Feb 2024</p></div><span class="chip sm chip-danger">Discontinued</span></div>
          </div>
        </div>`;

      case 'allergies': return `
        <div class="pd-pane">
          <div class="section-head"><h3 class="section-title sm">Allergies (2)</h3><button class="chip-btn"><ion-icon name="add"></ion-icon> Add Allergy</button></div>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Penicillin</strong></p><p class="muted">Severe · Rash, swelling</p></div><span class="chip sm chip-danger">Active</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Shellfish</strong></p><p class="muted">Mild · GI upset</p></div><span class="chip sm chip-warning">Active</span></div>
          </div>
        </div>`;

      case 'vitals': return `
        <div class="pd-pane">
          <div class="section-head"><h3 class="section-title sm">Latest Vitals — Today 9:40 AM</h3><button class="chip-btn"><ion-icon name="add"></ion-icon> Record</button></div>
          <div class="vd-card">
            <div class="vd-grid">
              <div><span>BP</span><strong>128/82</strong></div>
              <div><span>HR</span><strong>76</strong></div>
              <div><span>Temp</span><strong>98.4°F</strong></div>
              <div><span>SpO₂</span><strong>98%</strong></div>
              <div><span>Wt</span><strong>142 lb</strong></div>
              <div><span>BMI</span><strong>23.6</strong></div>
            </div>
          </div>
          <p class="pd-sec-title">History</p>
          <div class="vd-card">
            <div class="vh-row"><span class="vh-date">Mar 8, 2026</span><span>BP 134/86 · HR 78 · BMI 23.4</span></div>
            <div class="vh-row"><span class="vh-date">Jan 22, 2026</span><span>BP 138/88 · HR 80 · BMI 23.8</span></div>
            <div class="vh-row"><span class="vh-date">Oct 12, 2025</span><span>BP 142/90 · HR 82 · BMI 24.1</span></div>
          </div>
        </div>`;

      case 'immunizations': return `
        <div class="pd-pane">
          <div class="section-head"><h3 class="section-title sm">Immunizations</h3><button class="chip-btn"><ion-icon name="add"></ion-icon> Add</button></div>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Influenza</strong></p><p class="muted">Oct 2025</p></div><span class="chip sm chip-success">Completed</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>COVID-19 booster</strong></p><p class="muted">Sep 2025</p></div><span class="chip sm chip-success">Completed</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Tdap</strong></p><p class="muted">2022</p></div><span class="chip sm chip-success">Completed</span></div>
          </div>
        </div>`;

      case 'history': return `
        <div class="pd-pane">
          <p class="pd-sec-title">Family history</p>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Mother</strong></p><p class="muted">HTN, Type 2 DM</p></div></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Father</strong></p><p class="muted">MI (age 62)</p></div></div>
          </div>
          <p class="pd-sec-title">Social history</p>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Tobacco</strong></p><p class="muted">Never</p></div></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Alcohol</strong></p><p class="muted">Occasional, 2-3/week</p></div></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Exercise</strong></p><p class="muted">Walking 30 min, 3x/week</p></div></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Occupation</strong></p><p class="muted">Graphic designer</p></div></div>
          </div>
        </div>`;

      case 'insurance': return `
        <div class="pd-pane">
          <div class="ins-card">
            <h3>Primary Insurance <span class="chip sm chip-success">Active</span></h3>
            <div class="ins-grid">
              <div><span>Payer</span><strong>Blue Cross</strong></div>
              <div><span>Plan</span><strong>PPO Silver</strong></div>
              <div><span>Member ID</span><strong>BC44219083</strong></div>
              <div><span>Group</span><strong>GRP0221</strong></div>
              <div><span>Subscriber</span><strong>Self</strong></div>
              <div><span>Effective</span><strong>Jan 2024 –</strong></div>
              <div><span>Copay</span><strong>$25</strong></div>
              <div><span>Deductible</span><strong>$1,500</strong></div>
            </div>
            <div class="chip-row" style="margin-top:10px;">
              <span class="chip chip-success"><ion-icon name="shield-checkmark"></ion-icon> Eligibility verified</span>
            </div>
          </div>
          <div class="ins-card">
            <h3>Secondary Insurance <span class="muted small">None</span></h3>
          </div>
        </div>`;

      case 'encounters': return `
        <div class="pd-pane">
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Today 10:00 AM</strong> · Follow-Up</p><p class="muted">Dr. Wilson · Hypertension</p></div><span class="chip sm chip-warning">In Progress</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Mar 8, 2026</strong> · Follow-Up</p><p class="muted">Dr. Wilson · Hypertension</p></div><span class="chip sm chip-success">Completed</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Jan 22, 2026</strong> · Progress</p><p class="muted">Dr. Wilson · Initial</p></div><span class="chip sm chip-success">Completed</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Oct 12, 2025</strong> · Annual Physical</p><p class="muted">Dr. Wilson</p></div><span class="chip sm chip-success">Completed</span></div>
          </div>
        </div>`;

      case 'prescriptions': return `
        <div class="pd-pane">
          <div class="section-head"><h3 class="section-title sm">Prescriptions</h3><button class="chip-btn"><ion-icon name="add"></ion-icon> New Rx</button></div>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Lisinopril 10 mg</strong></p><p class="muted">1 tab PO daily · #30 · 3 refills · Dr. Wilson</p></div><span class="chip sm chip-success">Active</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Atorvastatin 20 mg</strong></p><p class="muted">1 tab PO QHS · #30 · 3 refills · Dr. Wilson</p></div><span class="chip sm chip-success">Active</span></div>
          </div>
        </div>`;

      case 'orders': return `
        <div class="pd-pane">
          <div class="section-head"><h3 class="section-title sm">Orders</h3><button class="chip-btn"><ion-icon name="add"></ion-icon> Add order</button></div>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>Basic metabolic panel</strong></p><p class="muted">Lab · Today · Dr. Wilson</p></div><span class="chip sm chip-info">Ordered</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Lipid panel</strong></p><p class="muted">Lab · Today · Fasting</p></div><span class="chip sm chip-info">Ordered</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>ECG</strong></p><p class="muted">Jan 22, 2026</p></div><span class="chip sm chip-success">Completed</span></div>
          </div>
        </div>`;

      case 'attachments': return `
        <div class="pd-pane">
          <div class="section-head"><h3 class="section-title sm">Attachments</h3><button class="chip-btn"><ion-icon name="cloud-upload-outline"></ion-icon> Upload</button></div>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>ID Card (front)</strong></p><p class="muted">JPG · 2.1 MB · Jan 2024</p></div><ion-icon name="download-outline" class="muted"></ion-icon></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Insurance card</strong></p><p class="muted">PDF · 430 KB · Jan 2024</p></div><ion-icon name="download-outline" class="muted"></ion-icon></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Outside labs — Aug 2023</strong></p><p class="muted">PDF · 1.8 MB</p></div><ion-icon name="download-outline" class="muted"></ion-icon></div>
          </div>
        </div>`;

      case 'consent': return `
        <div class="pd-pane">
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>HIPAA Notice of Privacy Practices</strong></p><p class="muted">Signed Jan 14, 2024</p></div><span class="chip sm chip-success">Signed</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>General consent for treatment</strong></p><p class="muted">Signed Jan 14, 2024</p></div><span class="chip sm chip-success">Signed</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>Telehealth consent</strong></p><p class="muted">Expired Dec 2025</p></div><span class="chip sm chip-warning">Expired</span></div>
          </div>
        </div>`;

      case 'appt-notes': return `
        <div class="pd-pane">
          <div class="subseg" id="pd-subseg">
            <button data-sub="visits" class="${state.patientSubTab==='visits'?'active':''}">Visits <span class="count-badge">4</span></button>
            <button data-sub="upcoming" class="${state.patientSubTab==='upcoming'?'active':''}">Upcoming <span class="count-badge">2</span></button>
            <button data-sub="notes" class="${state.patientSubTab==='notes'?'active':''}">Clinical Notes <span class="count-badge">5</span></button>
          </div>
          <div id="pd-subcontent">${subTabContent(state.patientSubTab)}</div>
        </div>`;

      case 'finance': return `
        <div class="pd-pane">
          <div class="summary-card">
            <h3>Balance</h3>
            <div class="sum-row"><span>Total billed</span><strong>$1,240.00</strong></div>
            <div class="sum-row"><span>Total paid</span><strong>$985.50</strong></div>
            <div class="sum-row" style="color:var(--danger);"><span>Outstanding</span><strong>$254.50</strong></div>
          </div>
          <div class="section-head"><h3 class="section-title sm">Payment history</h3></div>
          <div class="cl-list">
            <div class="cl-row"><div class="cl-main"><p><strong>$125.00</strong></p><p class="muted">Mar 8, 2026 · Visa ···4219</p></div><span class="chip sm chip-success">Paid</span></div>
            <div class="cl-row"><div class="cl-main"><p><strong>$85.50</strong></p><p class="muted">Jan 22, 2026 · HSA</p></div><span class="chip sm chip-success">Paid</span></div>
          </div>
        </div>`;
    }
    return `<div class="pd-empty"><ion-icon name="folder-open-outline"></ion-icon><p>No ${tab} data</p></div>`;
  }

  function subTabContent(sub) {
    if (sub === 'visits') return `
      <div class="visit-card">
        <div>
          <p class="vc-type">Follow-Up · Today 10:00 AM</p>
          <p class="vc-meta">Dr. Wilson · Main Clinic · Room 3</p>
          <span class="vc-doc warn"><ion-icon name="alert-circle-outline"></ion-icon> Needs Signature</span>
        </div>
        <span class="chip sm chip-warning">In Progress</span>
        <div class="vc-actions"><button>View Appt</button><button class="primary" onclick="App.openSignedNote()">View Note</button></div>
      </div>
      <div class="visit-card">
        <div>
          <p class="vc-type">Follow-Up · Mar 8, 2026 · 9:30 AM</p>
          <p class="vc-meta">Dr. Wilson · Main Clinic</p>
          <span class="vc-doc ok"><ion-icon name="checkmark-circle"></ion-icon> Complete</span>
        </div>
        <span class="chip sm chip-success">Completed</span>
        <div class="vc-actions"><button>View Appt</button><button class="primary" onclick="App.openSignedNote()">View Note</button></div>
      </div>
      <div class="visit-card">
        <div>
          <p class="vc-type">Progress Note · Jan 22, 2026</p>
          <p class="vc-meta">Dr. Wilson · Main Clinic</p>
          <span class="vc-doc ok"><ion-icon name="checkmark-circle"></ion-icon> Complete</span>
        </div>
        <span class="chip sm chip-success">Completed</span>
        <div class="vc-actions"><button>View Appt</button><button class="primary" onclick="App.openSignedNote()">View Note</button></div>
      </div>
      <div class="visit-card">
        <div>
          <p class="vc-type">Annual Physical · Oct 12, 2025</p>
          <p class="vc-meta">Dr. Wilson · Main Clinic</p>
          <span class="vc-doc ok"><ion-icon name="checkmark-circle"></ion-icon> Complete</span>
        </div>
        <span class="chip sm chip-success">Completed</span>
        <div class="vc-actions"><button>View Appt</button><button class="primary" onclick="App.openSignedNote()">View Note</button></div>
      </div>`;

    if (sub === 'upcoming') return `
      <div class="up-card">
        <div class="up-body"><p><strong>Follow-Up · Jul 22, 2026</strong></p><p class="muted">Dr. Wilson · 10:00 AM · Main Clinic</p></div>
        <span class="up-when">In 91 days</span>
      </div>
      <div class="up-card">
        <div class="up-body"><p><strong>Lab Review · Oct 10, 2026</strong></p><p class="muted">Dr. Wilson · Telehealth</p></div>
        <span class="up-when">In 171 days</span>
      </div>`;

    if (sub === 'notes') return `
      <div class="cn-card" onclick="App.openSignedNote()">
        <div class="cn-top">
          <p class="cn-type"><ion-icon name="document-text-outline"></ion-icon>SOAP Note</p>
          <span class="chip sm chip-warning">Draft</span>
        </div>
        <p class="cn-meta">Today · Dr. Wilson · Follow-Up</p>
        <div class="cn-foot"><span class="muted small">Not signed yet</span><button class="txt-btn">View</button></div>
      </div>
      <div class="cn-card" onclick="App.openSignedNote()">
        <div class="cn-top">
          <p class="cn-type"><ion-icon name="document-text-outline"></ion-icon>SOAP Note</p>
          <span class="chip sm chip-success">Signed</span>
        </div>
        <p class="cn-meta">Mar 8, 2026 · Dr. Wilson · Follow-Up</p>
        <div class="cn-foot"><span class="cn-sig"><ion-icon name="checkmark-circle"></ion-icon> Signed Mar 8, 10:45 AM</span><button class="txt-btn">View</button></div>
      </div>
      <div class="cn-card" onclick="App.openSignedNote()">
        <div class="cn-top">
          <p class="cn-type"><ion-icon name="document-text-outline"></ion-icon>Progress Note</p>
          <span class="chip sm chip-success">Signed</span>
        </div>
        <p class="cn-meta">Jan 22, 2026 · Dr. Wilson · Initial</p>
        <div class="cn-foot"><span class="cn-sig"><ion-icon name="checkmark-circle"></ion-icon> Signed Jan 22, 9:58 AM</span><button class="txt-btn">View</button></div>
      </div>
      <div class="cn-card" onclick="App.openSignedNote()">
        <div class="cn-top">
          <p class="cn-type"><ion-icon name="document-text-outline"></ion-icon>H&amp;P</p>
          <span class="chip sm chip-success">Signed</span>
        </div>
        <p class="cn-meta">Jan 14, 2024 · Dr. Wilson · New Patient</p>
        <div class="cn-foot"><span class="cn-sig"><ion-icon name="checkmark-circle"></ion-icon> Signed Jan 14, 2:18 PM</span><button class="txt-btn">View</button></div>
      </div>
      <div class="cn-card" onclick="App.openSignedNote()">
        <div class="cn-top">
          <p class="cn-type"><ion-icon name="document-text-outline"></ion-icon>Lab Review Note</p>
          <span class="chip sm chip-success">Signed</span>
        </div>
        <p class="cn-meta">Nov 5, 2024 · Dr. Wilson</p>
        <div class="cn-foot"><span class="cn-sig"><ion-icon name="checkmark-circle"></ion-icon> Signed Nov 5</span><button class="txt-btn">View</button></div>
      </div>`;
    return '';
  }

  function wirePatientTabEvents() {
    const subseg = $('#pd-subseg');
    if (subseg) {
      $$('#pd-subseg button').forEach(b => b.onclick = () => {
        state.patientSubTab = b.dataset.sub;
        $('#pd-subcontent').innerHTML = subTabContent(state.patientSubTab);
        $$('#pd-subseg button').forEach(x => x.classList.toggle('active', x === b));
      });
    }
  }

  // ---------- OTP setup ----------
  function setupOtp() {
    const inp = $('.otp-single input');
    if (!inp) return;
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/[^0-9]/g,'').substring(0,6); });
  }

  // ---------- Signature ----------
  let sigCtx, sigDrawing = false;
  function setupSignature() {
    const c = $('#sig-canvas');
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    sigCtx = c.getContext('2d');
    sigCtx.scale(ratio, ratio);
    sigCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
    sigCtx.lineWidth = 2.2;
    sigCtx.lineCap = 'round';
    sigCtx.lineJoin = 'round';
    const getPos = (e) => {
      const r = c.getBoundingClientRect();
      const pt = e.touches ? e.touches[0] : e;
      return { x: pt.clientX - r.left, y: pt.clientY - r.top };
    };
    const start = (e) => { e.preventDefault(); sigDrawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
    const move  = (e) => { if (!sigDrawing) return; e.preventDefault(); const p = getPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); };
    const end   = () => { sigDrawing = false; };
    c.onmousedown = start; c.onmousemove = move; c.onmouseup = end; c.onmouseleave = end;
    c.ontouchstart = start; c.ontouchmove = move; c.ontouchend = end;
  }

  // ---------- Public API ----------
  const App = {
    go(id) { showScreen(id); },
    goTab(id) { showScreen(id); },
    goBack() {
      const prev = state.history.pop();
      if (prev) showScreen(prev, false);
      else showScreen('schedule', false);
    },

    submitLogin() { App.go('otp'); },

    pickDemoRole(role) {
      applyRole(role);
      $$('.role-demo-picker button').forEach(b => b.classList.toggle('active', b.dataset.demoRole === role));
    },

    togglePw(id, btn) {
      const inp = document.getElementById(id);
      const ico = btn.querySelector('ion-icon');
      if (inp.type === 'password') { inp.type = 'text'; ico.setAttribute('name', 'eye-off-outline'); }
      else { inp.type = 'password'; ico.setAttribute('name', 'eye-outline'); }
    },

    toast(msg) {
      const t = $('#toast');
      t.textContent = msg; t.hidden = false;
      clearTimeout(t._tt);
      t._tt = setTimeout(() => { t.hidden = true; }, 1800);
    },

    openSheet(id) {
      $(`#${id}`).hidden = false;
      if (id === 'sig-sheet') setTimeout(setupSignature, 50);
    },
    closeSheet(id) { $(`#${id}`).hidden = true; },
    clearSig() { if (sigCtx) sigCtx.clearRect(0, 0, $('#sig-canvas').width, $('#sig-canvas').height); },
    submitSig() {
      App.closeSheet('sig-sheet');
      App.toast('Encounter signed & closed');
      setTimeout(() => {
        const a = appointments.find(x => x.name === 'Emma Martinez');
        if (a) a.status = 'completed';
        App.go('schedule', false);
        renderAppointments();
      }, 400);
    },

    showCheckIn() { $('#checkin-overlay').hidden = false; },
    hideCheckIn() {
      $('#checkin-overlay').hidden = true;
      const a = state.currentAppt;
      if (a) a.status = 'checked-in';
      renderAppointments();
      applyAppointmentActions();
    },
    startVisit() {
      const a = state.currentAppt;
      if (a) a.status = 'in-progress';
      renderAppointments();
      applyAppointmentActions();
      App.openEncounter();
    },

    openEncounter(forceStep) {
      showScreen('encounter');
      showStep(forceStep != null ? forceStep : (state.role === 'nurse' ? 0 : 3));
    },
    exitEncounter() { App.toast('Saved · continue later'); App.go('schedule', false); },
    resumeEncounter() { App.openEncounter(); },

    goStep(n) { showStep(n); },
    stepNext() { if (state.encounterStep < 7) showStep(state.encounterStep + 1); },
    stepPrev() { if (state.encounterStep > 0) showStep(state.encounterStep - 1); },

    recalcBMI,

    toggleVoice() {
      state.voiceRecording = !state.voiceRecording;
      $('#voice-bar').classList.toggle('recording', state.voiceRecording);
      $('#vb-record ion-icon').setAttribute('name', state.voiceRecording ? 'stop' : 'mic-outline');
      $('#vb-title').textContent = state.voiceRecording ? 'Recording…' : 'Start AI Voice Entry';
      $('#vb-meta').textContent = state.voiceRecording
        ? 'Speak naturally — fields will fill as you talk'
        : 'Fills Vitals, History Review & CC/HPI from your conversation';
      if (state.voiceRecording) { $('#voice-panel').hidden = false; state.voicePanelOpen = true; $('#vb-expand ion-icon').setAttribute('name','chevron-up'); }
    },
    toggleVoicePanel() {
      state.voicePanelOpen = !state.voicePanelOpen;
      $('#voice-panel').hidden = !state.voicePanelOpen;
      $('#vb-expand ion-icon').setAttribute('name', state.voicePanelOpen ? 'chevron-up' : 'chevron-down');
    },

    toggleRefDrawer() {
      const d = $('#ref-drawer');
      d.hidden = !d.hidden;
      $('#ref-chev').setAttribute('name', d.hidden ? 'chevron-down' : 'chevron-up');
    },

    openSignedNote() { App.go('signed-note'); },

    quickCheckIn(name) {
      const a = appointments.find(x => x.name === name);
      if (a) { state.currentAppt = a; a.status = 'checked-in'; }
      renderAppointments();
      App.toast(name + ' checked in');
    },
    quickStart(name) {
      const a = appointments.find(x => x.name === name);
      if (a) { state.currentAppt = a; a.status = 'in-progress'; }
      renderAppointments();
      App.openEncounter();
    },
    quickResume(name) {
      const a = appointments.find(x => x.name === name);
      if (a) state.currentAppt = a;
      App.openEncounter();
    },

    viewVersion(v) {
      $('#version-bar').hidden = false;
      $('#version-bar').classList.remove('hidden');
      $('#version-chip').textContent = 'v' + v + ' · Original';
      App.toast('Viewing v' + v);
    },
    viewCurrentVersion() {
      $('#version-bar').hidden = true;
      $('#version-chip').textContent = 'v2 · Current';
    },

    openPatientTab(key) {
      state.patientTab = key;
      App.go('patient-detail');
    },

    toggleTheme() {
      const html = document.documentElement;
      const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      html.dataset.theme = next;
      $$('.theme-seg button[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === next));
    },
    toggleOffline() {
      const b = $('#conn-banner');
      b.hidden = !b.hidden;
      const t = $('#offline-toggle');
      if (t) t.checked = !b.hidden;
    }
  };
  window.App = App;

  // ---------- Wire events ----------
  document.addEventListener('DOMContentLoaded', () => {
    // Override showScreen to render patient detail lazily
    const origShow = showScreen;
    showScreen = function(id, pushHistory) {
      origShow(id, pushHistory);
      if (id === 'patient-detail') renderPatientDetail();
    };

    $$('#tabbar button').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.tab)));
    $$('#codes-tab-seg button').forEach(b => b.addEventListener('click', () => {
      $$('#codes-tab-seg button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    }));
    $$('.theme-seg button[data-theme]').forEach(b => b.addEventListener('click', () => {
      $$('.theme-seg button[data-theme]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const t = b.dataset.theme;
      document.documentElement.dataset.theme = (t === 'auto')
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : t;
    }));
    $$('#role-seg button, #role-seg-aside button').forEach(b => b.addEventListener('click', () => applyRole(b.dataset.role)));

    const offlineToggle = $('#offline-toggle');
    if (offlineToggle) offlineToggle.addEventListener('change', (e) => {
      $('#conn-banner').hidden = !e.target.checked;
    });

    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip.removable');
      if (chip) {
        const ionIco = e.target.closest('ion-icon');
        if (ionIco && ionIco.getAttribute('name') === 'close') chip.remove();
      }
    });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.add-btn');
      if (!btn) return;
      const added = document.createElement('span');
      added.className = 'added-lbl';
      added.textContent = 'Added';
      btn.replaceWith(added);
      App.toast('Code added');
    });

    renderDateStrip();
    renderAppointments();
    renderPatients();
    setupOtp();
    applyRole('clinician');
    showScreen('login');
  });
})();

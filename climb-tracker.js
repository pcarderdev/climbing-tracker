// Initialize Firebase (config loaded from firebase-config.js)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// State
let currentUser = null;
let currentSession = null;
let selectedSessionType = 'boulder';
let selectedOutcome = null;
let selectedStyle = null;
let selectedDifficulty = 'on';
let sessionTimerInterval = null;

// Auth
auth.signInAnonymously().then((userCredential) => {
  currentUser = userCredential.user;
  loadStats();
});

// Grade options
const boulderGrades = [
  'V0',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'V7',
  'V8',
  'V9',
  'V10',
];
const ropeGrades = [
  '5.6',
  '5.7',
  '5.8',
  '5.8+',
  '5.9-',
  '5.9',
  '5.9+',
  '5.10-',
  '5.10',
  '5.10+',
  '5.11-',
  '5.11',
  '5.11+',
  '5.12-',
  '5.12',
  '5.12+',
];

// Modal functions
function showSessionSetup() {
  document.getElementById('sessionSetupModal').classList.add('active');
}

function showLogClimb() {
  // Populate grade options
  const gradeSelect = document.getElementById('gradeSelect');
  const grades = currentSession.type === 'boulder' ? boulderGrades : ropeGrades;
  gradeSelect.innerHTML = grades
    .map((g) => `<option value="${g}">${g}</option>`)
    .join('');

  // Populate outcome buttons based on session type
  const outcomeButtons = document.getElementById('outcomeButtons');
  if (currentSession.type === 'boulder') {
    outcomeButtons.innerHTML = `
      <button class="toggle-btn" onclick="selectOutcome('warmup')">Warmup</button>
      <button class="toggle-btn" onclick="selectOutcome('flash')">Flash</button>
      <button class="toggle-btn" onclick="selectOutcome('send')">Send</button>
      <button class="toggle-btn" onclick="selectOutcome('fail')">Fail</button>
    `;
  } else {
    outcomeButtons.innerHTML = `
      <button class="toggle-btn" onclick="selectOutcome('warmup')">Warmup</button>
      <button class="toggle-btn" onclick="selectOutcome('flash')">Flash</button>
      <button class="toggle-btn" onclick="selectOutcome('dirty')">Dirty</button>
      <button class="toggle-btn" onclick="selectOutcome('fail')">Fail</button>
    `;
  }

  // Populate style buttons
  const styleButtons = document.getElementById('styleButtons');
  if (currentSession.type === 'boulder') {
    styleButtons.innerHTML = `
      <button class="toggle-btn active" onclick="selectStyle('wall')">Wall</button>
      <button class="toggle-btn" onclick="selectStyle('board')">Board</button>
    `;
    selectedStyle = 'wall';
  } else {
    styleButtons.innerHTML = `
      <button class="toggle-btn active" onclick="selectStyle('lead')">Lead</button>
      <button class="toggle-btn" onclick="selectStyle('toprope')">Top Rope</button>
    `;
    selectedStyle = 'lead';
  }

  // Reset form
  selectedOutcome = null;
  selectedDifficulty = 'on';
  document.querySelectorAll('.toggle-btn').forEach((btn) => {
    if (
      !btn.textContent.includes('Wall') &&
      !btn.textContent.includes('Lead') &&
      !btn.textContent.includes('On')
    ) {
      btn.classList.remove('active');
    }
  });
  // Set "On" as active by default
  document
    .querySelectorAll('#logClimbModal .button-group.three .toggle-btn')
    .forEach((btn) => {
      if (btn.textContent === 'On') {
        btn.classList.add('active');
      }
    });
  document.getElementById('climbNotes').value = '';
  document
    .querySelectorAll('.tag-btn')
    .forEach((btn) => btn.classList.remove('active'));

  document.getElementById('logClimbModal').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function selectSessionType(type) {
  selectedSessionType = type;
  document.querySelectorAll('#sessionSetupModal .toggle-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
}

function selectOutcome(outcome) {
  selectedOutcome = outcome;
  document
    .querySelectorAll('#logClimbModal .button-group.four .toggle-btn')
    .forEach((btn) => {
      btn.classList.remove('active');
    });
  event.target.classList.add('active');
}

function selectStyle(style) {
  selectedStyle = style;
  document.querySelectorAll('#styleButtons .toggle-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
}

function setDifficulty(rating) {
  selectedDifficulty = rating;
  // Update button states
  const difficultyButtons = document.querySelectorAll(
    '#logClimbModal .button-group.three .toggle-btn'
  );
  difficultyButtons.forEach((btn) => {
    btn.classList.remove('active');
    const btnText = btn.textContent.trim().toLowerCase();
    if (btnText === rating.toLowerCase()) {
      btn.classList.add('active');
    }
  });
}

function toggleTag(btn) {
  btn.classList.toggle('active');
}

function updateSessionTimer() {
  if (!currentSession) return;

  const now = new Date();
  const elapsed = Math.floor((now - currentSession.startTime) / 1000); // seconds
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  let timeString;
  if (hours > 0) {
    timeString = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  } else {
    timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  document.getElementById('sessionDuration').textContent = timeString;
}

async function startSession() {
  const gym = document.getElementById('gymSelect').value;

  currentSession = {
    gym: gym,
    type: selectedSessionType,
    startTime: new Date(),
    climbs: [],
  };

  // Save to Firebase
  await db
    .collection('users')
    .doc(currentUser.uid)
    .collection('sessions')
    .add({
      gym: gym,
      type: selectedSessionType,
      startTime: firebase.firestore.Timestamp.now(),
      climbs: [],
    })
    .then((docRef) => {
      currentSession.id = docRef.id;
    });

  document.getElementById('sessionType').textContent =
    selectedSessionType === 'boulder' ? 'Boulder Session' : 'Rope Session';
  document.getElementById('sessionGym').textContent = gym;

  document.getElementById('landingView').classList.add('hidden');
  document.getElementById('sessionView').classList.remove('hidden');
  closeModal('sessionSetupModal');

  updateSessionStats();

  // Start timer
  updateSessionTimer();
  sessionTimerInterval = setInterval(updateSessionTimer, 1000);
}

async function saveClimb() {
  if (!selectedOutcome) {
    alert('Please select an outcome');
    return;
  }

  const tags = Array.from(document.querySelectorAll('.tag-btn.active')).map(
    (btn) => btn.textContent
  );

  const climb = {
    grade: document.getElementById('gradeSelect').value,
    outcome: selectedOutcome,
    style: selectedStyle,
    difficulty: selectedDifficulty,
    tags: tags,
    notes: document.getElementById('climbNotes').value,
    timestamp: new Date(),
  };

  currentSession.climbs.push(climb);

  // Save to Firebase
  await db
    .collection('users')
    .doc(currentUser.uid)
    .collection('sessions')
    .doc(currentSession.id)
    .update({
      climbs: firebase.firestore.FieldValue.arrayUnion(climb),
    });

  addClimbToList(climb);
  updateSessionStats();
  closeModal('logClimbModal');
}

function addClimbToList(climb) {
  refreshClimbList();
}

async function deleteClimb(climbIndex) {
  if (confirm('Delete this climb?')) {
    // Remove from local session
    currentSession.climbs.splice(climbIndex, 1);

    // Update Firebase
    await db
      .collection('users')
      .doc(currentUser.uid)
      .collection('sessions')
      .doc(currentSession.id)
      .update({
        climbs: currentSession.climbs,
      });

    // Refresh the climb list
    refreshClimbList();
    updateSessionStats();
  }
}

function refreshClimbList() {
  const climbList = document.getElementById('climbList');
  climbList.innerHTML = '';

  if (currentSession.climbs.length === 0) {
    climbList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🧗</div>
        <p>Log your first climb to get started</p>
      </div>
    `;
  } else {
    // Display climbs in reverse order (newest first)
    currentSession.climbs
      .slice()
      .reverse()
      .forEach((climb, reverseIndex) => {
        const actualIndex = currentSession.climbs.length - 1 - reverseIndex;
        const climbItem = document.createElement('div');
        climbItem.className = 'climb-item';

        const difficultyText =
          climb.difficulty.toString().charAt(0).toUpperCase() +
          climb.difficulty.toString().slice(1);

        climbItem.innerHTML = `
        <div class="climb-header">
          <div class="climb-grade">${climb.grade}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div class="climb-difficulty">${difficultyText}</div>
            <button class="delete-climb-btn" onclick="deleteClimb(${actualIndex})" title="Delete climb">×</button>
          </div>
        </div>
        <div class="climb-details">
          <span class="climb-badge badge-${
            climb.outcome
          }">${climb.outcome.toUpperCase()}</span>
          <span>${climb.style}</span>
          ${climb.tags.map((tag) => `<span>${tag}</span>`).join('')}
        </div>
        ${climb.notes ? `<div class="climb-note">"${climb.notes}"</div>` : ''}
      `;
        climbList.appendChild(climbItem);
      });
  }
}

function updateSessionStats() {
  const climbs = currentSession.climbs;
  document.getElementById('sessionClimbs').textContent = climbs.length;

  const sends = climbs.filter(
    (c) =>
      c.outcome === 'send' || c.outcome === 'flash' || c.outcome === 'dirty'
  ).length;
  document.getElementById('sessionSends').textContent = sends;

  // Find highest grade sent
  const sentClimbs = climbs.filter(
    (c) =>
      c.outcome === 'send' || c.outcome === 'flash' || c.outcome === 'dirty'
  );
  if (sentClimbs.length > 0) {
    const grades =
      currentSession.type === 'boulder' ? boulderGrades : ropeGrades;
    const highestIndex = Math.max(
      ...sentClimbs.map((c) => grades.indexOf(c.grade))
    );
    document.getElementById('sessionHighGrade').textContent =
      grades[highestIndex];
  }
}

async function endSession() {
  if (confirm('End this session?')) {
    // Stop timer
    if (sessionTimerInterval) {
      clearInterval(sessionTimerInterval);
      sessionTimerInterval = null;
    }

    // Calculate and save duration
    const endTime = new Date();
    const durationMinutes = Math.floor(
      (endTime - currentSession.startTime) / 60000
    );

    await db
      .collection('users')
      .doc(currentUser.uid)
      .collection('sessions')
      .doc(currentSession.id)
      .update({
        endTime: firebase.firestore.Timestamp.now(),
        durationMinutes: durationMinutes,
      });

    currentSession = null;
    document.getElementById('sessionView').classList.add('hidden');
    document.getElementById('landingView').classList.remove('hidden');

    // Clear climb list
    document.getElementById('climbList').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🧗</div>
        <p>Log your first climb to get started</p>
      </div>
    `;

    loadStats();
  }
}

async function loadStats() {
  if (!currentUser) return;

  const sessionsSnapshot = await db
    .collection('users')
    .doc(currentUser.uid)
    .collection('sessions')
    .get();

  let totalClimbs = 0;
  let totalSends = 0;

  sessionsSnapshot.forEach((doc) => {
    const session = doc.data();
    totalClimbs += session.climbs.length;
    totalSends += session.climbs.filter(
      (c) =>
        c.outcome === 'send' || c.outcome === 'flash' || c.outcome === 'dirty'
    ).length;
  });

  document.getElementById('totalClimbs').textContent = totalClimbs;
  document.getElementById('totalSessions').textContent = sessionsSnapshot.size;

  const sendRate =
    totalClimbs > 0 ? Math.round((totalSends / totalClimbs) * 100) : 0;
  document.getElementById('sendRate').textContent = sendRate + '%';

  if (totalClimbs > 0) {
    document.getElementById('statsView').classList.remove('hidden');
  }
}

async function showSessionHistory() {
  const sessionsSnapshot = await db
    .collection('users')
    .doc(currentUser.uid)
    .collection('sessions')
    .orderBy('startTime', 'desc')
    .get();

  const historyList = document.getElementById('sessionHistoryList');
  historyList.innerHTML = '';

  if (sessionsSnapshot.empty) {
    historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>No sessions yet</p>
      </div>
    `;
  } else {
    sessionsSnapshot.forEach((doc) => {
      const session = doc.data();
      const sessionId = doc.id;
      const startDate = session.startTime.toDate();
      const dateStr = startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const climbs = session.climbs || [];
      const sends = climbs.filter(
        (c) =>
          c.outcome === 'send' || c.outcome === 'flash' || c.outcome === 'dirty'
      ).length;

      // Find highest grade
      const grades = session.type === 'boulder' ? boulderGrades : ropeGrades;
      const sentClimbs = climbs.filter(
        (c) =>
          c.outcome === 'send' || c.outcome === 'flash' || c.outcome === 'dirty'
      );
      let highGrade = '-';
      if (sentClimbs.length > 0) {
        const highestIndex = Math.max(
          ...sentClimbs.map((c) => grades.indexOf(c.grade))
        );
        highGrade = grades[highestIndex];
      }

      const duration = session.durationMinutes || 0;
      const durationStr =
        duration > 60
          ? `${Math.floor(duration / 60)}h ${duration % 60}m`
          : `${duration}m`;

      const sessionItem = document.createElement('div');
      sessionItem.className = 'session-history-item';
      sessionItem.style.cursor = 'pointer';
      sessionItem.innerHTML = `
        <div class="session-history-header">
          <div>
            <div class="session-history-date">${dateStr}</div>
            <div class="session-history-type">${session.type} • ${session.gym}</div>
          </div>
          <button class="delete-session-btn" onclick="event.stopPropagation(); deleteSession('${sessionId}')">Delete</button>
        </div>
        <div class="session-history-stats">
          <div class="session-history-stat">
            <div class="session-history-stat-value">${durationStr}</div>
            <div class="session-history-stat-label">Duration</div>
          </div>
          <div class="session-history-stat">
            <div class="session-history-stat-value">${sends}</div>
            <div class="session-history-stat-label">Sends</div>
          </div>
          <div class="session-history-stat">
            <div class="session-history-stat-value">${highGrade}</div>
            <div class="session-history-stat-label">High Point</div>
          </div>
        </div>
      `;
      sessionItem.addEventListener('click', () =>
        showSessionDetail(sessionId, session, dateStr)
      );
      historyList.appendChild(sessionItem);
    });
  }

  document.getElementById('landingView').classList.add('hidden');
  document.getElementById('historyView').classList.remove('hidden');
}

function closeHistory() {
  document.getElementById('historyView').classList.add('hidden');
  document.getElementById('landingView').classList.remove('hidden');
}

function showSessionDetail(sessionId, session, dateStr) {
  // Set header info
  document.getElementById('detailSessionTitle').textContent = dateStr;
  const typeText = session.type === 'boulder' ? 'Boulder' : 'Rope';
  document.getElementById(
    'detailSessionInfo'
  ).textContent = `${typeText} • ${session.gym}`;

  // Populate climb list
  const detailClimbList = document.getElementById('sessionDetailClimbList');
  detailClimbList.innerHTML = '';

  const climbs = session.climbs || [];

  if (climbs.length === 0) {
    detailClimbList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🧗</div>
        <p>No climbs logged in this session</p>
      </div>
    `;
  } else {
    climbs.forEach((climb, index) => {
      const climbItem = document.createElement('div');
      climbItem.className = 'climb-item';

      const difficultyText =
        climb.difficulty.toString().charAt(0).toUpperCase() +
        climb.difficulty.toString().slice(1);

      climbItem.innerHTML = `
        <div class="climb-header">
          <div class="climb-grade">${climb.grade}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div class="climb-difficulty">${difficultyText}</div>
            <button class="delete-climb-btn" onclick="deleteClimbFromHistory('${sessionId}', ${index})" title="Delete climb">×</button>
          </div>
        </div>
        <div class="climb-details">
          <span class="climb-badge badge-${
            climb.outcome
          }">${climb.outcome.toUpperCase()}</span>
          <span>${climb.style}</span>
          ${
            climb.tags && climb.tags.length > 0
              ? climb.tags.map((tag) => `<span>${tag}</span>`).join('')
              : ''
          }
        </div>
        ${climb.notes ? `<div class="climb-note">"${climb.notes}"</div>` : ''}
      `;
      detailClimbList.appendChild(climbItem);
    });
  }

  // Switch views
  document.getElementById('historyView').classList.add('hidden');
  document.getElementById('sessionDetailView').classList.remove('hidden');
}

function closeSessionDetail() {
  document.getElementById('sessionDetailView').classList.add('hidden');
  document.getElementById('historyView').classList.remove('hidden');
}

async function deleteClimbFromHistory(sessionId, climbIndex) {
  if (confirm('Delete this climb?')) {
    // Get the session from Firebase
    const sessionDoc = await db
      .collection('users')
      .doc(currentUser.uid)
      .collection('sessions')
      .doc(sessionId)
      .get();

    const session = sessionDoc.data();
    const climbs = session.climbs || [];

    // Remove the climb
    climbs.splice(climbIndex, 1);

    // Update Firebase
    await db
      .collection('users')
      .doc(currentUser.uid)
      .collection('sessions')
      .doc(sessionId)
      .update({
        climbs: climbs,
      });

    // Refresh the detail view
    const startDate = session.startTime.toDate();
    const dateStr = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // Update the session object and refresh view
    session.climbs = climbs;
    showSessionDetail(sessionId, session, dateStr);

    // Update stats
    await loadStats();
  }
}

async function deleteSession(sessionId) {
  if (confirm('Delete this session? This cannot be undone.')) {
    await db
      .collection('users')
      .doc(currentUser.uid)
      .collection('sessions')
      .doc(sessionId)
      .delete();

    // Refresh the history view
    await showSessionHistory();

    // Update stats
    await loadStats();
  }
}

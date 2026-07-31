const STORAGE_KEY = 'nekorinQuestV2';
const defaultState = {
  xp: 0,
  completedTotal: 0,
  focusSessions: 0,
  streak: 0,
  bestStreak: 0,
  lastActiveDate: null,
  lastDailyReset: null,
  weekKey: null,
  quests: [
    { id: crypto.randomUUID(), title: 'Practice drawing', xp: 20, done: false },
    { id: crypto.randomUUID(), title: 'Study Python', xp: 20, done: false },
    { id: crypto.randomUUID(), title: 'Learn English', xp: 10, done: false },
    { id: crypto.randomUUID(), title: 'Drink water', xp: 10, done: false }
  ],
  habits: [
    { id: crypto.randomUUID(), title: 'Drawing', days: [false,false,false,false,false,false,false] },
    { id: crypto.randomUUID(), title: 'Python', days: [false,false,false,false,false,false,false] },
    { id: crypto.randomUUID(), title: 'English', days: [false,false,false,false,false,false,false] }
  ],
  projects: [
    { id: crypto.randomUUID(), title: 'Nekorin Quest V1', progress: 10 },
    { id: crypto.randomUUID(), title: 'Sultan Art Gallery', progress: 35 }
  ],
  weeklyXp: [0,0,0,0,0,0,0]
};

let state = loadState();
let selectedMinutes = 25;
let timerSeconds = selectedMinutes * 60;
let timerId = null;
let timerRunning = false;
let rewardPending = 0;

function loadState() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const legacy = JSON.parse(localStorage.getItem('nekorinQuestV1'));
    const saved = current || legacy;
    return saved ? { ...structuredClone(defaultState), ...saved } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function startOfWeekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return localDateKey(d);
}
function ensureFreshCycle() {
  const today = localDateKey();
  const week = startOfWeekKey();
  let changed = false;
  if (state.lastDailyReset !== today) {
    state.quests = state.quests.map(q => ({ ...q, done: false }));
    state.lastDailyReset = today;
    changed = true;
  }
  if (state.weekKey !== week) {
    state.weeklyXp = [0,0,0,0,0,0,0];
    state.habits = state.habits.map(h => ({ ...h, days: [false,false,false,false,false,false,false] }));
    state.weekKey = week;
    changed = true;
  }
  if (changed) saveState();
}
ensureFreshCycle();

function levelInfo() {
  const level = Math.floor(state.xp / 100) + 1;
  return { level, current: state.xp % 100, next: 100 };
}
function updateStreak() {
  const today = localDateKey();
  if (state.lastActiveDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  state.streak = state.lastActiveDate === localDateKey(yesterday) ? state.streak + 1 : 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.lastActiveDate = today;
}
function addXp(amount) {
  updateStreak();
  state.xp += amount;
  const day = (new Date().getDay() + 6) % 7;
  state.weeklyXp[day] = (state.weeklyXp[day] || 0) + amount;
  saveState();
  renderAll();
}
function awardXp(amount, message = 'Reward acquired') {
  addXp(amount);
  toast(`+${amount} XP · ${message}`);
}
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2200);
}

const titles = {
  dashboard: 'Welcome back, Sultan', quests: 'Quest Log', habits: 'Habit Chain',
  focus: 'Focus Room', projects: 'Your Projects', calendar: 'Mission Calendar', stats: 'Player Statistics'
};
function openView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${view}View`).classList.add('active');
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('pageTitle').textContent = titles[view];
  if (view === 'calendar') renderCalendar();
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => openView(b.dataset.view)));
document.querySelectorAll('[data-open-view]').forEach(b => b.addEventListener('click', () => openView(b.dataset.openView)));

function questTemplate(q, removable = true) {
  return `<div class="quest-item ${q.done ? 'completed' : ''}">
    <button class="quest-check ${q.done ? 'done' : ''}" data-toggle-quest="${q.id}">${q.done ? '✓' : ''}</button>
    <div class="quest-copy"><b>${escapeHtml(q.title)}</b><span>REWARD ${q.xp} XP</span></div>
    ${removable ? `<button class="delete-btn" data-delete-quest="${q.id}" title="Delete">×</button>` : ''}
  </div>`;
}
function renderQuests() {
  document.getElementById('dashboardQuestList').innerHTML = state.quests.slice(0,4).map(q => questTemplate(q,false)).join('') || '<p class="muted">No quests available.</p>';
  document.getElementById('fullQuestList').innerHTML = state.quests.map(q => questTemplate(q,true)).join('') || '<p class="muted">Quest log is empty.</p>';
  document.querySelectorAll('[data-toggle-quest]').forEach(btn => btn.onclick = () => toggleQuest(btn.dataset.toggleQuest));
  document.querySelectorAll('[data-delete-quest]').forEach(btn => btn.onclick = () => {
    state.quests = state.quests.filter(q => q.id !== btn.dataset.deleteQuest); saveState(); renderAll();
  });
}
function toggleQuest(id) {
  const quest = state.quests.find(q => q.id === id);
  if (!quest) return;
  if (!quest.done) {
    quest.done = true;
    state.completedTotal++;
    awardXp(quest.xp, 'Quest cleared');
  } else {
    quest.done = false;
    state.xp = Math.max(0, state.xp - quest.xp);
    state.completedTotal = Math.max(0, state.completedTotal - 1);
    saveState(); renderAll();
  }
}
document.getElementById('questForm').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('questInput');
  const xp = Number(document.getElementById('questXp').value);
  state.quests.push({ id: crypto.randomUUID(), title: input.value.trim(), xp, done: false });
  input.value = ''; saveState(); renderAll(); toast('New quest registered');
});

function renderHabits() {
  const dayLetters = ['M','T','W','T','F','S','S'];
  document.getElementById('habitGrid').innerHTML = state.habits.map(h => `<div class="habit-card">
    <div class="project-row"><h4>${escapeHtml(h.title)}</h4><button class="delete-btn" data-delete-habit="${h.id}">×</button></div>
    <div class="habit-days">${h.days.map((done,i) => `<button class="habit-day ${done?'done':''}" data-habit="${h.id}" data-day="${i}">${dayLetters[i]}</button>`).join('')}</div>
  </div>`).join('') || '<p class="muted">No habits registered.</p>';
  document.querySelectorAll('[data-habit]').forEach(b => b.onclick = () => {
    const h = state.habits.find(x => x.id === b.dataset.habit); const i = Number(b.dataset.day);
    h.days[i] = !h.days[i];
    if (h.days[i]) awardXp(5,'Habit logged'); else { state.xp = Math.max(0,state.xp-5); saveState(); renderAll(); }
  });
  document.querySelectorAll('[data-delete-habit]').forEach(b => b.onclick = () => { state.habits = state.habits.filter(h => h.id !== b.dataset.deleteHabit); saveState(); renderAll(); });
}
document.getElementById('habitForm').addEventListener('submit', e => {
  e.preventDefault(); const input = document.getElementById('habitInput');
  state.habits.push({ id: crypto.randomUUID(), title: input.value.trim(), days:[false,false,false,false,false,false,false] });
  input.value=''; saveState(); renderAll(); toast('New habit registered');
});

function renderProjects() {
  document.getElementById('projectGrid').innerHTML = state.projects.map(p => `<div class="project-card">
    <div class="project-row"><div><span class="quest-type">${p.progress >= 100 ? 'CLEARED QUEST' : 'ACTIVE QUEST'}</span><h4>${escapeHtml(p.title)}</h4></div><button class="delete-btn" data-delete-project="${p.id}">×</button></div>
    <div class="project-row"><span class="muted">PROGRESS</span><b>${p.progress}%</b></div>
    <input class="project-progress" type="range" min="0" max="100" value="${p.progress}" data-project-range="${p.id}" />
  </div>`).join('') || '<p class="muted">No projects registered.</p>';
  document.querySelectorAll('[data-project-range]').forEach(r => r.oninput = () => { const p=state.projects.find(x=>x.id===r.dataset.projectRange); p.progress=Number(r.value); saveState(); renderProjects(); });
  document.querySelectorAll('[data-delete-project]').forEach(b => b.onclick=()=>{state.projects=state.projects.filter(p=>p.id!==b.dataset.deleteProject);saveState();renderAll();});
}
document.getElementById('projectForm').addEventListener('submit', e => {
  e.preventDefault(); const input=document.getElementById('projectInput');
  state.projects.push({id:crypto.randomUUID(),title:input.value.trim(),progress:0}); input.value='';saveState();renderAll();toast('New project registered');
});

function focusReward(minutes = selectedMinutes) { return minutes; }
function updateTimerDisplay() {
  const m=String(Math.floor(timerSeconds/60)).padStart(2,'0'); const s=String(timerSeconds%60).padStart(2,'0');
  document.getElementById('bigTimer').textContent=`${m}:${s}`;
  document.getElementById('miniTimer').textContent=`${m}:${s}`;
  const reward = focusReward();
  document.getElementById('focusReward').textContent = `REWARD +${reward} XP`;
  document.getElementById('focusHint').textContent = `Complete the full mission to claim ${reward} XP.`;
}
function setTimerStatus(text) { document.getElementById('timerStatus').textContent = text; }
document.querySelectorAll('[data-minutes]').forEach(b => b.addEventListener('click', () => {
  if(timerRunning) return;
  selectedMinutes=Number(b.dataset.minutes); timerSeconds=selectedMinutes*60;
  document.querySelectorAll('[data-minutes]').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  setTimerStatus('READY'); updateTimerDisplay();
}));

document.getElementById('startTimer').addEventListener('click', () => {
  const button = document.getElementById('startTimer');
  if(timerRunning){ clearInterval(timerId); timerRunning=false; button.textContent='RESUME MISSION'; setTimerStatus('PAUSED'); return; }
  timerRunning=true; button.textContent='PAUSE'; setTimerStatus('MISSION ACTIVE');
  document.getElementById('timerCard').classList.add('running');
  timerId=setInterval(()=>{
    timerSeconds = Math.max(0, timerSeconds - 1); updateTimerDisplay();
    if(timerSeconds<=0){
      clearInterval(timerId); timerRunning=false; state.focusSessions++;
      rewardPending = focusReward();
      button.textContent='START MISSION'; setTimerStatus('CLEARED');
      document.getElementById('timerCard').classList.remove('running');
      showMissionComplete(rewardPending);
    }
  },1000);
});
document.getElementById('resetTimer').addEventListener('click',()=>{
  clearInterval(timerId); timerRunning=false; timerSeconds=selectedMinutes*60;
  document.getElementById('startTimer').textContent='START MISSION';
  document.getElementById('timerCard').classList.remove('running');
  setTimerStatus('READY'); updateTimerDisplay();
});

function showMissionComplete(reward) {
  const overlay = document.getElementById('missionOverlay');
  document.getElementById('missionSummary').textContent = `${selectedMinutes}-minute focus mission cleared.`;
  document.getElementById('missionReward').textContent = `+${reward} XP`;
  overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false');
  document.body.classList.add('mission-lock');
  playMissionSound();
  if (navigator.vibrate) navigator.vibrate([100,60,160]);
}
document.getElementById('continueMission').addEventListener('click', () => {
  if (rewardPending > 0) addXp(rewardPending);
  rewardPending = 0;
  const overlay = document.getElementById('missionOverlay');
  overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true');
  document.body.classList.remove('mission-lock');
  timerSeconds = selectedMinutes*60; setTimerStatus('READY'); updateTimerDisplay();
});

function renderCalendar() {
  const picker=document.getElementById('monthPicker');
  if(!picker.value){const now=new Date();picker.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;}
  const [year,month]=picker.value.split('-').map(Number); const first=new Date(year,month-1,1); const days=new Date(year,month,0).getDate();
  const offset=(first.getDay()+6)%7; const today=new Date(); const heads=['MON','TUE','WED','THU','FRI','SAT','SUN'];
  let html=heads.map(h=>`<div class="calendar-head">${h}</div>`).join('');
  for(let i=0;i<offset;i++) html+='<div class="calendar-cell empty"></div>';
  for(let d=1;d<=days;d++){const isToday=d===today.getDate()&&month===today.getMonth()+1&&year===today.getFullYear();html+=`<div class="calendar-cell ${isToday?'today':''}">${d}</div>`;}
  document.getElementById('calendarGrid').innerHTML=html;
}
document.getElementById('monthPicker').addEventListener('change',renderCalendar);

function renderSummary() {
  const info=levelInfo(); const done=state.quests.filter(q=>q.done).length; const total=state.quests.length; const pct=total?Math.round(done/total*100):0;
  document.getElementById('levelNumber').textContent=info.level; document.getElementById('currentXp').textContent=info.current; document.getElementById('nextXp').textContent=info.next;
  document.getElementById('xpFill').style.width=`${info.current}%`; document.getElementById('completionPercent').textContent=`${pct}%`; document.getElementById('ringPercent').textContent=`${pct}%`;
  document.getElementById('progressRing').style.background=`conic-gradient(var(--purple) ${pct*3.6}deg,#241c34 0deg)`;
  document.getElementById('doneCount').textContent=done; document.getElementById('openCount').textContent=total-done; document.getElementById('streakCount').textContent=state.streak;
  document.getElementById('sidebarStreak').textContent=state.streak;
  document.getElementById('statXp').textContent=state.xp; document.getElementById('statCompleted').textContent=state.completedTotal; document.getElementById('statFocus').textContent=state.focusSessions; document.getElementById('statStreak').textContent=state.bestStreak;
  const labels=['M','T','W','T','F','S','S']; const max=Math.max(10,...state.weeklyXp);
  document.getElementById('weeklyBars').innerHTML=state.weeklyXp.map((v,i)=>`<div class="bar-col"><b>${v}</b><div class="bar" style="--h:${v ? Math.max(10,(v/max)*100) : 5}%"></div><span>${labels[i]}</span></div>`).join('');
}
function renderAll(){ensureFreshCycle();renderQuests();renderHabits();renderProjects();renderSummary();updateTimerDisplay();}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function playMissionSound() {
  try {
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    [0,0.12,0.25].forEach((delay,index)=>{
      const osc=ctx.createOscillator(); const gain=ctx.createGain();
      osc.type=index===2?'sine':'triangle'; osc.frequency.setValueAtTime([220,440,880][index],ctx.currentTime+delay);
      gain.gain.setValueAtTime(.001,ctx.currentTime+delay); gain.gain.exponentialRampToValueAtTime(.16,ctx.currentTime+delay+.02); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+delay+.32);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(ctx.currentTime+delay); osc.stop(ctx.currentTime+delay+.35);
    });
  } catch {}
}
function electronicWhipSound(){
  const ctx=new (window.AudioContext||window.webkitAudioContext)(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); const filter=ctx.createBiquadFilter();
  osc.type='sawtooth'; osc.frequency.setValueAtTime(1300,ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(90,ctx.currentTime+.18);
  filter.type='highpass'; filter.frequency.value=120; gain.gain.setValueAtTime(.22,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.22);
  osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.23); toast('SYSTEM // Return to your quest 😂');
}
document.getElementById('soundButton').addEventListener('click',electronicWhipSound);

document.getElementById('todayLabel').textContent=new Intl.DateTimeFormat('en-GB',{weekday:'long',month:'long',day:'numeric'}).format(new Date()).toUpperCase();
renderCalendar(); renderAll();
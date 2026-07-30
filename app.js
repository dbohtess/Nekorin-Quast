const STORAGE_KEY = 'nekorinQuestV1';
const defaultState = {
  xp: 0,
  completedTotal: 0,
  focusSessions: 0,
  streak: 0,
  bestStreak: 0,
  lastActiveDate: null,
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
let timerSeconds = 25 * 60;
let selectedMinutes = 25;
let timerId = null;
let timerRunning = false;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaultState, ...saved } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function todayKey() { return new Date().toISOString().slice(0,10); }
function levelInfo() {
  const level = Math.floor(state.xp / 100) + 1;
  return { level, current: state.xp % 100, next: 100 };
}
function updateStreak() {
  const today = todayKey();
  if (state.lastActiveDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0,10);
  state.streak = state.lastActiveDate === yesterdayKey ? state.streak + 1 : 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.lastActiveDate = today;
}
function awardXp(amount, message='XP gained') {
  updateStreak();
  state.xp += amount;
  const day = (new Date().getDay() + 6) % 7;
  state.weeklyXp[day] = (state.weeklyXp[day] || 0) + amount;
  saveState();
  renderAll();
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
  dashboard: 'Welcome back, Sultan', quests: 'Quest Log', habits: 'Habit Streaks',
  focus: 'Focus Chamber', projects: 'Your Projects', calendar: 'Calendar', stats: 'Statistics'
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

function questTemplate(q, removable=true) {
  return `<div class="quest-item ${q.done ? 'completed' : ''}">
    <button class="quest-check ${q.done ? 'done' : ''}" data-toggle-quest="${q.id}">${q.done ? '✓' : ''}</button>
    <div class="quest-copy"><b>${escapeHtml(q.title)}</b><span>${q.xp} XP reward</span></div>
    ${removable ? `<button class="delete-btn" data-delete-quest="${q.id}" title="Delete">×</button>` : ''}
  </div>`;
}
function renderQuests() {
  document.getElementById('dashboardQuestList').innerHTML = state.quests.slice(0,4).map(q => questTemplate(q,false)).join('') || '<p class="muted">No quests yet.</p>';
  document.getElementById('fullQuestList').innerHTML = state.quests.map(q => questTemplate(q,true)).join('') || '<p class="muted">Your quest log is empty.</p>';
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
    awardXp(quest.xp, 'Quest completed');
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
  input.value = ''; saveState(); renderAll(); toast('New quest added');
});

function renderHabits() {
  const dayLetters = ['M','T','W','T','F','S','S'];
  document.getElementById('habitGrid').innerHTML = state.habits.map(h => `<div class="habit-card">
    <div class="project-row"><h4>${escapeHtml(h.title)}</h4><button class="delete-btn" data-delete-habit="${h.id}">×</button></div>
    <div class="habit-days">${h.days.map((done,i) => `<button class="habit-day ${done?'done':''}" data-habit="${h.id}" data-day="${i}">${dayLetters[i]}</button>`).join('')}</div>
  </div>`).join('') || '<p class="muted">No habits yet.</p>';
  document.querySelectorAll('[data-habit]').forEach(b => b.onclick = () => {
    const h = state.habits.find(x => x.id === b.dataset.habit); const i = Number(b.dataset.day);
    h.days[i] = !h.days[i];
    if (h.days[i]) awardXp(5,'Habit checked'); else { state.xp = Math.max(0,state.xp-5); saveState(); renderAll(); }
  });
  document.querySelectorAll('[data-delete-habit]').forEach(b => b.onclick = () => { state.habits = state.habits.filter(h => h.id !== b.dataset.deleteHabit); saveState(); renderAll(); });
}
document.getElementById('habitForm').addEventListener('submit', e => {
  e.preventDefault(); const input = document.getElementById('habitInput');
  state.habits.push({ id: crypto.randomUUID(), title: input.value.trim(), days:[false,false,false,false,false,false,false] });
  input.value=''; saveState(); renderAll();
});

function renderProjects() {
  document.getElementById('projectGrid').innerHTML = state.projects.map(p => `<div class="project-card">
    <div class="project-row"><h4>${escapeHtml(p.title)}</h4><button class="delete-btn" data-delete-project="${p.id}">×</button></div>
    <div class="project-row"><span class="muted">Progress</span><b>${p.progress}%</b></div>
    <input class="project-progress" type="range" min="0" max="100" value="${p.progress}" data-project-range="${p.id}" />
  </div>`).join('') || '<p class="muted">No projects yet.</p>';
  document.querySelectorAll('[data-project-range]').forEach(r => r.oninput = () => { const p=state.projects.find(x=>x.id===r.dataset.projectRange); p.progress=Number(r.value); saveState(); renderProjects(); });
  document.querySelectorAll('[data-delete-project]').forEach(b => b.onclick=()=>{state.projects=state.projects.filter(p=>p.id!==b.dataset.deleteProject);saveState();renderAll();});
}
document.getElementById('projectForm').addEventListener('submit', e => {
  e.preventDefault(); const input=document.getElementById('projectInput');
  state.projects.push({id:crypto.randomUUID(),title:input.value.trim(),progress:0}); input.value='';saveState();renderAll();
});

function updateTimerDisplay() {
  const m=String(Math.floor(timerSeconds/60)).padStart(2,'0'); const s=String(timerSeconds%60).padStart(2,'0');
  document.getElementById('bigTimer').textContent=`${m}:${s}`; document.getElementById('miniTimer').textContent=`${m}:${s}`;
}
document.querySelectorAll('[data-minutes]').forEach(b => b.addEventListener('click', () => {
  if(timerRunning) return;
  selectedMinutes=Number(b.dataset.minutes); timerSeconds=selectedMinutes*60;
  document.querySelectorAll('[data-minutes]').forEach(x=>x.classList.remove('active')); b.classList.add('active'); updateTimerDisplay();
}));
document.getElementById('startTimer').addEventListener('click', () => {
  if(timerRunning){ clearInterval(timerId); timerRunning=false; document.getElementById('startTimer').textContent='Resume'; return; }
  timerRunning=true; document.getElementById('startTimer').textContent='Pause';
  timerId=setInterval(()=>{ timerSeconds--; updateTimerDisplay(); if(timerSeconds<=0){clearInterval(timerId);timerRunning=false;state.focusSessions++;timerSeconds=selectedMinutes*60;document.getElementById('startTimer').textContent='Start';awardXp(25,'Focus session complete');updateTimerDisplay();}},1000);
});
document.getElementById('resetTimer').addEventListener('click',()=>{clearInterval(timerId);timerRunning=false;timerSeconds=selectedMinutes*60;document.getElementById('startTimer').textContent='Start';updateTimerDisplay();});

function renderCalendar() {
  const picker=document.getElementById('monthPicker');
  if(!picker.value){const now=new Date();picker.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;}
  const [year,month]=picker.value.split('-').map(Number); const first=new Date(year,month-1,1); const days=new Date(year,month,0).getDate();
  const offset=(first.getDay()+6)%7; const today=new Date(); const heads=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
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
  const labels=['M','T','W','T','F','S','S']; const max=Math.max(50,...state.weeklyXp);
  document.getElementById('weeklyBars').innerHTML=state.weeklyXp.map((v,i)=>`<div class="bar-col"><div class="bar" style="--h:${Math.max(6,(v/max)*100)}%"></div><span>${labels[i]}</span></div>`).join('');
}
function renderAll(){renderQuests();renderHabits();renderProjects();renderSummary();updateTimerDisplay();}
function escapeHtml(value){return value.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function electronicWhipSound(){
  const ctx=new (window.AudioContext||window.webkitAudioContext)(); const osc=ctx.createOscillator(); const gain=ctx.createGain(); const filter=ctx.createBiquadFilter();
  osc.type='sawtooth'; osc.frequency.setValueAtTime(1300,ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(90,ctx.currentTime+.18);
  filter.type='highpass'; filter.frequency.value=120; gain.gain.setValueAtTime(.22,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.22);
  osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.23); toast('⚡ ارجعي للخطة يا عنود 😂');
}
document.getElementById('soundButton').addEventListener('click',electronicWhipSound);

document.getElementById('todayLabel').textContent=new Intl.DateTimeFormat('en',{weekday:'long',month:'short',day:'numeric'}).format(new Date()).toUpperCase();
renderCalendar(); renderAll();

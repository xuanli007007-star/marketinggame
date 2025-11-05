/* MelbQuiz MVP — 纯前端：支持API对接；无后端时自动用本地题库 */
const $ = (sel)=>document.querySelector(sel);
const cfgEl = document.getElementById('app-config');
const cfg = cfgEl ? JSON.parse(cfgEl.textContent) : {};

const state = {
  question: null,
  selected: null,
  points: 0,
  token: null
};

// —— 工具 ——
function todayKey(){ return new Date().toISOString().slice(0,10); }
function lsGet(k, def=null){ try{ return JSON.parse(localStorage.getItem(k)) ?? def; }catch(e){ return def; } }
function lsSet(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
function fmtLeftTime(){
  const end = new Date(); end.setHours(23,59,59,999);
  const ms = end - new Date();
  const h = Math.floor(ms/3600000);
  const m = Math.floor((ms%3600000)/60000);
  return `剩余 ${h}h ${m}m`;
}
function setPoints(p){ state.points=p; $('#pointsChip').textContent=`当前积分：${p}`; }
function toast(msg, type=''){ const el=$('#feedback'); el.className=`toast ${type||''}`; el.textContent=msg; el.classList.remove('hidden'); }
function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }

// —— 本地题库（无API时兜底） ——
const fallbackQuestions = [
  { title:'墨尔本哪条小巷因街头涂鸦而闻名？', correct:'Hosier Lane', wrongs:['Hardware Lane','Degraves Street','Flinders Lane'], explanation:'Hosier Lane 靠近联邦广场，以涂鸦闻名。' }
];

// —— API ——
function apiBase(){ return (cfg.API_BASE||'').trim(); }
async function apiGet(path){
  const url = apiBase()+path;
  const headers={'Content-Type':'application/json'};
  if(state.token) headers.Authorization=`Bearer ${state.token}`;
  const res = await fetch(url,{headers});
  if(!res.ok) throw new Error('API_GET_FAILED');
  return res.json();
}
async function apiPost(path, body){
  const url = apiBase()+path;
  const headers={'Content-Type':'application/json'};
  if(state.token) headers.Authorization=`Bearer ${state.token}`;
  const res = await fetch(url,{method:'POST',headers,body:JSON.stringify(body||{})});
  if(!res.ok) throw new Error('API_POST_FAILED');
  return res.json();
}

// —— 逻辑 ——
function hasAnsweredToday(){ return !!lsGet('answered:'+todayKey(), false); }
function setAnsweredToday(){ lsSet('answered:'+todayKey(), true); }

async function loadUser(){
  try{
    const u = new URL(location.href);
    state.token = u.searchParams.get('token') || null;
    if(apiBase()){
      const me = await apiGet(cfg.ENDPOINTS.ME);
      setPoints(me.points ?? 0);
      return;
    }
  }catch(e){}
  setPoints(lsGet('points',0));
}

async function loadQuestion(){
  $('#leftTime').textContent = fmtLeftTime();
  setInterval(()=> $('#leftTime').textContent = fmtLeftTime(), 60000);

  if(hasAnsweredToday()){
    $('#questionText').textContent='您已参与今日答题，请明天再来！';
    $('#btnSubmit').disabled=true;
    return;
  }

  try{
    if(apiBase()){
      const data = await apiGet(cfg.ENDPOINTS.TODAY_QUESTION);
      state.question = {
        title:data.title,
        options: shuffle([data.correct, ...data.wrongs]),
        correct: data.correct,
        explanation: data.explanation
      };
    }else{
      const q = fallbackQuestions[0];
      state.question = { title:q.title, options: shuffle([q.correct,...q.wrongs]), correct:q.correct, explanation:q.explanation };
    }
  }catch(e){
    const q = fallbackQuestions[0];
    state.question = { title:q.title, options: shuffle([q.correct,...q.wrongs]), correct:q.correct, explanation:q.explanation };
  }

  renderQuestion(state.question);
}

function renderQuestion(q){
  $('#questionText').textContent = q.title;
  const box = $('#options'); box.innerHTML='';
  q.options.forEach((opt,i)=>{
    const el = document.createElement('label');
    el.className='option';
    el.innerHTML = `<input type="radio" name="answer" value="${opt}" aria-label="${opt}"><span>${opt}</span>`;
    el.addEventListener('click',()=>{ state.selected=opt; $('#btnSubmit').disabled=false; });
    box.appendChild(el);
  });
}

async function submit(){
  if(!state.selected || !state.question) return;
  const correct = state.selected === state.question.correct;
  setAnsweredToday();

  // 高亮
  [...document.querySelectorAll('.option')].forEach(el=>{
    const v = el.querySelector('input').value;
    if(v===state.question.correct) el.classList.add('correct');
    if(v===state.selected && !correct) el.classList.add('wrong');
  });
  $('#btnSubmit').disabled = true;

  if(correct){
    const delta = cfg.POINTS_PER_CORRECT || 10;
    try{
      if(apiBase()){
        const r = await apiPost(cfg.ENDPOINTS.ADD_POINTS, { delta });
        setPoints(r.points ?? (state.points + delta));
      }else{
        setPoints(state.points + delta);
        lsSet('points', state.points);
      }
    }catch(e){
      setPoints(state.points + delta);
      lsSet('points', state.points);
    }
    toast(`回答正确！+${cfg.POINTS_PER_CORRECT||10} 分\n${state.question.explanation||''}`, 'ok');
  }else{
    toast(`回答错误！正确答案：${state.question.correct}\n${state.question.explanation||''}`, 'err');
  }

  // 记录答案（可选）
  try{
    if(apiBase()){
      await apiPost(cfg.ENDPOINTS.RECORD_ANSWER, { selected: state.selected, correct, ts: Date.now() });
    }
  }catch(e){}
}

window.addEventListener('DOMContentLoaded', async ()=>{
  await loadUser();
  await loadQuestion();
  $('#btnSubmit').addEventListener('click', submit);
});

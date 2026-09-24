/* 타로 — 섞기 · 부채 · 고르기 · 해석 */

const TOPICS = {
  love:  {t:'연애', d:'마음 · 인연 · 재회',   pos:['내 마음','상대 마음','앞으로']},
  money: {t:'돈',   d:'수입 · 투자 · 지출',   pos:['지금','걸림돌','들어올 길']},
  work:  {t:'일',   d:'이직 · 성과 · 사람',   pos:['지금 자리','넘을 벽','갈 길']},
  self:  {t:'나',   d:'마음 · 건강 · 방향',   pos:['지금의 나','놓을 것','될 나']},
  all:   {t:'종합', d:'전체 흐름',            pos:['과거','현재','미래']}
};
const TOPIC_KEY = {love:'love', money:'money', work:'work', self:'self', all:'self'};

const COLORS = [['흰색','#f2f0ea'],['검정','#111'],['파랑','#2f6f9f'],['초록','#2f8f4e'],['주황','#e08a3c'],['남색','#22304a'],['빨강','#b5433f'],['회색','#8c8a84']];

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const $ = id => document.getElementById(id);
const rnd = n => Math.floor(Math.random()*n);
const wait = ms => new Promise(r => setTimeout(r, RM.matches ? Math.min(ms,60) : ms));

let state = { topic:null, q:'', deck:[], fan:[], picks:[] };

/* ── 카드 DOM ── */
function cardEl(card, faceUp, rev){
  const d = document.createElement('div');
  d.className = 'card' + (faceUp ? ' flip' : '');
  d.innerHTML = '<div class="face back"></div>' +
    '<div class="face front' + (rev ? ' rev' : '') + '">' +
    (card ? '<img src="' + card.img + '" alt="' + card.name + '" draggable="false">' : '') + '</div>';
  return d;
}
function toRoman(n){
  if (n === 0) return '0';
  const m = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let s = '', v = n;
  for (const [a,r] of m) while (v >= a) { s += r; v -= a; }
  return s;
}

/* ── 1. 주제 ── */
function initTopics(){
  const box = $('topics');
  for (const [k,t] of Object.entries(TOPICS)) {
    const b = document.createElement('button');
    b.className = 'tp'; b.type = 'button'; b.dataset.k = k;
    b.innerHTML = '<span class="t">'+t.t+'</span><span class="d">'+t.d+'</span>';
    b.onclick = () => {
      document.querySelectorAll('.tp').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel'); state.topic = k; $('go').disabled = false;
    };
    box.appendChild(b);
  }
}

/* ── 2. 섞기 ── */
async function shuffle(){
  go('sShuffle');
  const st = $('shuffleStage'); st.innerHTML = '';
  const N = 14, els = [];
  for (let i = 0; i < N; i++) {
    const c = cardEl(null, false, false);
    c.style.zIndex = i;
    c.style.transform = 'translate(0,0) rotate(0deg)';
    st.appendChild(c); els.push(c);
  }
  const msg = $('shMsg');
  const steps = [['펼치기',spread],['나누기',cut],['섞기',riffle],['섞기',riffle],['섞기',riffle],['모으기',gather]];
  for (const [m, fn] of steps) { msg.textContent = m; await fn(els); await wait(RM.matches ? 40 : 200); }
  msg.textContent = ''; await wait(380);
  fanOut();
}
function setT(els, f){ els.forEach((c,i) => { c.style.transition = 'transform .5s cubic-bezier(.2,.7,.3,1)'; c.style.transform = f(i, els.length); }); }
async function spread(els){ setT(els, (i,n) => { const p = (i-(n-1)/2); return `translate(${p*17}px,${Math.abs(p)*2}px) rotate(${p*3}deg)`; }); await wait(560); }
async function cut(els){ setT(els, (i,n) => i < n/2 ? `translate(-92px,${i*3}px) rotate(-6deg)` : `translate(92px,${(i-n/2)*3}px) rotate(6deg)`); await wait(560); }
async function riffle(els){
  setT(els, (i,n) => i < n/2 ? `translate(-46px,${i*2-9}px) rotate(-3deg)` : `translate(46px,${(i-n/2)*2-9}px) rotate(3deg)`);
  await wait(300);
  els.forEach((c,i) => { c.style.zIndex = (i % 2 ? i : i + 40); });
  setT(els, i => `translate(0,${(i-7)*1.6}px) rotate(${(i%2?1:-1)*1.2}deg)`);
  await wait(340);
}
async function gather(els){ setT(els, i => `translate(0,${(i-7)*1.1}px) rotate(${(i-7)*.5}deg)`); await wait(520); }

/* ── 3. 부채 펼침 ── */
/* 부채는 카드가 서로 덮는다. 카드마다 hover/click 을 걸면 «위에 얹힌 카드» 가 클릭을 가로채
   눈에 보이는 카드를 못 누른다(실측 : 3번을 누르면 5번이 받았다).
   그래서 판 전체에서 포인터의 «각도» 로 카드를 찾는다 — 부채꼴 각도 = 카드 번호.
   눈이 보는 카드와 손이 짚는 카드가 늘 같다. 터치도 같은 길 */
const FAN = { N:21, SPAN:128, TOP:26, ORIG:240, R0:70, R1:290 };
/* 부채 치수는 CSS 변수가 원본이다 — 폰 폭에서 반지름·각도가 달라진다. 펼칠 때마다 다시 읽는다 */
function readFan(){
  const cs = getComputedStyle($('fan'));
  FAN.ORIG = parseFloat(cs.getPropertyValue('--orig')) || 240;
  FAN.SPAN = parseFloat(cs.getPropertyValue('--span')) || 128;
  const ch = parseFloat(cs.getPropertyValue('--ch')) || 129;
  FAN.R0 = Math.max(40, FAN.ORIG - ch - 30);     // 카드 아래끝보다 살짝 안쪽까지
  FAN.R1 = FAN.ORIG + 50;
}
let hot = -1;
function fanOut(){
  go('sFan'); readFan();
  state.deck = DECK.slice().sort(() => Math.random() - .5);
  state.fan = state.deck.slice(0, FAN.N);
  state.picks = []; hot = -1;
  const box = $('fan'); box.innerHTML = '';
  const N = state.fan.length;
  state.fan.forEach((card, i) => {
    const s = document.createElement('div');
    s.className = 'slot'; s.dataset.i = i;
    s.appendChild(cardEl(null, false, false));
    const ang = slotAng(i);
    s.style.transform = 'translateX(-50%) rotate(0deg) translateY(30px) scale(.9)';
    s.style.opacity = '0';
    s.style.zIndex = i;
    box.appendChild(s);
    setTimeout(() => {
      s.style.opacity = '1';
      s.style.transform = restT(ang);
    }, RM.matches ? 0 : 60 + i*34);
  });
  drawSlots();
}
function slotAng(i){ return -FAN.SPAN/2 + (FAN.SPAN/(FAN.N-1))*i; }
function restT(ang){ return `translateX(-50%) rotate(${ang}deg)`; }
function liftT(ang){ return `translateX(-50%) rotate(${ang}deg) translateY(-24px)`; }

/* 포인터 → 카드 번호. 부채 밖(너무 가깝거나 멀거나 각도 밖)이면 -1 */
function hitSlot(cx, cy){
  const box = $('fan'), r = box.getBoundingClientRect();
  const ox = r.left + r.width/2, oy = r.top + FAN.TOP + FAN.ORIG;
  const dx = cx - ox, dy = cy - oy;
  const dist = Math.hypot(dx, dy);
  if (dist < FAN.R0 || dist > FAN.R1) return -1;
  const ang = Math.atan2(dx, -dy) * 180 / Math.PI;
  const step = FAN.SPAN/(FAN.N-1);
  if (ang < -FAN.SPAN/2 - step/2 || ang > FAN.SPAN/2 + step/2) return -1;
  let i = Math.round((ang + FAN.SPAN/2) / step);
  return Math.max(0, Math.min(FAN.N-1, i));
}
function setHot(i){
  if (i === hot) return;
  const slots = $('fan').querySelectorAll('.slot');
  if (hot >= 0 && slots[hot] && !slots[hot].classList.contains('taken')) {
    slots[hot].style.zIndex = hot; slots[hot].style.transform = restT(slotAng(hot));
    slots[hot].classList.remove('hot');
  }
  hot = i;
  if (i >= 0 && slots[i] && !slots[i].classList.contains('taken')) {
    slots[i].style.zIndex = 999; slots[i].style.transform = liftT(slotAng(i));
    slots[i].classList.add('hot');
  }
}
function bindFan(){
  const box = $('fan');
  box.addEventListener('mousemove', e => setHot(hitSlot(e.clientX, e.clientY)));
  box.addEventListener('mouseleave', () => setHot(-1));
  box.addEventListener('click', e => { const i = hitSlot(e.clientX, e.clientY); if (i >= 0) pick(i); });
  box.addEventListener('touchstart', e => { const t = e.touches[0]; setHot(hitSlot(t.clientX, t.clientY)); }, { passive:true });
  box.addEventListener('touchend', e => { const t = e.changedTouches[0]; const i = hitSlot(t.clientX, t.clientY);
    setHot(-1); if (i >= 0) pick(i); }, { passive:true });
}
function drawSlots(){
  const pos = TOPICS[state.topic].pos, box = $('picked');
  box.innerHTML = pos.map((p,i) =>
    `<div class="pk${state.picks[i] ? ' on' : ''}"><span class="n">${i+1}</span>${p}</div>`).join('');
  $('fanHint').textContent = state.picks.length < 3 ? `${3 - state.picks.length}장 남았습니다` : '';
}
function pick(i){
  const s = $('fan').querySelectorAll('.slot')[i];
  if (!s || state.picks.length >= 3 || s.classList.contains('taken')) return;
  if (hot === i) hot = -1;
  s.classList.remove('hot'); s.classList.add('taken', 'pick');
  s.style.zIndex = i; s.style.transform = restT(slotAng(i));
  const card = state.fan[i];
  state.picks.push({ card, rev: Math.random() < 0.32 });
  drawSlots();
  if (state.picks.length === 3) setTimeout(reveal, RM.matches ? 60 : 520);
}

/* ── 4. 해석 ── */
async function reveal(){
  go('sRes');
  const tp = TOPICS[state.topic], key = TOPIC_KEY[state.topic];
  $('resQ').textContent = state.q || '';
  $('resTp').textContent = tp.t;

  const sp = $('spread'); sp.innerHTML = '';
  state.picks.forEach((p, i) => {
    const c = p.card, rev = p.rev;
    const el = document.createElement('div');
    el.className = 'rc';
    el.innerHTML = `<div class="ch"></div><div>
      <div class="pos">${tp.pos[i]}</div>
      <div class="nm">${c.name}</div>
      <div class="dir ${rev?'r':'u'}">${rev ? '역방향' : '정방향'}</div>
      <div class="kw">${(rev ? c.rv : c.up).join(' · ')}</div>
      <div class="msg">${c.txt[key][rev ? 1 : 0]}</div></div>`;
    const cd = cardEl(c, false, rev);
    el.querySelector('.ch').appendChild(cd);
    sp.appendChild(el);
    setTimeout(() => { el.classList.add('in'); }, RM.matches ? 0 : i*170);
    setTimeout(() => { cd.classList.add('flip'); }, RM.matches ? 0 : 320 + i*170);
  });

  await wait(RM.matches ? 60 : 1000);
  summary(key);
}

function summary(key){
  const ps = state.picks, majors = ps.filter(p => p.card.type === 'major').length;
  const revs = ps.filter(p => p.rev).length;
  const suits = ps.filter(p => p.card.type === 'minor').map(p => p.card.suit);
  const sameSuit = suits.length >= 2 && suits.every(s => s === suits[0]);

  let score = 58 + majors*7 - revs*9 + rnd(11);
  if (sameSuit) score += 6;
  score = Math.max(12, Math.min(98, score));

  const lines = [];
  if (majors >= 2) lines.push(`메이저 ${majors}장. <b>큰 흐름이 미는 때</b>.`);
  else if (majors === 1) lines.push('메이저 한 장이 <b>열쇠</b>.');
  else lines.push('전부 마이너. <b>일상에서</b> 답이 나온다.');
  if (revs === 0) lines.push('역방향 없음. <b>막힌 데 없다.</b>');
  else if (revs === 3) lines.push('셋 다 역방향. <b>덜어내는 때.</b>');
  else lines.push(`역방향 ${revs}장. <b>손볼 매듭</b>이 있다.`);
  if (sameSuit) lines.push(`<b>${SUITS[suits[0]].k}</b>가 겹침 — ${SUITS[suits[0]].f}.`);
  const last = ps[2];
  lines.push(`결론은 <b>${last.card.name}</b>${last.rev ? '(역)' : ''} — ${last.card.txt[key][last.rev?1:0]}`);

  $('sumBody').innerHTML = lines.map(l => '<p>' + l + '</p>').join('');
  $('scoreV').textContent = score;
  setTimeout(() => { $('scoreFill').style.width = score + '%'; }, 90);

  const [cn, cv] = COLORS[rnd(COLORS.length)];
  $('lucky').innerHTML = `
    <div class="lk"><div class="l">색</div><div class="v"><span class="sw" style="background:${cv}"></span>${cn}</div></div>
    <div class="lk"><div class="l">숫자</div><div class="v">${1 + rnd(9)}</div></div>
    <div class="lk"><div class="l">시간</div><div class="v">${['아침','낮','저녁','밤'][rnd(4)]}</div></div>`;
}

/* ── 단계 전환 ── */
function go(id){
  document.querySelectorAll('.step').forEach(s => s.classList.remove('on'));
  $(id).classList.add('on');
  window.scrollTo({ top: 0, behavior: RM.matches ? 'auto' : 'smooth' });
}
function restart(){ state = { topic:null, q:'', deck:[], fan:[], picks:[] };
  document.querySelectorAll('.tp').forEach(x => x.classList.remove('sel'));
  $('go').disabled = true; $('q').value = ''; go('sTopic'); }

window.addEventListener('DOMContentLoaded', () => {
  initTopics(); bindFan();
  $('go').onclick = () => { state.q = $('q').value.trim(); shuffle(); };
  $('again').onclick = restart;
  $('redraw').onclick = () => shuffle();
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter' && !$('go').disabled) $('go').click(); });
});

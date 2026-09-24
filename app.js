/* 타로 — 섞기 · 부채 · 고르기 · 해석 */

const TOPICS = {
  love:  {t:'연애', d:'마음 · 인연 · 재회',   pos:['내 마음','상대 마음','앞으로']},
  money: {t:'돈',   d:'수입 · 투자 · 지출',   pos:['지금','걸림돌','들어올 길']},
  work:  {t:'일',   d:'이직 · 성과 · 사람',   pos:['지금 자리','넘을 벽','갈 길']},
  self:  {t:'나',   d:'마음 · 건강 · 방향',   pos:['지금의 나','놓을 것','될 나']},
  all:   {t:'종합', d:'전체 흐름',            pos:['과거','현재','미래']}
};
const TOPIC_KEY = {love:'love', money:'money', work:'work', self:'self', all:'self'};
const PERIODS = { today:{t:'오늘', s:'오늘 하루'}, week:{t:'이번 주', s:'이번 주'}, month:{t:'이번 달', s:'이번 달'} };

const COLORS = [['흰색','#f2f0ea'],['검정','#111'],['파랑','#2f6f9f'],['초록','#2f8f4e'],['주황','#e08a3c'],['남색','#22304a'],['빨강','#b5433f'],['회색','#8c8a84']];

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const $ = id => document.getElementById(id);
/* 조사 — 받침 유무로 고른다. 이름 뒤에 붙일 «조사만» 돌려준다. ㄹ 받침은 «로». 숫자 카드는 삼·육·십 받침, 칠·팔은 ㄹ */
function J(w, a, b){ const m = w.match(/(\d+)$/);
  if (m) { const n = +m[1]; const hasJong = {3:1,6:1,10:1}[n], isL = {7:1,8:1}[n];
    return hasJong ? a : (isL ? (a === '으로' ? b : a) : b); }
  const c = w.charCodeAt(w.length-1); if (c < 0xAC00 || c > 0xD7A3) return b;
  const jong = (c - 0xAC00) % 28; if (jong === 0) return b; if (a === '으로' && jong === 8) return b; return a; }
const rnd = n => Math.floor(Math.random()*n);
/* 점수가 0에서 슥 올라오며 확정된다 — 결과를 «받는» 순간의 무게를 더한다(2026-09 애니메이션 강화) */
function countUp(el, target, ms){
  if (!ms) { el.textContent = target; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased);
    if (p < 1) requestAnimationFrame(tick); else el.textContent = target;
  };
  requestAnimationFrame(tick);
}
const wait = ms => new Promise(r => setTimeout(r, RM.matches ? Math.min(ms,60) : ms));

let state = { topic:null, period:'today', q:'', deck:[], fan:[], picks:[] };

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
  const pb = $('periods'); let n = 0;
  for (const [k,pp] of Object.entries(PERIODS)) {
    const b = document.createElement('button'); b.className = 'pd rise' + (k===state.period?' sel':''); b.type='button'; b.dataset.k = k; b.textContent = pp.t;
    b.style.animationDelay = (n++ * 60) + 'ms'; b.style.animation = 'rise .4s cubic-bezier(.16,1,.3,1) both';
    b.onclick = () => { document.querySelectorAll('.pd').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); state.period = k; };
    pb.appendChild(b);
  }
  const box = $('topics');
  for (const [k,t] of Object.entries(TOPICS)) {
    const b = document.createElement('button');
    b.className = 'tp rise'; b.type = 'button'; b.dataset.k = k;
    b.style.animationDelay = (n++ * 60) + 'ms'; b.style.animation = 'rise .4s cubic-bezier(.16,1,.3,1) both';
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
const FAN = { N:21, CX:160, CY:160, R:120 };
/* 사용자가 «원형 — 나를 둘러싼 카드» 를 골랐다(2026-09 옵션 10개 중 ⑥).
   부채(호)가 아니라 온전한 원 — 카드 21장이 빙 둘러싸고, 가운데가 «나» 자리다.
   치수는 실제 렌더된 #fan 박스에서 잰다 — 폰 폭에 따라 반지름이 달라진다 */
function readFan(){
  const box = $('fan').getBoundingClientRect();
  FAN.CX = box.width / 2; FAN.CY = box.height / 2;
  const ch = parseFloat(getComputedStyle($('fan')).getPropertyValue('--ch')) || 92;
  FAN.R = Math.min(box.width, box.height) / 2 - ch / 2 - 4;
}
function slotAng(i){ return (360 / FAN.N) * i; }              // 0 = 맨 위, 시계 방향
function slotXY(i){
  const a = (slotAng(i) - 90) * Math.PI / 180;
  return { x: FAN.CX + Math.cos(a) * FAN.R, y: FAN.CY + Math.sin(a) * FAN.R, rot: slotAng(i) };
}
let hot = -1;
function fanOut(){
  go('sFan'); readFan();
  state.deck = DECK.slice().sort(() => Math.random() - .5);
  state.fan = state.deck.slice(0, FAN.N);
  state.picks = []; hot = -1;
  const box = $('fan'); box.innerHTML = '';
  const center = document.createElement('div'); center.className = 'ring-center'; box.appendChild(center);
  const N = state.fan.length;
  state.fan.forEach((card, i) => {
    const s = document.createElement('div');
    s.className = 'slot'; s.dataset.i = i;
    s.appendChild(cardEl(null, false, false));
    /* «나» 자리(원 가운데)에서 팽이처럼 돌며 튀어나가 제자리를 찾는다.
       한 바퀴 뿌리듯 하나씩 늦게 — 카드를 던져 펼치는 손맛(2026-09 사용자 : 애니메이션 빡세게 · 느낌살게) */
    s.style.transform = `translate(calc(-50% + ${FAN.CX}px), calc(-50% + ${FAN.CY}px)) scale(.15) rotate(0deg)`;
    s.style.opacity = '0';
    s.style.zIndex = i;
    box.appendChild(s);
    setTimeout(() => {
      if (RM.matches) { s.style.opacity = '1'; s.style.transform = restT(i); return; }
      s.style.transition = 'transform .52s cubic-bezier(.34,1.5,.4,1), opacity .22s ease';
      s.style.opacity = '1';
      const p = slotXY(i);
      // 살짝 지나쳤다 돌아오는 오버슈트 — 목표 각도보다 한 바퀴 반 더 돌며 날아간다
      s.style.transform = `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px)) rotate(${p.rot + 540}deg) scale(1.16)`;
      setTimeout(() => {
        s.style.transition = 'transform .22s cubic-bezier(.2,.7,.3,1), opacity .3s ease, filter .2s';
        s.style.transform = restT(i);   // 정확한 각도로 스냅 — 540° 는 rot° 와 시각적으로 같은 자리
      }, 520);
    }, RM.matches ? 0 : 30 + i*42);
  });
  drawSlots();
}
function restT(i){ const p = slotXY(i); return `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px)) rotate(${p.rot}deg)`; }
function liftT(i){ const p = slotXY(i); return `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px)) rotate(${p.rot}deg) translateY(-15px) scale(1.14)`; }

/* 포인터 → 카드 번호. 원 안쪽(가운데 «나» 자리)이거나 너무 바깥이면 -1 */
function hitSlot(px, py){
  const r = $('fan').getBoundingClientRect();
  const dx = px - (r.left + FAN.CX), dy = py - (r.top + FAN.CY);
  const dist = Math.hypot(dx, dy);
  if (dist < FAN.R * 0.5 || dist > FAN.R * 1.5) return -1;
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI; if (ang < 0) ang += 360;
  const step = 360 / FAN.N;
  return Math.round(ang / step) % FAN.N;
}
function setHot(i){
  if (i === hot) return;
  const slots = $('fan').querySelectorAll('.slot');
  if (hot >= 0 && slots[hot] && !slots[hot].classList.contains('taken')) {
    slots[hot].style.zIndex = hot; slots[hot].style.transform = restT(hot);
    slots[hot].classList.remove('hot');
  }
  hot = i;
  if (i >= 0 && slots[i] && !slots[i].classList.contains('taken')) {
    slots[i].style.zIndex = 999; slots[i].style.transform = liftT(i);
    slots[i].classList.add('hot');
  }
}
function bindFan(){
  const box = $('fan');
  box.addEventListener('mousemove', e => setHot(hitSlot(e.clientX, e.clientY)));
  box.addEventListener('mouseleave', () => setHot(-1));
  box.addEventListener('click', e => { const i = hitSlot(e.clientX, e.clientY); if (i >= 0) pick(i); });
  box.addEventListener('touchstart', e => { const t = e.touches[0]; setHot(hitSlot(t.clientX, t.clientY)); }, { passive:true });
  /* 손가락을 뗄 때까지 «지금 어디 짚었는지» 를 계속 보여준다 — 밀어 보다가 마음에 드는 자리에서 떼면 그 카드로 뽑힌다.
     이게 빠져 있어서 겹친 카드 중 뭘 짚었는지 못 보고 찍듯이 고르는 문제가 있었다(2026-09 사용자 : 디테일하게 못 고른다) */
  box.addEventListener('touchmove', e => { const t = e.touches[0]; setHot(hitSlot(t.clientX, t.clientY)); }, { passive:true });
  box.addEventListener('touchend', e => { const t = e.changedTouches[0]; const i = hitSlot(t.clientX, t.clientY);
    setHot(-1); if (i >= 0) pick(i); }, { passive:true });
}
function drawSlots(){
  const pos = TOPICS[state.topic].pos, box = $('picked');
  box.innerHTML = pos.map((p,i) =>
    `<div class="pk${state.picks[i] ? ' on' : ''}" data-k="${i}"><span class="n">${i+1}</span>${p}<span class="mini"></span></div>`).join('');
  box.querySelectorAll('.pk.on').forEach(el => el.onclick = () => unpick(+el.dataset.k));
  const n = state.picks.length;
  $('fanHint').textContent = n < 3 ? `${3 - n}장 남았습니다` : '위 카드를 누르면 다시 고를 수 있습니다';
  $('reveal').hidden = n < 3;
}
/* 카드 하나가 «여기서 저기로» 날아간다. 부채 카드 자리에서 위 자리표로, 되돌릴 때는 반대로.
   실제 요소는 두지 않고 복제 카드 한 장을 fixed 로 띄워 옮긴 뒤 지운다 */
function fly(from, to, cb, spin){
  if (RM.matches || !from || !to) { cb && cb(); return; }
  const a = from.getBoundingClientRect(), z = to.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'card fly';
  el.innerHTML = '<div class="face back"></div>';
  el.style.left = a.left + 'px'; el.style.top = a.top + 'px'; el.style.width = a.width + 'px'; el.style.height = a.height + 'px';
  el.style.transition = 'transform .5s cubic-bezier(.2,.7,.3,1)';
  document.body.appendChild(el); void el.offsetWidth;
  const sx = z.width / a.width, sy = z.height / a.height;
  // 회전을 얹는다 — 고를 때(spin>0)는 한 바퀴 반 돌며 자리로, 되돌릴 때(spin<0)는 반대로 반 바퀴만(2026-09 애니메이션 강화)
  el.style.transform = `translate(${z.left - a.left}px, ${z.top - a.top}px) rotate(${(spin||0)}deg) scale(${sx}, ${sy})`;
  let done = false; const fin = () => { if (done) return; done = true; el.remove(); cb && cb(); };
  el.addEventListener('transitionend', fin, { once:true }); setTimeout(fin, 700);
}
function pick(i){
  const s = $('fan').querySelectorAll('.slot')[i];
  if (!s || state.picks.length >= 3 || s.classList.contains('taken')) return;
  if (hot === i) hot = -1;
  s.classList.remove('hot'); s.classList.add('taken');
  s.style.zIndex = i; s.style.transform = restT(i);
  const card = state.fan[i], k = state.picks.length;
  state.picks.push({ i, card, rev: Math.random() < 0.32 });
  const target = $('picked').querySelectorAll('.pk')[k];
  const mini = target && target.querySelector('.mini');
  fly(s, mini || target, () => drawSlots(), 540);   // 고를 때 한 바퀴 반
}
function unpick(k){
  const p = state.picks[k]; if (!p) return;
  const slotEl = $('picked').querySelectorAll('.pk')[k], mini = slotEl && slotEl.querySelector('.mini');
  const fanEl = $('fan').querySelectorAll('.slot')[p.i];
  state.picks.splice(k, 1);
  $('reveal').hidden = true;
  fly(mini || slotEl, fanEl, () => { if (fanEl) fanEl.classList.remove('taken'); drawSlots(); }, -270);   // 되돌릴 땐 반대로
  drawSlots();
}

/* ── 4. 해석 ── */
async function reveal(){
  go('sRes');
  const tp = TOPICS[state.topic], key = TOPIC_KEY[state.topic];
  $('resQ').textContent = state.q || '';
  $('resTp').textContent = PERIODS[state.period].t + ' ' + tp.t;

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
      <div class="msg"><p class="ab">${c.about[rev ? 1 : 0]}</p><p>${c.txt[key][rev ? 1 : 0]}</p></div></div>`;
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
  const pd = PERIODS[state.period].s, first = ps[0], mid = ps[1];
  lines.push(`${pd}${J(pd,'은','는')} <b>${first.card.name}</b>${J(first.card.name,'으로','로')} 열어서 <b>${ps[2].card.name}</b>${J(ps[2].card.name,'으로','로')} 마무리돼요. 진짜 신경 써야 할 건 가운데 <b>${mid.card.name}</b>${J(mid.card.name,'이','가')}예요.`);
  if (majors >= 2) lines.push(`메이저가 ${majors}장이나 나왔어요. 이쯤 되면 애쓰는 게 아니라 <b>흐름이 당신을 밀어주는 중</b>이에요.`);
  else if (majors === 1) lines.push(`메이저 한 장이 ${pd} <b>진짜 주인공</b>이에요. 나머지 둘은 곁다리로 봐도 돼요.`);
  else lines.push('셋 다 마이너예요. 극적인 사건 기대했으면 미안해요, 답은 <b>오늘의 사소한 일</b>에 있어요.');
  if (revs === 0) lines.push('역방향이 한 장도 없어요. <b>이번엔 대놓고 순조로워요</b>, 의심하지 말고 그냥 타요.');
  else if (revs === 3) lines.push('셋 다 역방향이에요. 오늘은 뭘 벌이지 말고 <b>정리하고 다지는 날</b>로 써요. 이런 날도 있어야 다음이 괜찮아요.');
  else lines.push(`역방향이 ${revs}장이에요. 전체적으로 나쁘지 않은데 딱 그 한 자리만 <b>손볼 게</b> 있어요.`);
  if (sameSuit) { const sk = SUITS[suits[0]].k; lines.push(`<b>${sk}</b>${J(sk,'이','가')} 두 장 이상 겹쳤어요. 지금 당신 인생, <b>${SUITS[suits[0]].f}</b> 쪽에 올인 중이에요.`); }
  const last = ps[2];
  lines.push(`결론만 말할게요. <b>${last.card.name}</b>${last.rev ? ' 역방향' : ''}. ${last.card.txt[key][last.rev?1:0]}`);

  $('sumBody').innerHTML = lines.map(l => '<p>' + l + '</p>').join('');
  countUp($('scoreV'), score, RM.matches ? 0 : 900);
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
function restart(){ state = { topic:null, period:'today', q:'', deck:[], fan:[], picks:[] };
  document.querySelectorAll('.tp').forEach(x => x.classList.remove('sel'));
  document.querySelectorAll('.pd').forEach(x => x.classList.toggle('sel', x.dataset.k==='today'));
  $('go').disabled = true; $('q').value = ''; go('sTopic'); }

window.addEventListener('DOMContentLoaded', () => {
  initTopics(); bindFan();
  $('go').onclick = () => { state.q = $('q').value.trim(); shuffle(); };
  $('again').onclick = restart;
  $('reveal').onclick = () => { if (state.picks.length === 3) reveal(); };
  $('redraw').onclick = () => shuffle();
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter' && !$('go').disabled) $('go').click(); });
});

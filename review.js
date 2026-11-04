/* 애원복지 웹진 - 수정 요청 모드
 * 주소 끝에 ?review=1 을 붙여 열면 화면 아래에 "수정 요청" 버튼이 나타납니다.
 * 요청은 구글 앱스크립트 웹앱(ENDPOINT)을 거쳐 구글 시트에 쌓입니다.
 */
(function () {
  var ENDPOINT = window.RV_ENDPOINT || ''; // 앱스크립트 웹앱 주소는 review-config.js 에 둡니다

  var params = new URLSearchParams(location.search);
  if (!params.has('review')) return;

  var ISSUE = (location.pathname.match(/vol(\d+)/) || [])[1] || '';
  var TYPES = ['오탈자', '문장 수정', '사진 교체', '사진 가림', '디자인', '기타'];
  var WHO = ['부장님', '관장님', '편집위원', '담당자', '기타'];
  var PICK = 'h2,h3,h4,p,li,.ph,th,td,dt,dd,figcaption,blockquote,.badge,.slogan,.vol,.t-t';

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 문단마다 위치 번호 붙이기 ---------- */
  var blocks = {};
  document.querySelectorAll('#cover, .sec').forEach(function (sec) {
    var n = 0;
    sec.querySelectorAll(PICK).forEach(function (el) {
      if (el.parentElement.closest('.ph')) return;
      if (el.matches('p') && el.closest('blockquote')) return;
      n++;
      var id = sec.id + '-' + n;
      el.dataset.rid = id;
      blocks[id] = el;
    });
  });
  function sectionOf(el) {
    var s = el.closest('#cover, .sec');
    if (!s) return '';
    if (s.id === 'cover') return '표지';
    var h = s.querySelector('h2');
    var k = s.querySelector('.kicker span');
    return (k ? k.textContent.trim() + ' · ' : '') + (h ? h.textContent.trim() : s.id);
  }
  function excerpt(el) {
    if (el.matches('.ph')) {
      var img = el.querySelector('img');
      return '[사진] ' + (img ? img.alt : '') + ' (' + (el.dataset.full || '').split('/').pop() + ')';
    }
    var t = el.textContent.replace(/\s+/g, ' ').trim();
    return t.length > 90 ? t.slice(0, 90) + '…' : t;
  }

  /* ---------- 화면 요소 ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.rv-bar{position:fixed;right:max(16px,calc(env(safe-area-inset-right,0px) + 12px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:70;display:flex;gap:8px;align-items:center}',
    '.rv-btn{font:inherit;font-family:var(--f-body);font-size:16px;font-weight:700;padding:12px 20px;border-radius:999px;border:0;background:var(--brick);color:#fff;cursor:pointer;box-shadow:0 6px 18px var(--shade)}',
    '.rv-btn.ghost{background:var(--card);color:var(--ink);border:1px solid var(--line);font-weight:400}',
    '.rv-top{position:fixed;left:0;right:0;top:0;z-index:69;padding:calc(10px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));background:var(--brick);color:#fff;text-align:center;font-size:16px;font-weight:700}',
    'body.rv-picking [data-rid]{cursor:pointer}',
    'body.rv-picking [data-rid]:hover,[data-rid].rv-sel{outline:3px dashed var(--amber);outline-offset:3px;border-radius:4px}',
    '[data-rid].rv-has{box-shadow:inset 4px 0 0 var(--amber)}',
    '.rv-sheet{position:fixed;left:0;right:0;bottom:0;z-index:80;background:var(--card);color:var(--ink);border-top:1px solid var(--line);box-shadow:0 -10px 30px var(--shade);border-radius:18px 18px 0 0;padding:18px max(16px,env(safe-area-inset-right,0px)) calc(18px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));max-height:82vh;overflow:auto;font-family:var(--f-body)}',
    '.rv-in{max-width:640px;margin:0 auto;display:grid;gap:12px}',
    '.rv-in h3{margin:0;font-size:18px;color:var(--brick)}',
    '.rv-quote{margin:0;padding:10px 12px;background:var(--paper-2);border-radius:10px;font-size:15px;line-height:1.6;color:var(--muted)}',
    '.rv-quote b{display:block;color:var(--rose);font-size:13px;margin-bottom:2px}',
    '.rv-label{font-size:14px;font-weight:700;color:var(--muted)}',
    '.rv-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.rv-chips button{font:inherit;font-size:15px;padding:6px 14px;border-radius:999px;border:1px solid var(--line);background:var(--paper);color:var(--ink);cursor:pointer}',
    '.rv-chips button[aria-pressed=true]{background:var(--moss);border-color:var(--moss);color:var(--paper);font-weight:700}',
    '.rv-in textarea{font:inherit;font-size:16px;min-height:110px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink);resize:vertical;width:100%;box-sizing:border-box}',
    '.rv-actions{display:flex;gap:8px;justify-content:flex-end}',
    '.rv-old{font-size:14px;display:grid;gap:6px}',
    '.rv-old div{padding:8px 10px;border-left:3px solid var(--amber);background:var(--paper);border-radius:6px}',
    '.rv-err{color:var(--rose);font-size:14px}'
  ].join('\n');
  document.head.appendChild(css);

  var bar = document.createElement('div');
  bar.className = 'rv-bar';
  bar.innerHTML = '<button type="button" class="rv-btn" id="rv-start">✎ 수정 요청</button>';
  document.body.appendChild(bar);
  var startBtn = bar.querySelector('#rv-start');

  var top = document.createElement('div');
  top.className = 'rv-top';
  top.hidden = true;
  top.textContent = '고칠 곳(문단·제목·사진)을 눌러 주세요';
  document.body.appendChild(top);

  var sheet = document.createElement('div');
  sheet.className = 'rv-sheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', '수정 요청 쓰기');
  document.body.appendChild(sheet);

  var toast = document.getElementById('toast');
  function say(m) { if (!toast) return alert(m); toast.textContent = m; toast.hidden = false; clearTimeout(say.t); say.t = setTimeout(function () { toast.hidden = true; }, 2200); }

  /* ---------- 고르기 모드 ---------- */
  var picking = false;
  function setPicking(on) {
    picking = on;
    document.body.classList.toggle('rv-picking', on);
    top.hidden = !on;
    startBtn.textContent = on ? '고르기 취소' : '✎ 수정 요청';
    startBtn.classList.toggle('ghost', on);
  }
  startBtn.addEventListener('click', function () { if (!sheet.hidden) return; setPicking(!picking); });

  document.addEventListener('click', function (e) {
    if (!picking) return;
    if (e.target.closest('.rv-bar, .rv-sheet, .side, .topbar')) return;
    var el = e.target.closest('[data-rid]');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    setPicking(false);
    openSheet(el);
  }, true);

  /* ---------- 요청 쓰기 ---------- */
  var existing = {};
  function openSheet(el) {
    document.querySelectorAll('.rv-sel').forEach(function (x) { x.classList.remove('rv-sel'); });
    el.classList.add('rv-sel');
    var id = el.dataset.rid, who = ls('rv-who') || '';
    var old = (existing[id] || []).map(function (r) { return '<div><b>' + esc(r.who) + '</b> · ' + esc(r.type) + ' · ' + esc(r.status) + '<br>' + esc(r.text) + '</div>'; }).join('');
    sheet.innerHTML =
      '<div class="rv-in">' +
      '<h3>수정 요청</h3>' +
      '<p class="rv-quote"><b>' + esc(sectionOf(el)) + '</b>' + esc(excerpt(el)) + '</p>' +
      (old ? '<div class="rv-old"><span class="rv-label">이미 들어온 요청</span>' + old + '</div>' : '') +
      '<span class="rv-label">요청하는 분</span><div class="rv-chips" id="rv-who">' + WHO.map(function (w) { return '<button type="button" aria-pressed="' + (w === who) + '">' + w + '</button>'; }).join('') + '</div>' +
      '<span class="rv-label">무엇을 고칠까요</span><div class="rv-chips" id="rv-type">' + TYPES.map(function (t, i) { return '<button type="button" aria-pressed="' + (i === 0) + '">' + t + '</button>'; }).join('') + '</div>' +
      '<label class="rv-label" for="rv-text">요청 내용</label>' +
      '<textarea id="rv-text" placeholder="예: ‘송공관광고’를 ‘송곡관광고’로 고쳐 주세요"></textarea>' +
      '<p class="rv-err" id="rv-err" hidden></p>' +
      '<div class="rv-actions"><button type="button" class="rv-btn ghost" id="rv-cancel">닫기</button><button type="button" class="rv-btn" id="rv-send">보내기</button></div>' +
      '</div>';
    sheet.hidden = false;
    bar.hidden = true;
    ['rv-who', 'rv-type'].forEach(function (gid) {
      sheet.querySelectorAll('#' + gid + ' button').forEach(function (b) {
        b.addEventListener('click', function () {
          sheet.querySelectorAll('#' + gid + ' button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
        });
      });
    });
    sheet.querySelector('#rv-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#rv-send').addEventListener('click', function () { send(el); });
    setTimeout(function () { sheet.querySelector('#rv-text').focus(); }, 50);
  }
  function closeSheet() {
    sheet.hidden = true;
    bar.hidden = false;
    document.querySelectorAll('.rv-sel').forEach(function (x) { x.classList.remove('rv-sel'); });
  }
  function picked(gid) { var b = sheet.querySelector('#' + gid + ' button[aria-pressed=true]'); return b ? b.textContent : ''; }

  function send(el) {
    var err = sheet.querySelector('#rv-err');
    var text = sheet.querySelector('#rv-text').value.trim();
    var who = picked('rv-who'), type = picked('rv-type');
    err.hidden = true;
    if (!who) { err.textContent = '요청하는 분을 골라 주세요.'; err.hidden = false; return; }
    if (!text) { err.textContent = '요청 내용을 적어 주세요.'; err.hidden = false; return; }
    if (!ENDPOINT) { err.textContent = '아직 접수 주소가 연결되지 않았습니다. 담당자에게 알려 주세요.'; err.hidden = false; return; }
    ls('rv-who', who);
    var btn = sheet.querySelector('#rv-send');
    btn.disabled = true; btn.textContent = '보내는 중…';
    var data = { issue: ISSUE, section: sectionOf(el), blockId: el.dataset.rid, excerpt: excerpt(el), type: type, text: text, who: who, page: location.href.split('?')[0] };
    fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) })
      .then(function () {
        (existing[data.blockId] = existing[data.blockId] || []).push({ who: who, type: type, text: text, status: '접수' });
        el.classList.add('rv-has');
        closeSheet();
        say('수정 요청을 보냈습니다. 감사합니다');
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = '보내기';
        err.textContent = '보내지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.'; err.hidden = false;
      });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!sheet.hidden) closeSheet(); else if (picking) setPicking(false); } });

  /* ---------- 이미 들어온 요청 표시 ---------- */
  if (ENDPOINT) {
    fetch(ENDPOINT + '?issue=' + encodeURIComponent(ISSUE))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        (d.items || []).forEach(function (r) {
          (existing[r.blockId] = existing[r.blockId] || []).push(r);
          if (blocks[r.blockId]) blocks[r.blockId].classList.add('rv-has');
        });
      })
      .catch(function () {});
  }
})();

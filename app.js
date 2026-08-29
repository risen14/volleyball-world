(function () {
  'use strict';

  let DATA = null;
  let genderFilter = 'all';
  let statusFilter = 'all';
  let compFilter = 'all';

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  const STATUS_TEXT = { live: '进行中', upcoming: '未开始', finished: '已结束' };
  const STATUS_CLASS = { live: 'pill-live', upcoming: 'pill-upcoming', finished: 'pill-finished' };

  function fmtFull(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
  }

  // 把 UTC 时间换算成北京时间（Asia/Shanghai，UTC+8）
  function fmtBeijing(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }

  function countdown(iso, status) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    if (status === 'live') return 'LIVE 进行中';
    if (status === 'finished') return '已结束';
    const diff = d.getTime() - Date.now();
    if (diff <= 0) return '即将开始';
    const s = Math.floor(diff / 1000);
    const dd = Math.floor(s / 86400);
    const hh = Math.floor((s % 86400) / 3600);
    const mm = Math.floor((s % 3600) / 60);
    if (dd > 0) return dd + '天' + hh + '小时后';
    if (hh > 0) return hh + '小时' + mm + '分后';
    if (mm > 0) return mm + '分钟后';
    return '不到1分钟';
  }

  function renderStats() {
    const m = DATA.matches;
    $('stat-live').textContent = m.filter(x => x.status === 'live').length;
    $('stat-upcoming').textContent = m.filter(x => x.status === 'upcoming').length;
    $('stat-men').textContent = m.filter(x => x.gender === 'men').length;
    $('stat-women').textContent = m.filter(x => x.gender === 'women').length;
  }

  function renderComps() {
    const strip = $('comp-strip');
    strip.innerHTML = '';
    const now = Date.now();
    const live = DATA.competitions.filter(c => {
      const s = new Date(c.startDate).getTime();
      const e = new Date(c.endDate).getTime();
      return s <= now && e >= now;
    });
    const all = [...live, ...DATA.competitions.filter(c => !live.includes(c))];
    for (const c of all) {
      const chip = document.createElement('span');
      chip.className = 'comp-chip' + (live.includes(c) ? ' live' : '');
      const tag = document.createElement('span');
      tag.className = 'chip-tag';
      tag.textContent = c.gender === 'men' ? '男排' : '女排';
      chip.appendChild(tag);
      chip.appendChild(document.createTextNode(c.shortName || c.name));
      if (live.includes(c)) {
        const l = document.createElement('span');
        l.className = 'chip-live';
        l.textContent = ' · LIVE';
        chip.appendChild(l);
      }
      strip.appendChild(chip);
    }
  }

  function renderFilters() {
    const sel = $('comp-filter');
    const cur = sel.value;
    const events = [...new Set(DATA.matches.map(m => m.event))];
    sel.innerHTML = '<option value="all">全部赛事</option>';
    for (const e of events) {
      const o = document.createElement('option');
      o.value = e; o.textContent = e;
      sel.appendChild(o);
    }
    sel.value = cur && [...sel.options].some(o => o.value === cur) ? cur : 'all';
    compFilter = sel.value;
  }

  function visible() {
    return DATA.matches.filter(m => {
      if (genderFilter !== 'all' && m.gender !== genderFilter) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (compFilter !== 'all' && m.event !== compFilter) return false;
      return true;
    });
  }

  function renderMatches() {
    const order = { live: 0, upcoming: 1, finished: 2 };
    const list = visible().slice().sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      const diff = new Date(a.datetime) - new Date(b.datetime);
      return a.status === 'finished' ? -diff : diff;
    });
    const box = $('match-list');
    box.innerHTML = '';
    $('empty').hidden = list.length > 0;

    for (const m of list) {
      const card = document.createElement('article');
      card.className = 'card g-' + m.gender;

      const head = document.createElement('div');
      head.className = 'card-head';
      const ev = document.createElement('span');
      ev.className = 'card-event';
      ev.textContent = m.eventShort || m.event;
      const pills = document.createElement('div');
      pills.style.cssText = 'display:flex;gap:6px;';
      const gp = document.createElement('span');
      gp.className = 'pill pill-gender';
      gp.textContent = m.gender === 'men' ? '男排' : '女排';
      const sp = document.createElement('span');
      sp.className = 'pill ' + STATUS_CLASS[m.status];
      sp.textContent = STATUS_TEXT[m.status];
      pills.appendChild(gp); pills.appendChild(sp);
      head.appendChild(ev); head.appendChild(pills);
      card.appendChild(head);

      if (m.round) {
        const round = document.createElement('div');
        round.className = 'card-round';
        round.style.marginBottom = '10px';
        round.textContent = m.round;
        card.appendChild(round);
      }

      const vs = document.createElement('div');
      vs.className = 'versus';
      vs.appendChild(teamEl(m.home));
      const mid = document.createElement('div');
      mid.className = 'mid';
      if (m.score) {
        const score = document.createElement('div');
        score.className = 'mid-score';
        score.innerHTML = esc(m.score.home) + ' <small>:</small> ' + esc(m.score.away);
        if (m.sets && m.sets.length) {
          const sets = document.createElement('small');
          sets.textContent = m.sets.join('  ');
          score.appendChild(sets);
        }
        mid.appendChild(score);
      } else {
        const vsL = document.createElement('div');
        vsL.className = 'mid-vs';
        vsL.textContent = 'VS';
        mid.appendChild(vsL);
      }
      const t = document.createElement('div');
      t.className = 'mid-time';
      t.textContent = countdown(m.datetime, m.status);
      mid.appendChild(t);
      vs.appendChild(mid);
      vs.appendChild(teamEl(m.away));
      card.appendChild(vs);

      const foot = document.createElement('div');
      foot.className = 'card-foot';
      const venue = document.createElement('span');
      venue.className = 'venue';
      venue.textContent = '📍 ' + (m.venue || '');
      const tl = document.createElement('span');
      tl.className = 'time-local';
      tl.textContent = '🕐 ' + fmtBeijing(m.datetime) + '（北京时间）';
      foot.appendChild(venue); foot.appendChild(tl);
      card.appendChild(foot);

      box.appendChild(card);
    }
  }

  function teamEl(team) {
    const el = document.createElement('div');
    el.className = 'team';
    el.innerHTML = '<span class="team-flag">' + esc(team.flag) + '</span><div class="team-country">' + esc(team.country) + '</div>';
    return el;
  }

  function renderMeta() {
    $('updated-at').textContent = fmtFull(DATA.updatedAt);
    $('next-update').textContent = fmtFull(DATA.nextUpdate);
    $('hero-competitions').textContent = DATA.competitions.length + ' 项赛事 · ' + DATA.matches.length + ' 场比赛';
    $('source-label').textContent = DATA.source;
    const dot = $('live-dot');
    dot.className = 'live-dot ' + (DATA.liveSource ? 'on' : 'err');
    $('live-dot-label').textContent = DATA.liveSource ? '官方接口已连接 · 每小时自动更新' : '官方接口暂不可达';
  }

  function renderAll() {
    renderStats(); renderComps(); renderFilters(); renderMatches(); renderMeta();
  }

  async function load() {
    try {
      const r = await fetch('data.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      DATA = await r.json();
      renderAll();
    } catch (e) {
      $('live-dot').className = 'live-dot err';
      $('live-dot-label').textContent = '加载失败：' + e.message;
    }
  }

  document.querySelectorAll('#gender-tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#gender-tabs .tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      genderFilter = btn.dataset.gender;
      renderMatches();
    });
  });
  $('status-filter').addEventListener('change', e => { statusFilter = e.target.value; renderMatches(); });
  $('comp-filter').addEventListener('change', e => { compFilter = e.target.value; renderMatches(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });

  load();
  setInterval(renderMatches, 1000); // 刷新倒计时
  setInterval(load, 10 * 60 * 1000); // 每 10 分钟同步一次
})();

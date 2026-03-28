/* ═══════════════════════════════════════════════════════
   NETLYZE — script.js
   Modular JS architecture:
   · Store     : Single source of truth
   · Graph     : D3.js force-directed visualisation
   · UI        : DOM rendering helpers
   · App       : Public API (called from HTML)
   · Init      : Bootstrap & demo seed
═══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════
   STORE — centralised state
══════════════════════════════════════ */
const Store = (() => {
  let users   = [];      // string[]
  let edges   = [];      // {a, b}[]
  let adjList = new Map(); // Map<string, Set<string>>

  // Activity log
  const MAX_ACTIVITY = 40;
  let activity = [];

  function _buildAdj() {
    adjList = new Map();
    users.forEach(u => adjList.set(u, new Set()));
    edges.forEach(({ a, b }) => {
      adjList.get(a)?.add(b);
      adjList.get(b)?.add(a);
    });
  }

  function addUser(name) {
    if (!name || users.includes(name)) return false;
    users.push(name);
    _buildAdj();
    _log('add', `<strong>${name}</strong> joined the network`);
    return true;
  }

  function removeUser(name) {
    users  = users.filter(u => u !== name);
    edges  = edges.filter(e => e.a !== name && e.b !== name);
    _buildAdj();
    _log('remove', `<strong>${name}</strong> removed from network`);
  }

  function addEdge(a, b) {
    if (!a || !b || a === b) return false;
    if (hasEdge(a, b)) return false;
    edges.push({ a, b });
    _buildAdj();
    _log('connect', `<strong>${a}</strong> connected to <strong>${b}</strong>`);
    return true;
  }

  function removeEdge(a, b) {
    if (!hasEdge(a, b)) return false;
    edges = edges.filter(e => !((e.a===a&&e.b===b)||(e.a===b&&e.b===a)));
    _buildAdj();
    _log('remove', `Connection between <strong>${a}</strong> and <strong>${b}</strong> removed`);
    return true;
  }

  function hasEdge(a, b) {
    return edges.some(e => (e.a===a&&e.b===b)||(e.a===b&&e.b===a));
  }

  function degree(name) {
    return adjList.get(name)?.size ?? 0;
  }

  function neighbours(name) {
    return [...(adjList.get(name) ?? [])];
  }

  /** BFS shortest path — returns path array or null */
  function bfs(src, dst) {
    if (src === dst) return [src];
    const visited = new Set([src]);
    const queue   = [[src]];
    while (queue.length) {
      const path = queue.shift();
      const node = path.at(-1);
      for (const nb of (adjList.get(node) ?? [])) {
        if (!visited.has(nb)) {
          const newPath = [...path, nb];
          if (nb === dst) return newPath;
          visited.add(nb);
          queue.push(newPath);
        }
      }
    }
    return null;
  }

  /** Count connected components */
  function countComponents() {
    const visited = new Set(); let count = 0;
    for (const u of users) {
      if (visited.has(u)) continue;
      count++;
      const q = [u];
      while (q.length) {
        const n = q.shift();
        if (visited.has(n)) continue;
        visited.add(n);
        (adjList.get(n) ?? new Set()).forEach(nb => { if (!visited.has(nb)) q.push(nb); });
      }
    }
    return count;
  }

  /** Graph density: 2E / V(V-1) */
  function density() {
    const V = users.length;
    return V < 2 ? 0 : (2 * edges.length) / (V * (V - 1));
  }

  /** Friend recommendations for a user */
  function recommendations(name) {
    const friends = adjList.get(name) ?? new Set();
    const scores  = new Map();
    friends.forEach(f => {
      (adjList.get(f) ?? new Set()).forEach(ff => {
        if (ff !== name && !friends.has(ff)) {
          const rec = scores.get(ff) ?? { count: 0, via: [] };
          if (!rec.via.includes(f)) { rec.count++; rec.via.push(f); }
          scores.set(ff, rec);
        }
      });
    });
    return [...scores.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([user, info]) => ({ user, ...info }));
  }

  function _log(type, html) {
    activity.unshift({ type, html, time: new Date() });
    if (activity.length > MAX_ACTIVITY) activity.pop();
  }

  function getUsers()    { return [...users]; }
  function getEdges()    { return [...edges]; }
  function getActivity() { return [...activity]; }
  function topByDegree(n = 10) {
    return [...users].sort((a, b) => degree(b) - degree(a)).slice(0, n);
  }

  return {
    addUser, removeUser, addEdge, removeEdge,
    hasEdge, degree, neighbours, bfs,
    countComponents, density, recommendations,
    getUsers, getEdges, getActivity, topByDegree,
    get userCount() { return users.length; },
    get edgeCount() { return edges.length; },
  };
})();

/* ══════════════════════════════════════
   COLOUR UTIL
══════════════════════════════════════ */
const PALETTE = [
  '#6366f1','#8b5cf6','#ec4899','#10b981',
  '#f59e0b','#3b82f6','#a78bfa','#06b6d4',
  '#f43f5e','#22d3ee','#84cc16','#fb923c',
];

function userColor(name) {
  const idx = Store.getUsers().indexOf(name);
  return PALETTE[((idx % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

/* ══════════════════════════════════════
   D3 GRAPH ENGINE
══════════════════════════════════════ */
const Graph = (() => {
  let svg = null, g = null, zoom = null;
  let simMain = null, simMini = null;
  let showLabels = true;
  let currentHighlight = new Set();

  const COLOR = {
    link:        () => getComputedStyle(document.documentElement).getPropertyValue('--border-md') || 'rgba(99,102,241,.2)',
    linkHL:      '#f59e0b',
    labelFill:   () => getComputedStyle(document.documentElement).getPropertyValue('--text-1') || '#f0f2ff',
  };

  /** Render main graph in #graph-container */
  function renderMain() {
    const container = document.getElementById('graph-container');
    if (!container) return;

    d3.select('#graph-container svg').remove();
    document.getElementById('graphPlaceholder').style.display =
      Store.userCount === 0 ? 'flex' : 'none';

    if (Store.userCount === 0) return;

    const W = container.clientWidth  || 900;
    const H = container.clientHeight || 520;

    svg = d3.select('#graph-container').append('svg');

    // Gradient defs for nodes
    const defs = svg.append('defs');
    Store.getUsers().forEach(name => {
      const col = userColor(name);
      const grd = defs.append('radialGradient')
        .attr('id', `ng-${CSS.escape(name)}`)
        .attr('cx', '35%').attr('cy', '35%');
      grd.append('stop').attr('offset', '0%').attr('stop-color', col).attr('stop-opacity', .9);
      grd.append('stop').attr('offset', '100%').attr('stop-color', col).attr('stop-opacity', .55);
    });

    g = svg.append('g');

    zoom = d3.zoom()
      .scaleExtent([0.15, 6])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);

    const nodes = Store.getUsers().map(id => ({ id }));
    const links = Store.getEdges().map(({ a, b }) => ({ source: a, target: b }));

    // Edges
    const linkSel = g.append('g').selectAll('line')
      .data(links).enter().append('line')
      .attr('class', 'g-link');

    // Nodes
    const nodeSel = g.append('g').selectAll('g')
      .data(nodes).enter().append('g')
      .attr('class', 'g-node')
      .call(
        d3.drag()
          .on('start', (e, d) => { if (!e.active) simMain.alphaTarget(.3).restart(); d.fx=d.x; d.fy=d.y; })
          .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end',   (e, d) => { if (!e.active) simMain.alphaTarget(0); d.fx=null; d.fy=null; })
      );

    const radii = n => 14 + Store.degree(n.id) * 2.8;

    nodeSel.append('circle')
      .attr('class', 'g-node-circle')
      .attr('r', radii)
      .attr('fill',   d => `url(#ng-${CSS.escape(d.id)})`)
      .attr('stroke', d => userColor(d.id));

    nodeSel.append('text')
      .attr('class', 'g-node-label')
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .style('display', showLabels ? '' : 'none')
      .text(d => d.id.length > 9 ? d.id.slice(0,8)+'…' : d.id);

    // Tooltip events
    const tooltip = document.getElementById('nodeTooltip');
    nodeSel
      .on('mouseenter', (e, d) => {
        const nb = Store.neighbours(d.id);
        document.getElementById('tt-name').textContent   = d.id;
        document.getElementById('tt-degree').textContent = nb.length;
        document.getElementById('tt-friends').textContent =
          nb.length ? 'Connected to: ' + nb.slice(0,5).join(', ') + (nb.length>5?'…':'') : '';
        tooltip.classList.remove('hidden');
        _positionTooltip(e, tooltip, container);
      })
      .on('mousemove', (e) => _positionTooltip(e, tooltip, container))
      .on('mouseleave', () => tooltip.classList.add('hidden'))
      .on('click', (e, d) => _highlightNode(d.id, nodeSel, linkSel));

    simMain = d3.forceSimulation(nodes)
      .force('link',    d3.forceLink(links).id(d => d.id).distance(120))
      .force('charge',  d3.forceManyBody().strength(-320))
      .force('center',  d3.forceCenter(W/2, H/2))
      .force('collide', d3.forceCollide(d => radii(d) + 8))
      .on('tick', () => {
        linkSel
          .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
      });
  }

  function _positionTooltip(e, el, container) {
    const rect = container.getBoundingClientRect();
    let x = e.clientX - rect.left + 14;
    let y = e.clientY - rect.top  - 20;
    if (x + 180 > rect.width)  x -= 194;
    if (y + 110 > rect.height) y -= 120;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
  }

  function _highlightNode(id, nodeSel, linkSel) {
    const nb = new Set(Store.neighbours(id));
    nb.add(id);
    nodeSel.classed('highlighted', d => nb.has(d.id));
    linkSel.classed('highlighted', d =>
      d.source.id === id || d.target.id === id
    );
    currentHighlight = nb;
  }

  /** Mini graph for dashboard panel */
  function renderMini() {
    const container = document.getElementById('mini-graph');
    if (!container) return;
    d3.select('#mini-graph svg').remove();
    if (Store.userCount === 0) return;

    const W = container.clientWidth  || 500;
    const H = container.clientHeight || 240;
    const miniSvg = d3.select('#mini-graph').append('svg');
    const gm = miniSvg.append('g');

    const nodes = Store.getUsers().map(id => ({ id }));
    const links = Store.getEdges().map(({ a, b }) => ({ source: a, target: b }));

    const linkM = gm.append('g').selectAll('line')
      .data(links).enter().append('line')
      .style('stroke', 'rgba(99,102,241,.18)')
      .style('stroke-width', 1.2);

    const nodeM = gm.append('g').selectAll('circle')
      .data(nodes).enter().append('circle')
      .attr('r', d => 7 + Store.degree(d.id) * 1.5)
      .attr('fill', d => userColor(d.id) + '88')
      .attr('stroke', d => userColor(d.id))
      .attr('stroke-width', 1.5);

    simMini = d3.forceSimulation(nodes)
      .force('link',    d3.forceLink(links).id(d => d.id).distance(60))
      .force('charge',  d3.forceManyBody().strength(-120))
      .force('center',  d3.forceCenter(W/2, H/2))
      .force('collide', d3.forceCollide(20))
      .on('tick', () => {
        linkM.attr('x1', d=>d.source.x).attr('y1', d=>d.source.y)
             .attr('x2', d=>d.target.x).attr('y2', d=>d.target.y);
        nodeM.attr('cx', d=>d.x).attr('cy', d=>d.y);
      });
  }

  function zoomIn()    { svg?.transition().call(zoom.scaleBy, 1.5); }
  function zoomOut()   { svg?.transition().call(zoom.scaleBy, 0.7); }
  function resetZoom() { svg?.transition().call(zoom.transform, d3.zoomIdentity.translate(0,0).scale(1)); }

  function toggleLabels() {
    showLabels = !showLabels;
    d3.selectAll('.g-node-label').style('display', showLabels ? '' : 'none');
    const btn = document.getElementById('labelToggle');
    if (btn) btn.classList.toggle('active-label', showLabels);
    return showLabels;
  }

  function highlightPath(path) {
    if (!path) return;
    const pathSet  = new Set(path);
    const edgeSet  = new Set();
    for (let i = 0; i < path.length - 1; i++) {
      edgeSet.add(`${path[i]}-${path[i+1]}`);
      edgeSet.add(`${path[i+1]}-${path[i]}`);
    }
    d3.selectAll('.g-node').classed('highlighted', d => pathSet.has(d.id));
    d3.selectAll('.g-link').classed('highlighted', d =>
      edgeSet.has(`${d.source.id}-${d.target.id}`)
    );
  }

  function clearHighlight() {
    d3.selectAll('.g-node').classed('highlighted', false);
    d3.selectAll('.g-link').classed('highlighted', false);
    currentHighlight.clear();
  }

  function renderAll() {
    renderMain();
    renderMini();
  }

  return { renderAll, renderMain, renderMini, zoomIn, zoomOut, resetZoom, toggleLabels, highlightPath, clearHighlight };
})();

/* ══════════════════════════════════════
   UI — DOM rendering helpers
══════════════════════════════════════ */
const UI = (() => {

  /* ── Toast ── */
  let toastTimer;
  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.innerHTML = `<span class="toast-dot"></span>${msg}`;
    el.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  /* ── Feedback msg ── */
  function setFeedback(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className   = `form-feedback ${type}`;
    if (msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 4000);
  }

  /* ── Animated counter ── */
  function animateVal(id, target, mono = true) {
    const el = document.getElementById(id);
    if (!el) return;
    const from = parseFloat(el.dataset.val ?? '0') || 0;
    el.dataset.val = target;
    let frame = 0;
    const STEPS = 24;
    const tick = () => {
      frame++;
      const val = from + (target - from) * (frame / STEPS);
      el.textContent = Number.isInteger(target) ? Math.round(val) : val.toFixed(1);
      if (frame < STEPS) requestAnimationFrame(tick);
      else el.textContent = target;
    };
    requestAnimationFrame(tick);
  }

  /* ── Dropdowns ── */
  function refreshDropdowns() {
    const users = Store.getUsers();
    const ids = ['connUser1','connUser2','remUser1','remUser2','path-src','path-dst','recUser'];
    ids.forEach(id => {
      const sel    = document.getElementById(id);
      if (!sel) return;
      const prev   = sel.value;
      const isRec  = id === 'recUser';
      sel.innerHTML = `<option value="">${isRec ? 'Select a user…' : '— Select —'}</option>`;
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        if (u === prev) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  }

  /* ── User list ── */
  function renderUserList(filter = '') {
    const ul    = document.getElementById('userList');
    const empty = document.getElementById('userListEmpty');
    const chip  = document.getElementById('userCountChip');
    if (!ul) return;

    const users = Store.getUsers();
    const shown = filter
      ? users.filter(u => u.toLowerCase().includes(filter.toLowerCase()))
      : users;

    chip.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
    document.getElementById('nb-users').textContent = users.length;
    empty.style.display = shown.length ? 'none' : '';
    ul.innerHTML = '';

    shown.forEach((name, i) => {
      const li = document.createElement('li');
      li.className = 'user-item';
      li.style.animationDelay = `${i * 0.04}s`;
      li.innerHTML = `
        <div class="user-avatar" style="background:${userColor(name)}">${initials(name)}</div>
        <div class="user-info">
          <div class="user-name">${_esc(name)}</div>
          <div class="user-meta">${Store.degree(name)} connection${Store.degree(name) !== 1 ? 's' : ''}</div>
        </div>
        <button class="list-remove-btn" onclick="App.removeUser('${_esc(name)}')" title="Remove user">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`;
      ul.appendChild(li);
    });
  }

  /* ── Edge list ── */
  function renderEdgeList() {
    const ul    = document.getElementById('edgeList');
    const empty = document.getElementById('edgeListEmpty');
    const chip  = document.getElementById('edgeCountChip');
    if (!ul) return;

    const edges = Store.getEdges();
    chip.textContent = `${edges.length} edge${edges.length !== 1 ? 's' : ''}`;
    document.getElementById('nb-edges').textContent = edges.length;
    empty.style.display = edges.length ? 'none' : '';
    ul.innerHTML = '';

    edges.forEach(({ a, b }, idx) => {
      const li = document.createElement('li');
      li.className = 'edge-item';
      li.innerHTML = `
        <div class="edge-pill">
          <span class="user-avatar" style="width:22px;height:22px;font-size:.6rem;background:${userColor(a)}">${initials(a)}</span>
          <span class="edge-name">${_esc(a)}</span>
          <span class="edge-sep">↔</span>
          <span class="user-avatar" style="width:22px;height:22px;font-size:.6rem;background:${userColor(b)}">${initials(b)}</span>
          <span class="edge-name">${_esc(b)}</span>
        </div>
        <button class="list-remove-btn" onclick="App.removeEdgeByIdx(${idx})" title="Remove edge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>`;
      ul.appendChild(li);
    });
  }

  /* ── Dashboard stats ── */
  function renderDashboard() {
    const V       = Store.userCount;
    const E       = Store.edgeCount;
    const d       = Store.density();
    const comps   = V ? Store.countComponents() : 0;
    const avg     = V ? (E * 2 / V).toFixed(1) : '0';
    const top     = V ? Store.topByDegree(1)[0] : null;

    // Stat values
    animateVal('sv-users', V, true);
    animateVal('sv-edges', E, true);
    document.getElementById('sv-inf').textContent =
      top ? top : '—';
    document.getElementById('sv-density').textContent = (d * 100).toFixed(1) + '%';
    document.getElementById('ss-density').textContent =
      `${comps} component${comps !== 1 ? 's' : ''} · avg ${avg} conn.`;
    document.getElementById('ss-inf').textContent =
      top ? `${Store.degree(top)} connections` : 'Highest degree centrality';

    // Progress bars
    const maxEdge = Math.max(1, V * (V - 1) / 2);
    document.getElementById('sb-users').style.width = Math.min(100, V * 8) + '%';
    document.getElementById('sb-edges').style.width = Math.min(100, (E / maxEdge) * 100) + '%';

    // Trend badges
    document.getElementById('st-users').textContent = `${V} total`;
    document.getElementById('st-edges').textContent = `${E} total`;
  }

  /* ── Activity feed ── */
  function renderActivity() {
    const ul = document.getElementById('activityList');
    if (!ul) return;
    const items = Store.getActivity();
    if (!items.length) {
      ul.innerHTML = '<li class="activity-empty">No activity yet. Start adding users!</li>';
      return;
    }
    ul.innerHTML = '';
    items.slice(0, 12).forEach(({ type, html, time }) => {
      const li = document.createElement('li');
      li.className = 'activity-item';
      const mins = Math.floor((Date.now() - time) / 60000);
      li.innerHTML = `
        <div class="activity-dot ${type}"></div>
        <div>
          <div class="activity-text">${html}</div>
          <div class="activity-time">${mins < 1 ? 'just now' : mins + 'm ago'}</div>
        </div>`;
      ul.appendChild(li);
    });
  }

  /* ── Influencer podium ── */
  function renderInfluencers() {
    const podium = document.getElementById('podium');
    const chart  = document.getElementById('centralityChart');
    const empty  = document.getElementById('podiumEmpty');
    if (!podium || !chart) return;

    const top = Store.topByDegree(10);
    const maxDeg = top.length ? Store.degree(top[0]) : 1;

    // Podium
    podium.innerHTML = '';
    if (!top.length || !Store.edgeCount) {
      podium.innerHTML = '<p class="list-empty" id="podiumEmpty">Add connections to detect influencers.</p>';
    } else {
      const medals = ['🥇','🥈','🥉'];
      const classes = ['rank-1','rank-2','rank-3'];
      const labels  = ['Top Influencer','2nd Place','3rd Place'];
      top.slice(0, 3).forEach((name, i) => {
        const card = document.createElement('div');
        card.className = `podium-card ${classes[i] ?? ''}`;
        card.style.animationDelay = `${i * 0.08}s`;
        card.innerHTML = `
          <div class="podium-medal">${medals[i] ?? '·'}</div>
          <div class="podium-avatar" style="background:${userColor(name)}">${initials(name)}</div>
          <div class="podium-info">
            <div class="podium-name">${_esc(name)}</div>
            <div class="podium-degree">${Store.degree(name)} connections</div>
          </div>
          <div class="podium-label">${labels[i] ?? ''}</div>`;
        podium.appendChild(card);
      });
    }

    // Centrality bar chart
    chart.innerHTML = '';
    if (!top.length) {
      chart.innerHTML = '<p class="list-empty">No data yet.</p>';
      return;
    }
    top.forEach(name => {
      const pct = maxDeg > 0 ? (Store.degree(name) / maxDeg) * 100 : 0;
      const row = document.createElement('div');
      row.className = 'cent-row';
      row.innerHTML = `
        <div class="cent-name" title="${name}">${name.length > 11 ? name.slice(0,10)+'…' : name}</div>
        <div class="cent-bar-wrap">
          <div class="cent-bar" style="width:0%" data-pct="${pct}"></div>
        </div>
        <div class="cent-val">${Store.degree(name)}</div>`;
      chart.appendChild(row);
    });
    // Animate bars
    requestAnimationFrame(() => {
      chart.querySelectorAll('.cent-bar').forEach(b => { b.style.width = b.dataset.pct + '%'; });
    });
  }

  /* ── Recommendations ── */
  function renderRecommendations(user) {
    const grid  = document.getElementById('recGrid');
    const empty = document.getElementById('recEmpty');
    if (!grid) return;
    grid.innerHTML = '';

    if (!user) {
      if (empty) { empty.style.display = ''; empty.textContent = 'Choose a user to see mutual-friend suggestions.'; }
      return;
    }
    const recs = Store.recommendations(user);
    if (!recs.length) {
      if (empty) { empty.style.display = ''; empty.textContent = `No suggestions for ${user} yet. Add more connections!`; }
      return;
    }
    if (empty) empty.style.display = 'none';
    recs.forEach(({ user: name, count, via }, i) => {
      const card = document.createElement('div');
      card.className = 'rec-card';
      card.style.animationDelay = `${i * 0.05}s`;
      card.innerHTML = `
        <div class="rec-user-row">
          <div class="rec-avatar" style="background:${userColor(name)}">${initials(name)}</div>
          <div class="rec-name">${_esc(name)}</div>
        </div>
        <div class="rec-mutual">🤝 ${count} mutual friend${count !== 1 ? 's' : ''}</div>
        <div class="rec-via">via ${via.join(', ')}</div>`;
      grid.appendChild(card);
    });
  }

  /* ── Adjacency matrix ── */
  function renderAdjMatrix() {
    const wrap = document.getElementById('adjMatrix');
    const hint = document.getElementById('adjHint');
    if (!wrap) return;
    const users = Store.getUsers();

    if (!users.length) {
      wrap.innerHTML = '<p class="list-empty">Add users to see the matrix.</p>';
      if (hint) hint.textContent = '';
      return;
    }
    const display = users.slice(0, 12);
    if (hint) hint.textContent = users.length > 12 ? `Showing 12 of ${users.length} users` : '';

    const table = document.createElement('table');
    table.className = 'adj-table';
    // Header
    const head = table.createTHead().insertRow();
    const th0 = document.createElement('th'); th0.textContent = ''; head.appendChild(th0);
    display.forEach(n => {
      const th = document.createElement('th');
      th.textContent = n.length > 7 ? n.slice(0,6)+'…' : n;
      th.title = n;
      head.appendChild(th);
    });
    // Body
    const tbody = table.createTBody();
    display.forEach(row => {
      const tr = tbody.insertRow();
      const th = document.createElement('th');
      th.textContent = row.length > 7 ? row.slice(0,6)+'…' : row;
      th.title = row;
      tr.appendChild(th);
      display.forEach(col => {
        const td = tr.insertCell();
        if (row === col) { td.textContent = '·'; td.className = 'adj-self'; }
        else { const c = Store.hasEdge(row, col); td.textContent = c ? '1' : '0'; if (c) td.className = 'adj-1'; }
      });
    });
    wrap.innerHTML = '';
    wrap.appendChild(table);
  }

  /* ── Breadcrumb ── */
  const VIEW_NAMES = {
    dashboard: 'Dashboard', graph: 'Graph View',
    users: 'Users', connections: 'Connections',
    analytics: 'Analytics', influencers: 'Influencers',
  };
  function setBreadcrumb(view) {
    const el = document.getElementById('breadcrumbCurrent');
    if (el) el.textContent = VIEW_NAMES[view] ?? view;
  }

  /* ── Global search (users) ── */
  function handleGlobalSearch(q) {
    if (!q) return;
    const match = Store.getUsers().find(u => u.toLowerCase().startsWith(q.toLowerCase()));
    if (match) {
      App.navigate('users');
      document.getElementById('userSearch').value = q;
      App.filterUsers();
    } else {
      toast(`No user found matching "${q}"`, 'error');
    }
  }

  /* ── Escape HTML ── */
  function _esc(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
    );
  }

  return {
    toast, setFeedback, refreshDropdowns,
    renderUserList, renderEdgeList, renderDashboard,
    renderActivity, renderInfluencers, renderRecommendations,
    renderAdjMatrix, setBreadcrumb, handleGlobalSearch,
  };
})();

/* ══════════════════════════════════════
   APP — public API (called from HTML)
══════════════════════════════════════ */
const App = (() => {

  let currentView = 'dashboard';

  /* ── Full re-render after any state change ── */
  function _sync() {
    UI.refreshDropdowns();
    UI.renderUserList();
    UI.renderEdgeList();
    UI.renderDashboard();
    UI.renderActivity();
    UI.renderInfluencers();
    UI.renderAdjMatrix();
    Graph.renderAll();
    // Update rec if visible
    const sel = document.getElementById('recUser');
    if (sel?.value) UI.renderRecommendations(sel.value);
  }

  /* ── Navigation ── */
  function navigate(view) {
    if (currentView === view) return;

    // Hide old, show new
    document.getElementById(`view-${currentView}`)?.classList.remove('active');
    document.getElementById(`view-${view}`)?.classList.add('active');

    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    currentView = view;
    UI.setBreadcrumb(view);

    // Lazy-render graph when switching to graph view
    if (view === 'graph') setTimeout(() => Graph.renderMain(), 50);
  }

  /* ── Users ── */
  function addUser() {
    const input = document.getElementById('userInput');
    const name  = input.value.trim();
    if (!name) { UI.setFeedback('userFeedback', '⚠ Please enter a name.', 'error'); return; }
    if (!/^[a-zA-Z0-9_ ]{1,24}$/.test(name)) {
      UI.setFeedback('userFeedback', '⚠ Letters, numbers, spaces, underscores only.', 'error'); return;
    }
    if (!Store.addUser(name)) {
      UI.setFeedback('userFeedback', `⚠ "${name}" already exists.`, 'error'); return;
    }
    input.value = '';
    UI.setFeedback('userFeedback', `✓ ${name} added!`, 'success');
    UI.toast(`"${name}" added to network`, 'success');
    _sync();
  }

  function addUserFromModal() {
    const input = document.getElementById('modalUserInput');
    const name  = input.value.trim();
    if (!name) { UI.setFeedback('modalFeedback', '⚠ Enter a name.', 'error'); return; }
    if (!Store.addUser(name)) {
      UI.setFeedback('modalFeedback', `⚠ Already exists.`, 'error'); return;
    }
    input.value = '';
    closeModal();
    UI.toast(`"${name}" added`, 'success');
    _sync();
  }

  function removeUser(name) {
    if (!confirm(`Remove "${name}" and all their connections?`)) return;
    Store.removeUser(name);
    UI.toast(`"${name}" removed`, 'error');
    _sync();
  }

  function filterUsers() {
    const q = document.getElementById('userSearch')?.value ?? '';
    UI.renderUserList(q);
  }

  /* ── Connections ── */
  function addConnection() {
    const a = document.getElementById('connUser1')?.value;
    const b = document.getElementById('connUser2')?.value;
    if (!a || !b) { UI.setFeedback('connFeedback', '⚠ Select both users.', 'error'); return; }
    if (a === b)  { UI.setFeedback('connFeedback', '⚠ Cannot self-connect.', 'error'); return; }
    if (!Store.addEdge(a, b)) {
      UI.setFeedback('connFeedback', '⚠ Connection already exists.', 'error'); return;
    }
    UI.setFeedback('connFeedback', `✓ ${a} ↔ ${b}`, 'success');
    UI.toast(`${a} ↔ ${b} connected`, 'success');
    _sync();
  }

  function removeConnection() {
    const a = document.getElementById('remUser1')?.value;
    const b = document.getElementById('remUser2')?.value;
    if (!a || !b) { UI.toast('Select both users.', 'error'); return; }
    if (!Store.removeEdge(a, b)) { UI.toast('Connection not found.', 'error'); return; }
    UI.toast(`${a} ↔ ${b} removed`, 'info');
    _sync();
  }

  function removeEdgeByIdx(idx) {
    const edges = Store.getEdges();
    if (!edges[idx]) return;
    const { a, b } = edges[idx];
    Store.removeEdge(a, b);
    UI.toast(`${a} ↔ ${b} removed`, 'info');
    _sync();
  }

  /* ── Graph controls ── */
  function zoomIn()    { Graph.zoomIn(); }
  function zoomOut()   { Graph.zoomOut(); }
  function resetZoom() { Graph.resetZoom(); }
  function toggleLabels() { Graph.toggleLabels(); }

  function findPath() {
    const src = document.getElementById('path-src')?.value;
    const dst = document.getElementById('path-dst')?.value;
    const el  = document.getElementById('pathResult');
    if (!el) return;
    if (!src || !dst) { UI.toast('Select source and target.', 'error'); return; }

    const path = Store.bfs(src, dst);
    el.className = 'path-result-banner';

    if (!path) {
      el.textContent = `No path between ${src} and ${dst}`;
      el.classList.add('error');
    } else if (src === dst) {
      el.textContent = 'Source = Target';
    } else {
      el.textContent = `Path (${path.length - 1} hops): ${path.join(' → ')}`;
    }
    el.classList.remove('hidden');
    if (path) Graph.highlightPath(path);
  }

  function clearPath() {
    const el = document.getElementById('pathResult');
    if (el) el.classList.add('hidden');
    Graph.clearHighlight();
  }

  /* ── Analytics ── */
  function showRecommendations() {
    const user = document.getElementById('recUser')?.value ?? '';
    UI.renderRecommendations(user);
  }

  /* ── Modal ── */
  function openModal() {
    document.getElementById('quickAddModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('modalUserInput')?.focus(), 50);
  }

  function closeModal() {
    document.getElementById('quickAddModal').classList.add('hidden');
    document.getElementById('modalFeedback').textContent = '';
  }

  /* ── Theme ── */
  function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    const btn = document.getElementById('themeToggle');
    const span = btn?.querySelector('.nav-text');
    if (span) span.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    // Re-render graph for new colours
    setTimeout(() => Graph.renderAll(), 100);
  }

  /* ── Demo seed ── */
  function seedDemo() {
    ['Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank','Iris','Jay']
      .forEach(n => Store.addUser(n));
    [['Alice','Bob'],['Alice','Carol'],['Alice','Dave'],['Alice','Eve'],
     ['Bob','Frank'],['Bob','Grace'],['Carol','Dave'],['Carol','Hank'],
     ['Dave','Eve'],['Eve','Frank'],['Frank','Grace'],['Grace','Iris'],
     ['Hank','Iris'],['Iris','Jay'],['Jay','Alice'],['Jay','Bob']]
      .forEach(([a,b]) => Store.addEdge(a,b));
    UI.toast('Demo network loaded — 10 users, 16 connections', 'success');
    _sync();
  }

  /* ── Auth ── */
  function _showApp() {
    const authEl = document.getElementById('authScreen');
    if (authEl) authEl.classList.add('hidden');
  }

  function login() {
    const email    = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value.trim();
    const feedback = document.getElementById('authFeedback');

    if (!email || !password) {
      if (feedback) { feedback.textContent = '⚠ Email and password are required.'; feedback.className = 'form-feedback error'; }
      return;
    }

    // Demo: bypass auth and open the app directly
    if (feedback) { feedback.textContent = '✓ Welcome back!'; feedback.className = 'form-feedback success'; }
    setTimeout(() => _showApp(), 600);
  }

  function register() {
    const name     = document.getElementById('authName')?.value.trim();
    const email    = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value.trim();
    const feedback = document.getElementById('authFeedback');

    if (!name || !email || !password) {
      if (feedback) { feedback.textContent = '⚠ All fields are required for registration.'; feedback.className = 'form-feedback error'; }
      return;
    }
    if (password.length < 6) {
      if (feedback) { feedback.textContent = '⚠ Password must be at least 6 characters.'; feedback.className = 'form-feedback error'; }
      return;
    }

    // Demo: auto-approve and open the app
    if (feedback) { feedback.textContent = `✓ Account created for ${name}!`; feedback.className = 'form-feedback success'; }
    // Update avatar initials
    const avatarEl = document.querySelector('.avatar-btn span');
    if (avatarEl) avatarEl.textContent = name.slice(0,1).toUpperCase();
    setTimeout(() => _showApp(), 700);
  }

  function skipAuth() {
    _showApp();
  }

  return {
    navigate, addUser, addUserFromModal, removeUser, filterUsers,
    addConnection, removeConnection, removeEdgeByIdx,
    zoomIn, zoomOut, resetZoom, toggleLabels,
    findPath, clearPath, showRecommendations,
    openModal, closeModal, toggleTheme, seedDemo,
    login, register, skipAuth,
  };
})();

/* ══════════════════════════════════════
   INIT — bootstrap on DOMContentLoaded
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Sidebar navigation ── */
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      App.navigate(btn.dataset.view);
      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('mobile-open');
    });
  });

  /* ── Sidebar collapse ── */
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  /* ── Mobile menu ── */
  document.getElementById('mobileMenu')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });

  /* ── Theme toggle ── */
  document.getElementById('themeToggle')?.addEventListener('click', App.toggleTheme);

  /* ── Quick add button ── */
  document.getElementById('addQuickBtn')?.addEventListener('click', App.openModal);

  /* ── Modal close on overlay click ── */
  document.getElementById('quickAddModal')?.addEventListener('click', e => {
    if (e.target.id === 'quickAddModal') App.closeModal();
  });

  /* ── Global search ── */
  const search = document.getElementById('globalSearch');
  if (search) {
    search.addEventListener('keydown', e => {
      if (e.key === 'Enter') UI.handleGlobalSearch(search.value.trim());
    });
    // ⌘K / Ctrl+K focus
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); search.focus(); search.select();
      }
    });
  }

  /* ── Enter keys on user/modal inputs ── */
  document.getElementById('userInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') App.addUser();
  });
  document.getElementById('modalUserInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') App.addUserFromModal();
  });

  /* ── Loader finish → show app ── */
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('app').classList.add('visible');

    // Initial render (empty state) then seed demo
    UI.refreshDropdowns();
    UI.renderDashboard();
    UI.renderActivity();
    UI.renderInfluencers();
    UI.renderAdjMatrix();

    // Seed after tiny delay so graph has dimensions
    setTimeout(() => App.seedDemo(), 180);
  }, 1500);

  /* ── Auth screen: close on Escape key ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const authEl = document.getElementById('authScreen');
      if (authEl && !authEl.classList.contains('hidden')) {
        authEl.classList.add('hidden');
      }
    }
  });
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => Graph.renderAll(), 250);
  });
});

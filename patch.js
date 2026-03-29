const fs = require('fs');
const path = require('path');

const scriptPath = path.join('c:', 'Users', 'vk010', 'OneDrive', 'Desktop', 'DMS PROJECT', 'script.js');
let content = fs.readFileSync(scriptPath, 'utf8');

// 1. Store State & Fetch
content = content.replace(
  `  let users   = [];      // string[]
  let edges   = [];      // {a, b}[]
  let adjList = new Map(); // Map<string, Set<string>>`,
  `  let users   = [];      // string[]
  let usersDict = {};    // name -> id
  let edges   = [];      // {a, b, id}[]
  let adjList = new Map(); // Map<string, Set<string>>

  async function fetchGraph() {
    try {
      const res = await fetch('http://localhost:5000/api/connections/graph');
      const { data } = await res.json();
      usersDict = {};
      users = data.nodes.map(n => {
        usersDict[n.name] = n.id;
        return n.name;
      });
      edges = data.edges.map(e => ({
        id: e.id,
        a: e.sourceName,
        b: e.targetName
      }));
      _buildAdj();
      if(typeof App !== 'undefined' && App._syncRaw) App._syncRaw();
    } catch(err) { console.error('Error fetching graph:', err); }
  }`
);

// 2. AddUser
content = content.replace(
  `  function addUser(name) {
    if (!name || users.includes(name)) return false;
    users.push(name);
    _buildAdj();
    _log('add', \`<strong>\${name}</strong> joined the network\`);
    return true;
  }`,
  `  async function addUser(name) {
    if (!name || users.includes(name)) return false;
    try {
      const res = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${localStorage.getItem('token')}\` },
        body: JSON.stringify({ name, email: name.replace(/\\s/g,'')+'@example.com', password: 'password123' })
      });
      const data = await res.json();
      if(data.success) {
        _log('add', \`<strong>\${name}</strong> joined the network\`);
        return true;
      } else {
        UI.toast(data.message || 'Error adding user', 'error');
        return false;
      }
    } catch(err) { return false; }
  }`
);

// 3. RemoveUser
content = content.replace(
  `  function removeUser(name) {
    users  = users.filter(u => u !== name);
    edges  = edges.filter(e => e.a !== name && e.b !== name);
    _buildAdj();
    _log('remove', \`<strong>\${name}</strong> removed from network\`);
  }`,
  `  async function removeUser(name) {
    const id = usersDict[name];
    if(!id) return;
    try {
      await fetch(\`http://localhost:5000/api/users/\${id}\`, {
        method: 'DELETE',
        headers: { Authorization: \`Bearer \${localStorage.getItem('token')}\` }
      });
      _log('remove', \`<strong>\${name}</strong> removed from network\`);
    } catch(err) {}
  }`
);

// 4. AddEdge
content = content.replace(
  `  function addEdge(a, b) {
    if (!a || !b || a === b) return false;
    if (hasEdge(a, b)) return false;
    edges.push({ a, b });
    _buildAdj();
    _log('connect', \`<strong>\${a}</strong> connected to <strong>\${b}</strong>\`);
    return true;
  }`,
  `  async function addEdge(a, b) {
    if (!a || !b || a === b) return false;
    if (hasEdge(a, b)) return false;
    const u1 = usersDict[a]; const u2 = usersDict[b];
    if(!u1 || !u2) return false;
    try {
      const res = await fetch('http://localhost:5000/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${localStorage.getItem('token')}\` },
        body: JSON.stringify({ user1: u1, user2: u2 })
      });
      if((await res.json()).success) {
        _log('connect', \`<strong>\${a}</strong> connected to <strong>\${b}</strong>\`);
        return true;
      }
    } catch(err) {}
    return false;
  }`
);

// 5. RemoveEdge
content = content.replace(
  `  function removeEdge(a, b) {
    if (!hasEdge(a, b)) return false;
    edges = edges.filter(e => !((e.a===a&&e.b===b)||(e.a===b&&e.b===a)));
    _buildAdj();
    _log('remove', \`Connection between <strong>\${a}</strong> and <strong>\${b}</strong> removed\`);
    return true;
  }`,
  `  async function removeEdge(a, b) {
    const edge = edges.find(e => (e.a===a&&e.b===b)||(e.a===b&&e.b===a));
    if(!edge) return false;
    try {
      await fetch(\`http://localhost:5000/api/connections/\${edge.id}\`, {
        method: 'DELETE',
        headers: { Authorization: \`Bearer \${localStorage.getItem('token')}\` }
      });
      _log('remove', \`Connection between <strong>\${a}</strong> and <strong>\${b}</strong> removed\`);
      return true;
    } catch(err) {}
    return false;
  }`
);

// 6. Store Exports
content = content.replace(
  `    addUser, removeUser, addEdge, removeEdge,`,
  `    fetchGraph, usersDict,\n    addUser, removeUser, addEdge, removeEdge,`
);

// 7. App._syncRaw and mutations await
content = content.replace(
  `  function _sync() {`,
  `  function _syncRaw() {
    UI.refreshDropdowns();
    UI.renderUserList();
    UI.renderEdgeList();
    UI.renderDashboard();
    UI.renderActivity();
    UI.renderInfluencers();
    UI.renderAdjMatrix();
    Graph.renderAll();
    const sel = document.getElementById('recUser');
    if (sel?.value) UI.renderRecommendations(sel.value);
  }

  function _sync() {`
);

content = content.replace(
  `  function addUser() {
    const input = document.getElementById('userInput');
    const name  = input.value.trim();
    if (!name) { UI.setFeedback('userFeedback', '⚠ Please enter a name.', 'error'); return; }
    if (!/^[a-zA-Z0-9_ ]{1,24}$/.test(name)) {
      UI.setFeedback('userFeedback', '⚠ Letters, numbers, spaces, underscores only.', 'error'); return;
    }
    if (!Store.addUser(name)) {
      UI.setFeedback('userFeedback', \`⚠ "\${name}" already exists.\`, 'error'); return;
    }
    input.value = '';
    UI.setFeedback('userFeedback', \`✓ \${name} added!\`, 'success');
    UI.toast(\`"\${name}" added to network\`, 'success');
    _sync();
  }`,
  `  async function addUser() {
    const input = document.getElementById('userInput');
    const name  = input.value.trim();
    if (!name) { UI.setFeedback('userFeedback', '⚠ Please enter a name.', 'error'); return; }
    if (!/^[a-zA-Z0-9_ ]{1,24}$/.test(name)) {
      UI.setFeedback('userFeedback', '⚠ Letters, numbers, spaces, underscores only.', 'error'); return;
    }
    const res = await Store.addUser(name);
    if (!res) return; // handled by store toaster
    input.value = '';
    UI.setFeedback('userFeedback', \`✓ \${name} added!\`, 'success');
  }`
);

content = content.replace(
  `  function addUserFromModal() {
    const input = document.getElementById('modalUserInput');
    const name  = input.value.trim();
    if (!name) { UI.setFeedback('modalFeedback', '⚠ Enter a name.', 'error'); return; }
    if (!Store.addUser(name)) {
      UI.setFeedback('modalFeedback', \`⚠ Already exists.\`, 'error'); return;
    }
    input.value = '';
    closeModal();
    UI.toast(\`"\${name}" added\`, 'success');
    _sync();
  }`,
  `  async function addUserFromModal() {
    const input = document.getElementById('modalUserInput');
    const name  = input.value.trim();
    if (!name) { UI.setFeedback('modalFeedback', '⚠ Enter a name.', 'error'); return; }
    const res = await Store.addUser(name);
    if (!res) return;
    input.value = '';
    closeModal();
    UI.toast(\`"\${name}" added\`, 'success');
  }`
);

content = content.replace(
  `  function removeUser(name) {
    if (!confirm(\`Remove "\${name}" and all their connections?\`)) return;
    Store.removeUser(name);
    UI.toast(\`"\${name}" removed\`, 'error');
    _sync();
  }`,
  `  async function removeUser(name) {
    if (!confirm(\`Remove "\${name}" and all their connections?\`)) return;
    await Store.removeUser(name);
    UI.toast(\`"\${name}" removed\`, 'error');
  }`
);

content = content.replace(
  `  function addConnection() {
    const a = document.getElementById('connUser1')?.value;
    const b = document.getElementById('connUser2')?.value;
    if (!a || !b) { UI.setFeedback('connFeedback', '⚠ Select both users.', 'error'); return; }
    if (a === b)  { UI.setFeedback('connFeedback', '⚠ Cannot self-connect.', 'error'); return; }
    if (!Store.addEdge(a, b)) {
      UI.setFeedback('connFeedback', '⚠ Connection already exists.', 'error'); return;
    }
    UI.setFeedback('connFeedback', \`✓ \${a} ↔ \${b}\`, 'success');
    UI.toast(\`\${a} ↔ \${b} connected\`, 'success');
    _sync();
  }`,
  `  async function addConnection() {
    const a = document.getElementById('connUser1')?.value;
    const b = document.getElementById('connUser2')?.value;
    if (!a || !b) { UI.setFeedback('connFeedback', '⚠ Select both users.', 'error'); return; }
    if (a === b)  { UI.setFeedback('connFeedback', '⚠ Cannot self-connect.', 'error'); return; }
    const res = await Store.addEdge(a, b);
    if (!res) {
      UI.setFeedback('connFeedback', '⚠ Failed to add connection.', 'error'); return;
    }
    UI.setFeedback('connFeedback', \`✓ \${a} ↔ \${b}\`, 'success');
  }`
);

content = content.replace(
  `  function removeConnection() {
    const a = document.getElementById('remUser1')?.value;
    const b = document.getElementById('remUser2')?.value;
    if (!a || !b) { UI.toast('Select both users.', 'error'); return; }
    if (!Store.removeEdge(a, b)) { UI.toast('Connection not found.', 'error'); return; }
    UI.toast(\`\${a} ↔ \${b} removed\`, 'info');
    _sync();
  }`,
  `  async function removeConnection() {
    const a = document.getElementById('remUser1')?.value;
    const b = document.getElementById('remUser2')?.value;
    if (!a || !b) { UI.toast('Select both users.', 'error'); return; }
    await Store.removeEdge(a, b);
    UI.toast(\`\${a} ↔ \${b} removed\`, 'info');
  }`
);

content = content.replace(
  `  function removeEdgeByIdx(idx) {
    const edges = Store.getEdges();
    if (!edges[idx]) return;
    const { a, b } = edges[idx];
    Store.removeEdge(a, b);
    UI.toast(\`\${a} ↔ \${b} removed\`, 'info');
    _sync();
  }`,
  `  async function removeEdgeByIdx(idx) {
    const edges = Store.getEdges();
    if (!edges[idx]) return;
    const { a, b } = edges[idx];
    await Store.removeEdge(a, b);
    UI.toast(\`\${a} ↔ \${b} removed\`, 'info');
  }`
);

// 8. Authentication Rewrite
content = content.replace(
  `  function login() {
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
  }`,
  `  async function login() {
    const email    = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value.trim();
    const feedback = document.getElementById('authFeedback');

    if (!email || !password) {
      if (feedback) { feedback.textContent = '⚠ Email and password are required.'; feedback.className = 'form-feedback error'; }
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if(data.success) {
        localStorage.setItem('token', data.data.token);
        if (feedback) { feedback.textContent = '✓ Welcome back!'; feedback.className = 'form-feedback success'; }
        setTimeout(() => _showApp(), 600);
      } else {
        if (feedback) { feedback.textContent = '⚠ ' + data.message; feedback.className = 'form-feedback error'; }
      }
    } catch(e) {
      if (feedback) { feedback.textContent = '⚠ Server error'; feedback.className = 'form-feedback error'; }
    }
  }`
);

content = content.replace(
  `  function register() {
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
    if (feedback) { feedback.textContent = \`✓ Account created for \${name}!\`; feedback.className = 'form-feedback success'; }
    // Update avatar initials
    const avatarEl = document.querySelector('.avatar-btn span');
    if (avatarEl) avatarEl.textContent = name.slice(0,1).toUpperCase();
    setTimeout(() => _showApp(), 700);
  }`,
  `  async function register() {
    const name     = document.getElementById('authName')?.value.trim();
    const email    = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value.trim();
    const feedback = document.getElementById('authFeedback');

    if (!name || !email || !password) {
      if (feedback) { feedback.textContent = '⚠ All fields are required for registration.'; feedback.className = 'form-feedback error'; }
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if(data.success) {
        localStorage.setItem('token', data.data.token);
        if (feedback) { feedback.textContent = \`✓ Account created for \${name}!\`; feedback.className = 'form-feedback success'; }
        const avatarEl = document.querySelector('.avatar-btn span');
        if (avatarEl) avatarEl.textContent = name.slice(0,1).toUpperCase();
        setTimeout(() => _showApp(), 600);
      } else {
        if (feedback) { feedback.textContent = '⚠ ' + data.message; feedback.className = 'form-feedback error'; }
      }
    } catch(e) {
      if (feedback) { feedback.textContent = '⚠ Server error'; feedback.className = 'form-feedback error'; }
    }
  }`
);

// 9. Exports for App
content = content.replace(
  `    login, register, skipAuth,`,
  `    login, register, skipAuth, _syncRaw,`
);

// 10. Init / Socket connection
content = content.replace(
  `    // Seed after tiny delay so graph has dimensions
    setTimeout(() => App.seedDemo(), 180);
  }, 1500);`,
  `    // Initial fetch from backend instead of seed demo
    Store.fetchGraph();

    if (window.io) {
      const socket = window.io('http://localhost:5000');
      socket.on('graphUpdated', (payload) => {
        console.log('Real-time update:', payload);
        UI.toast(payload.message, 'info');
        Store.fetchGraph();
      });
    }

  }, 1500);`
);

// Disable seedDemo functionality if used
content = content.replace(
  `  function seedDemo() {
    ['Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank','Iris','Jay']
      .forEach(n => Store.addUser(n));
    [['Alice','Bob'],['Alice','Carol'],['Alice','Dave'],['Alice','Eve'],
     ['Bob','Frank'],['Bob','Grace'],['Carol','Dave'],['Carol','Hank'],
     ['Dave','Eve'],['Eve','Frank'],['Frank','Grace'],['Grace','Iris'],
     ['Hank','Iris'],['Iris','Jay'],['Jay','Alice'],['Jay','Bob']]
      .forEach(([a,b]) => Store.addEdge(a,b));
    UI.toast('Demo network loaded — 10 users, 16 connections', 'success');
    _sync();
  }`,
  `  function seedDemo() {
    UI.toast('Seed demo disabled in live DB mode', 'info');
  }`
);

fs.writeFileSync(scriptPath, content);
console.log('Patched script.js!');

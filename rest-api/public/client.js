(function () {
  'use strict';

  // DOM Elements
  const methodBtns = document.querySelectorAll('.method-btn');
  const selectedMethodTag = document.getElementById('selectedMethodTag');
  const methodHint = document.getElementById('methodHint');
  const endpointInput = document.getElementById('endpointInput');
  const headersInput = document.getElementById('headersInput');
  const bodyGroup = document.getElementById('bodyGroup');
  const bodyInput = document.getElementById('bodyInput');
  const btnSendRequest = document.getElementById('btnSendRequest');
  const latencyBadge = document.getElementById('latencyBadge');
  const resourceCountBadge = document.getElementById('resourceCountBadge');
  const productsTableBody = document.getElementById('productsTableBody');
  const lastWireBox = document.getElementById('lastWireBox');
  const logStream = document.getElementById('logStream');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnRefreshDb = document.getElementById('btnRefreshDb');
  const btnResetDb = document.getElementById('btnResetDb');

  // Quick create fields
  const quickName = document.getElementById('quickName');
  const quickPrice = document.getElementById('quickPrice');
  const quickCat = document.getElementById('quickCat');
  const btnQuickCreate = document.getElementById('btnQuickCreate');

  let currentMethod = 'GET';
  let lastReceivedETag = null;

  const METHOD_INFO = {
    GET: { hint: 'GET is <strong>Safe</strong> & <strong>Idempotent</strong>. Retrieves resource representation without modifying server state.', tagClass: 'tag-get' },
    POST: { hint: 'POST is <strong>Non-Idempotent</strong>. Creates a subordinate resource or performs state transitions. Usually returns 201 Created.', tagClass: 'tag-post' },
    PUT: { hint: 'PUT is <strong>Idempotent</strong>. Completely replaces or creates the target resource at the exact URI.', tagClass: 'tag-put' },
    PATCH: { hint: 'PATCH applies partial modifications to a resource. It may or may not be idempotent.', tagClass: 'tag-patch' },
    DELETE: { hint: 'DELETE is <strong>Idempotent</strong>. Deletes the target resource. Subsequent requests return 404 or 204.', tagClass: 'tag-delete' }
  };

  // Switch Method
  methodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      methodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMethod = btn.dataset.method;
      selectedMethodTag.textContent = currentMethod;
      selectedMethodTag.className = `badge-tag ${METHOD_INFO[currentMethod].tagClass}`;
      methodHint.innerHTML = METHOD_INFO[currentMethod].hint;

      if (currentMethod === 'GET' || currentMethod === 'DELETE') {
        bodyGroup.style.display = 'none';
      } else {
        bodyGroup.style.display = 'flex';
      }
    });
  });

  // Execute HTTP Request
  async function executeRequest() {
    const url = endpointInput.value.trim();
    if (!url) return;

    const startTime = performance.now();
    const reqHeaders = { 'Accept': 'application/json' };

    // Parse custom headers
    const headerLines = headersInput.value.trim().split('\n');
    headerLines.forEach(line => {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const k = line.substring(0, idx).trim();
        const v = line.substring(idx + 1).trim();
        if (k && v) reqHeaders[k] = v;
      }
    });

    const options = {
      method: currentMethod,
      headers: reqHeaders
    };

    if (currentMethod !== 'GET' && currentMethod !== 'DELETE' && bodyInput.value.trim()) {
      reqHeaders['Content-Type'] = 'application/json';
      options.body = bodyInput.value.trim();
    }

    try {
      const res = await fetch(url, options);
      const elapsed = Math.round(performance.now() - startTime);
      latencyBadge.textContent = `${elapsed} ms`;

      // Extract ETag
      const etag = res.headers.get('etag');
      if (etag) lastReceivedETag = etag;

      let bodyText = '';
      if (res.status !== 204 && res.status !== 304) {
        bodyText = await res.text();
      }

      // Format Wire Output
      const wireHeaders = [];
      res.headers.forEach((v, k) => {
        wireHeaders.push(`${k}: ${v}`);
      });

      const wireOutput = [
        `HTTP/1.1 ${res.status} ${res.statusText}`,
        wireHeaders.join('\n'),
        '',
        bodyText ? formatJsonString(bodyText) : '/* No content body */'
      ].join('\n');

      lastWireBox.textContent = wireOutput;

      // Add log
      addLogEntry(currentMethod, url, res.status, res.statusText, elapsed, bodyText.length);

      // Refresh table on mutations
      if (currentMethod !== 'GET') {
        loadProducts();
      }
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      lastWireBox.textContent = `Fetch Error: ${err.message}`;
      addLogEntry(currentMethod, url, 0, 'Connection Failed', elapsed, 0);
    }
  }

  function formatJsonString(str) {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch (e) {
      return str;
    }
  }

  // Load products list for Column 2
  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const result = await res.json();
        const items = result.data || [];
        resourceCountBadge.textContent = items.length;
        renderProducts(items);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  function renderProducts(items) {
    productsTableBody.innerHTML = '';
    if (items.length === 0) {
      productsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Database is empty.</td></tr>';
      return;
    }

    items.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: var(--accent-cyan); font-weight: bold;">#${p.id}</td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td><span class="chip" style="font-size: 0.7rem;">${escapeHtml(p.category)}</span></td>
        <td style="color: var(--accent-green);">$${p.price.toFixed(2)}</td>
        <td>${p.stock}</td>
        <td style="white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="window.restApp.inspectItem(${p.id})">GET</button>
          <button class="btn btn-secondary btn-sm" onclick="window.restApp.patchPrice(${p.id}, ${p.price})">+$5</button>
          <button class="btn btn-danger btn-sm" onclick="window.restApp.deleteItem(${p.id})">DEL</button>
        </td>
      `;
      productsTableBody.appendChild(tr);
    });
  }

  function addLogEntry(method, url, status, statusText, ms, bytes) {
    const card = document.createElement('div');
    let statusClass = 'status-2xx';
    if (status >= 300 && status < 400) statusClass = 'status-3xx';
    else if (status >= 400 && status < 500) statusClass = 'status-4xx';
    else if (status >= 500 || status === 0) statusClass = 'status-5xx';

    card.className = `log-card ${statusClass}`;
    card.innerHTML = `
      <div class="log-meta">
        <span><strong>${method}</strong> ${escapeHtml(url)}</span>
        <span>${new Date().toLocaleTimeString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="font-weight: bold;">${status} ${statusText}</span>
        <span style="color: var(--text-muted);">${ms}ms • ${bytes} bytes</span>
      </div>
    `;

    logStream.insertBefore(card, logStream.firstChild);
    while (logStream.children.length > 25) {
      logStream.removeChild(logStream.lastChild);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  // Presets
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      switch (preset) {
        case 'list':
          selectMethod('GET');
          endpointInput.value = '/api/products';
          headersInput.value = '';
          bodyInput.value = '';
          break;
        case 'filter':
          selectMethod('GET');
          endpointInput.value = '/api/products?category=Infrastructure';
          headersInput.value = '';
          break;
        case 'create':
          selectMethod('POST');
          endpointInput.value = '/api/products';
          bodyInput.value = JSON.stringify({
            name: 'Dedicated GPU Worker',
            category: 'Machine Learning',
            price: 189.00,
            stock: 10
          }, null, 2);
          break;
        case 'update':
          selectMethod('PATCH');
          endpointInput.value = '/api/products/1';
          bodyInput.value = JSON.stringify({
            price: 54.99,
            stock: 110
          }, null, 2);
          break;
        case 'replace':
          selectMethod('PUT');
          endpointInput.value = '/api/products/2';
          bodyInput.value = JSON.stringify({
            name: 'Managed Redis Cluster',
            category: 'Database',
            price: 65.00,
            stock: 80,
            status: 'active'
          }, null, 2);
          break;
        case 'notfound':
          selectMethod('GET');
          endpointInput.value = '/api/products/9999';
          headersInput.value = '';
          break;
        case 'etag':
          selectMethod('GET');
          endpointInput.value = '/api/products/1';
          headersInput.value = lastReceivedETag ? `If-None-Match: ${lastReceivedETag}` : 'If-None-Match: "dummy-etag"';
          break;
      }
      executeRequest();
    });
  });

  function selectMethod(method) {
    const btn = Array.from(methodBtns).find(b => b.dataset.method === method);
    if (btn) btn.click();
  }

  // Quick Action Helpers
  window.restApp = {
    inspectItem(id) {
      selectMethod('GET');
      endpointInput.value = `/api/products/${id}`;
      executeRequest();
    },
    patchPrice(id, oldPrice) {
      selectMethod('PATCH');
      endpointInput.value = `/api/products/${id}`;
      bodyInput.value = JSON.stringify({ price: parseFloat((oldPrice + 5).toFixed(2)) }, null, 2);
      executeRequest();
    },
    async deleteItem(id) {
      if (!confirm(`Are you sure you want to DELETE product #${id}?`)) return;
      selectMethod('DELETE');
      endpointInput.value = `/api/products/${id}`;
      await executeRequest();
    }
  };

  // Quick Create Form
  btnQuickCreate.addEventListener('click', async () => {
    const name = quickName.value.trim();
    const price = parseFloat(quickPrice.value);
    const category = quickCat.value.trim() || 'General';

    if (!name || isNaN(price)) {
      alert('Please enter a product name and valid numeric price.');
      return;
    }

    selectMethod('POST');
    endpointInput.value = '/api/products';
    bodyInput.value = JSON.stringify({ name, price, category, stock: 25 }, null, 2);
    quickName.value = '';
    quickPrice.value = '';
    quickCat.value = '';
    await executeRequest();
  });

  // Buttons
  btnSendRequest.addEventListener('click', executeRequest);
  btnClearLogs.addEventListener('click', () => { logStream.innerHTML = ''; });
  btnRefreshDb.addEventListener('click', loadProducts);
  btnResetDb.addEventListener('click', async () => {
    await fetch('/api/reset', { method: 'POST' });
    loadProducts();
    addLogEntry('POST', '/api/reset', 200, 'OK', 1, 0);
  });

  // Init
  loadProducts();
})();

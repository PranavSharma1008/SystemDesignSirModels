(function () {
  'use strict';

  // DOM Elements
  const queryInput = document.getElementById('queryInput');
  const variablesInput = document.getElementById('variablesInput');
  const btnExecute = document.getElementById('btnExecute');
  const resultBox = document.getElementById('resultBox');
  const wireDetailsBox = document.getElementById('wireDetailsBox');
  const latencyBadge = document.getElementById('latencyBadge');
  const resolverCountBadge = document.getElementById('resolverCountBadge');
  const restSizeLabel = document.getElementById('restSizeLabel');
  const graphqlSizeLabel = document.getElementById('graphqlSizeLabel');
  const bandwidthBar = document.getElementById('bandwidthBar');
  const savingsText = document.getElementById('savingsText');
  const logStream = document.getElementById('logStream');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnApplyFields = document.getElementById('btnApplyFields');

  // Checkboxes
  const chkId = document.getElementById('chkId');
  const chkName = document.getElementById('chkName');
  const chkRole = document.getElementById('chkRole');
  const chkEmail = document.getElementById('chkEmail');
  const chkStatus = document.getElementById('chkStatus');
  const chkAvatar = document.getElementById('chkAvatar');
  const chkPosts = document.getElementById('chkPosts');

  let totalResolvers = 0;

  // Default query on load
  const DEFAULT_QUERY = `query GetUserProfile {
  user(id: "1") {
    id
    name
    role
    status
    posts {
      id
      title
      likes
    }
  }
}`;

  queryInput.value = DEFAULT_QUERY;

  // Generate query based on checkboxes
  function buildQueryFromCheckboxes() {
    const fields = [];
    if (chkId.checked) fields.push('    id');
    if (chkName.checked) fields.push('    name');
    if (chkRole.checked) fields.push('    role');
    if (chkEmail.checked) fields.push('    email');
    if (chkStatus.checked) fields.push('    status');
    if (chkAvatar.checked) fields.push('    avatar');
    if (chkPosts.checked) {
      fields.push('    posts {\n      id\n      title\n      likes\n    }');
    }

    if (fields.length === 0) fields.push('    id');

    queryInput.value = `query GetCustomUserFields {
  user(id: "1") {
${fields.join('\n')}
  }
}`;
  }

  btnApplyFields.addEventListener('click', () => {
    buildQueryFromCheckboxes();
    executeGraphQL();
  });

  // Execute GraphQL Query
  async function executeGraphQL() {
    const query = queryInput.value.trim();
    if (!query) return;

    let variables = null;
    const varText = variablesInput.value.trim();
    if (varText) {
      try {
        variables = JSON.parse(varText);
      } catch (err) {
        alert('Invalid JSON in Query Variables');
        return;
      }
    }

    const payload = { query, variables };
    const jsonBody = JSON.stringify(payload);
    const startTime = performance.now();

    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: jsonBody
      });

      const elapsed = Math.round(performance.now() - startTime);
      latencyBadge.textContent = `${elapsed} ms`;

      const responseText = await res.text();
      const responseBytes = new Blob([responseText]).size;

      // Update wire inspector
      wireDetailsBox.textContent = `POST /graphql HTTP/1.1\nContent-Type: application/json\nContent-Length: ${jsonBody.length} bytes\n\nPayload:\n${jsonBody}`;

      // Pretty format result
      let parsed;
      try {
        parsed = JSON.parse(responseText);
        resultBox.textContent = JSON.stringify(parsed, null, 2);
      } catch (e) {
        resultBox.textContent = responseText;
      }

      // Estimate REST comparison
      // In REST, a full user + posts response is ~1,200 bytes
      const restEquivalentBytes = 1250;
      restSizeLabel.textContent = `${restEquivalentBytes} bytes (REST)`;
      graphqlSizeLabel.textContent = `${responseBytes} bytes (GraphQL)`;

      const percentageOfRest = Math.min(100, Math.round((responseBytes / restEquivalentBytes) * 100));
      bandwidthBar.style.width = `${percentageOfRest}%`;

      const saved = Math.max(0, 100 - percentageOfRest);
      savingsText.textContent = `Bandwidth Saved vs REST: ~${saved}%`;

      totalResolvers += (query.match(/\{/g) || []).length * 2;
      resolverCountBadge.textContent = totalResolvers;

      // Log Entry
      const isMutation = query.trim().startsWith('mutation');
      addLogEntry(isMutation ? 'MUTATION' : 'QUERY', elapsed, responseBytes, !parsed.errors);
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      resultBox.textContent = `Execution Error: ${err.message}`;
      addLogEntry('ERROR', elapsed, 0, false);
    }
  }

  function addLogEntry(type, ms, bytes, success) {
    const card = document.createElement('div');
    card.className = 'log-card';
    if (!success) card.style.borderLeftColor = 'var(--accent-rose)';

    card.innerHTML = `
      <div class="log-meta">
        <span style="font-weight: bold; color: ${type === 'MUTATION' ? 'var(--accent-amber)' : 'var(--accent-pink)'};">${type}</span>
        <span>${new Date().toLocaleTimeString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: ${success ? 'var(--accent-green)' : 'var(--accent-rose)'};">${success ? 'SUCCESS (200 OK)' : 'FAILED'}</span>
        <span style="color: var(--text-muted);">${ms}ms • ${bytes} bytes</span>
      </div>
    `;

    logStream.insertBefore(card, logStream.firstChild);
    while (logStream.children.length > 20) {
      logStream.removeChild(logStream.lastChild);
    }
  }

  // Presets
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      variablesInput.value = '';

      switch (preset) {
        case 'overfetch':
          // Minimal fields: demonstrates solving over-fetching
          queryInput.value = `query SolveOverFetching {
  user(id: "1") {
    name
  }
}`;
          break;

        case 'underfetch':
          // Nested relations in one single network round trip
          queryInput.value = `query SolveUnderFetching {
  user(id: "1") {
    name
    email
    posts {
      title
      likes
      comments {
        text
        authorName
      }
    }
  }
}`;
          break;

        case 'mutation':
          queryInput.value = `mutation AddNewPost {
  createPost(
    title: "Building Microservices with gRPC and GraphQL"
    content: "Why modern engineering stacks combine multiple RPC protocols."
    authorId: "1"
  ) {
    id
    title
    author {
      name
    }
  }
}`;
          break;

        case 'like':
          queryInput.value = `mutation LikePost {
  likePost(id: "101") {
    id
    title
    likes
  }
}`;
          break;

        case 'metrics':
          queryInput.value = `query GetServerTelemetry {
  metrics {
    uptimeSeconds
    heapUsedMB
    resolversExecuted
    timestamp
  }
}`;
          break;

        case 'schema':
          queryInput.value = `query IntrospectTypes {
  schemaSDL
}`;
          break;
      }

      executeGraphQL();
    });
  });

  btnExecute.addEventListener('click', executeGraphQL);
  btnClearLogs.addEventListener('click', () => { logStream.innerHTML = ''; });

  // Initial execution
  executeGraphQL();
})();

(function () {
  'use strict';

  // DOM Elements
  const protoBox = document.getElementById('protoBox');
  const hexDumpBox = document.getElementById('hexDumpBox');
  const jsonBytesLabel = document.getElementById('jsonBytesLabel');
  const protoBytesLabel = document.getElementById('protoBytesLabel');
  const rpcModeBtns = document.querySelectorAll('.rpc-mode-btn');
  const btnTriggerRpc = document.getElementById('btnTriggerRpc');
  const rpcOutputBox = document.getElementById('rpcOutputBox');
  const trailerStatus = document.getElementById('trailerStatus');
  const trailerMsg = document.getElementById('trailerMsg');
  const h2FrameBox = document.getElementById('h2FrameBox');
  const latencyBadge = document.getElementById('latencyBadge');
  const savingsBadge = document.getElementById('savingsBadge');
  const logStream = document.getElementById('logStream');
  const btnClearLogs = document.getElementById('btnClearLogs');

  let activeMode = 'unary';
  let activeEventSource = null;

  // Load .proto definition
  async function loadProtoFile() {
    try {
      const res = await fetch('/api/proto');
      if (res.ok) {
        const text = await res.text();
        protoBox.textContent = text;
      }
    } catch (e) {
      protoBox.textContent = '// Failed to load .proto schema';
    }
  }

  // RPC Mode Selection
  rpcModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rpcModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMode = btn.dataset.mode;
      rpcOutputBox.textContent = `// Ready to invoke: ${btn.querySelector('.rpc-mode-title').textContent}`;
    });
  });

  // Execute RPC
  async function invokeRpc() {
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }

    const startTime = performance.now();

    switch (activeMode) {
      case 'unary':
        await invokeUnary(startTime);
        break;
      case 'server-stream':
        invokeServerStream(startTime);
        break;
      case 'client-stream':
        await invokeClientStream(startTime);
        break;
      case 'bidi-stream':
        await invokeBidiStream(startTime);
        break;
    }
  }

  // 1. Unary RPC
  async function invokeUnary(startTime) {
    rpcOutputBox.textContent = 'Invoking Unary RPC: GetSystemStats()...';
    try {
      const res = await fetch('/grpc/telemetry.TelemetryService/GetSystemStats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Grpc-Web': '1'
        },
        body: JSON.stringify({ clientId: 'browser-client-01', includeHardware: true })
      });

      const elapsed = Math.round(performance.now() - startTime);
      latencyBadge.textContent = `${elapsed} ms`;

      const result = await res.json();
      rpcOutputBox.textContent = JSON.stringify(result.data, null, 2);

      // Display binary hex
      if (result.protobuf) {
        hexDumpBox.textContent = result.protobuf.binaryHex;
        protoBytesLabel.textContent = `${result.protobuf.byteLength} bytes (Protobuf)`;
        jsonBytesLabel.textContent = `${result.protobuf.jsonEquivalentLength} bytes (JSON)`;
        savingsBadge.textContent = result.protobuf.savingsPercent;
      }

      trailerStatus.textContent = `${result.grpcStatus} (OK)`;
      trailerMsg.textContent = result.grpcMessage;

      // HTTP/2 frame display
      h2FrameBox.textContent = [
        `[Stream #1] HEADERS frame: :method=POST, :path=/grpc/.../GetSystemStats, content-type=application/grpc`,
        `[Stream #1] DATA frame: ${result.protobuf.byteLength} bytes payload`,
        `[Stream #1] HEADERS frame (Trailers): grpc-status=0, grpc-message=OK [END_STREAM]`
      ].join('\n');

      addLogEntry('UNARY RPC', 'GetSystemStats()', elapsed, result.protobuf.byteLength, 0);
    } catch (err) {
      rpcOutputBox.textContent = `Unary Error: ${err.message}`;
      addLogEntry('UNARY RPC', 'Error', 0, 0, 14);
    }
  }

  // 2. Server Streaming RPC
  function invokeServerStream(startTime) {
    rpcOutputBox.textContent = 'Opening Server Streaming RPC: StreamMetrics()...\nListening for incoming metric packets...\n';

    activeEventSource = new EventSource('/grpc/telemetry.TelemetryService/StreamMetrics');

    h2FrameBox.textContent = `[Stream #3] HEADERS frame: :path=.../StreamMetrics\n[Stream #3] Continuous DATA frames multiplexed...`;

    activeEventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.done) {
        rpcOutputBox.textContent += `\n✅ [Server Stream Ended] grpc-status: 0 (OK)`;
        activeEventSource.close();
        activeEventSource = null;
        return;
      }

      hexDumpBox.textContent = parsed.protoHex;
      protoBytesLabel.textContent = `${parsed.protoBytes} bytes`;
      rpcOutputBox.textContent += `\n[Stream #3 Packet ${parsed.sequence}] ${parsed.packet.metricName}: ${parsed.packet.value}`;
      rpcOutputBox.scrollTop = rpcOutputBox.scrollHeight;

      addLogEntry('SERVER STREAM', `Packet #${parsed.sequence}`, 12, parsed.protoBytes, 0);
    };

    activeEventSource.onerror = () => {
      if (activeEventSource) activeEventSource.close();
      activeEventSource = null;
    };
  }

  // 3. Client Streaming RPC
  async function invokeClientStream(startTime) {
    rpcOutputBox.textContent = 'Streaming 5 metric packets to server (Client Streaming: UploadBatchMetrics)...';

    const batch = [
      { metricName: 'cpu_temp', value: 48.2 },
      { metricName: 'cpu_temp', value: 49.5 },
      { metricName: 'cpu_temp', value: 51.1 },
      { metricName: 'cpu_temp', value: 50.3 },
      { metricName: 'cpu_temp', value: 48.9 }
    ];

    try {
      const res = await fetch('/grpc/telemetry.TelemetryService/UploadBatchMetrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packets: batch })
      });

      const elapsed = Math.round(performance.now() - startTime);
      const result = await res.json();

      rpcOutputBox.textContent = `Client streamed ${batch.length} DATA frames to Stream #5.\n\nServer Batch Summary Response:\n` + JSON.stringify(result.summary, null, 2);

      hexDumpBox.textContent = result.protobuf.binaryHex;
      protoBytesLabel.textContent = `${result.protobuf.byteLength} bytes`;

      h2FrameBox.textContent = [
        `[Stream #5] Client sent 5 DATA frames`,
        `[Stream #5] Server returned 1 DATA frame (Summary)`,
        `[Stream #5] grpc-status=0 (OK)`
      ].join('\n');

      addLogEntry('CLIENT STREAM', 'UploadBatchMetrics()', elapsed, result.protobuf.byteLength, 0);
    } catch (e) {
      rpcOutputBox.textContent = `Client Stream Error: ${e.message}`;
    }
  }

  // 4. Bidirectional Streaming RPC
  async function invokeBidiStream(startTime) {
    rpcOutputBox.textContent = 'Simulating Bidirectional Stream (Stream #7): LiveChannel()...\nClient sent packet ➔ Server echoed processed packet:';

    try {
      const res = await fetch('/grpc/telemetry.TelemetryService/LiveChannel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricName: 'bidi_sync_pulse', value: 100 })
      });

      const elapsed = Math.round(performance.now() - startTime);
      const result = await res.json();

      rpcOutputBox.textContent += '\n' + JSON.stringify(result.packet, null, 2);
      hexDumpBox.textContent = result.protoHex;
      protoBytesLabel.textContent = `${result.protoBytes} bytes`;

      h2FrameBox.textContent = `[Stream #7 BIDI] Full-duplex simultaneous HTTP/2 stream\nClient & Server interleaved frames without blocking`;

      addLogEntry('BIDI STREAM', 'LiveChannel()', elapsed, result.protoBytes, 0);
    } catch (e) {
      rpcOutputBox.textContent = `Bidi Error: ${e.message}`;
    }
  }

  function addLogEntry(type, method, ms, bytes, status) {
    const card = document.createElement('div');
    card.className = 'log-card';

    card.innerHTML = `
      <div class="log-meta">
        <span style="font-weight: bold; color: var(--accent-cyan);">${type}</span>
        <span>${new Date().toLocaleTimeString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>${method} (grpc-status: ${status})</span>
        <span style="color: var(--text-muted);">${ms}ms • ${bytes} bytes</span>
      </div>
    `;

    logStream.insertBefore(card, logStream.firstChild);
    while (logStream.children.length > 20) {
      logStream.removeChild(logStream.lastChild);
    }
  }

  btnTriggerRpc.addEventListener('click', invokeRpc);
  btnClearLogs.addEventListener('click', () => { logStream.innerHTML = ''; });

  // Init
  loadProtoFile();
  invokeRpc();
})();

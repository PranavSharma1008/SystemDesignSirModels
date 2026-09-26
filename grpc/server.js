const http = require('http');
const fs = require('fs');
const path = require('path');
const protobuf = require('protobufjs');

const PORT = process.env.PORT || 5002;
const PUBLIC_DIR = path.join(__dirname, 'public');
const PROTO_PATH = path.join(__dirname, 'proto', 'telemetry.proto');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.proto': 'text/plain; charset=utf-8'
};

let protoRoot = null;
let StatsRequestType = null;
let StatsResponseType = null;
let MetricPacketType = null;
let BatchSummaryType = null;

// Initialize Protobuf types
async function initProtobuf() {
  protoRoot = await protobuf.load(PROTO_PATH);
  StatsRequestType = protoRoot.lookupType('telemetry.StatsRequest');
  StatsResponseType = protoRoot.lookupType('telemetry.StatsResponse');
  MetricPacketType = protoRoot.lookupType('telemetry.MetricPacket');
  BatchSummaryType = protoRoot.lookupType('telemetry.BatchSummary');
  console.log('✅ Protobuf Schema (proto3) successfully compiled and loaded.');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Grpc-Web, grpc-timeout, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'grpc-status, grpc-message, X-Protobuf-Bytes, X-Json-Bytes, X-Savings-Percent');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Raw Proto File download
  if (pathname === '/api/proto') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    fs.createReadStream(PROTO_PATH).pipe(res);
    return;
  }

  // 1. Unary RPC: /grpc/telemetry.TelemetryService/GetSystemStats
  if (pathname === '/grpc/telemetry.TelemetryService/GetSystemStats' && method === 'POST') {
    const startHr = process.hrtime();
    const rawBuffer = await parseBody(req);

    let clientReq = {};
    if (rawBuffer.length > 0) {
      try {
        clientReq = JSON.parse(rawBuffer.toString('utf-8'));
      } catch (_) {
        try {
          clientReq = StatsRequestType.decode(rawBuffer);
        } catch (e) {}
      }
    }

    const payload = {
      serverId: 'grpc-worker-node-us-east-1a',
      uptimeSeconds: Math.floor(process.uptime()),
      cpuUtilization: parseFloat((15 + Math.random() * 25).toFixed(2)),
      memoryUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      clusterRegion: 'ap-south-1 (Mumbai Cluster)',
      status: 'SERVING'
    };

    // Serialize using Protobuf Binary
    const errMsg = StatsResponseType.verify(payload);
    if (errMsg) throw new Error(errMsg);
    const message = StatsResponseType.create(payload);
    const protoBuffer = StatsResponseType.encode(message).finish();

    // Equivalent JSON representation
    const jsonBuffer = Buffer.from(JSON.stringify(payload));
    const savings = (((jsonBuffer.length - protoBuffer.length) / jsonBuffer.length) * 100).toFixed(1);

    const [diffSec, diffNano] = process.hrtime(startHr);
    const latencyMs = (diffSec * 1000 + diffNano / 1e6).toFixed(2);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('grpc-status', '0');
    res.setHeader('grpc-message', 'OK');
    res.setHeader('X-Protobuf-Bytes', String(protoBuffer.length));
    res.setHeader('X-Json-Bytes', String(jsonBuffer.length));
    res.setHeader('X-Savings-Percent', `${savings}%`);

    res.writeHead(200);
    res.end(JSON.stringify({
      grpcStatus: 0,
      grpcMessage: 'OK',
      executionTimeMs: latencyMs,
      data: payload,
      protobuf: {
        binaryHex: protoBuffer.toString('hex').match(/.{1,2}/g).join(' '),
        byteLength: protoBuffer.length,
        jsonEquivalentLength: jsonBuffer.length,
        savingsPercent: `${savings}%`
      },
      http2Simulation: {
        streamId: 1,
        frames: [
          { type: 'HEADERS', stream: 1, flags: 'END_HEADERS', pseudoHeaders: { ':status': 200, 'content-type': 'application/grpc' } },
          { type: 'DATA', stream: 1, flags: '0x0', length: protoBuffer.length, desc: 'Protobuf payload buffer' },
          { type: 'HEADERS', stream: 1, flags: 'END_STREAM, END_HEADERS', trailers: { 'grpc-status': '0', 'grpc-message': 'OK' } }
        ]
      }
    }, null, 2));
    return;
  }

  // 2. Server Streaming RPC: /grpc/telemetry.TelemetryService/StreamMetrics
  if (pathname === '/grpc/telemetry.TelemetryService/StreamMetrics') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'grpc-status': '0'
    });

    let count = 0;
    const interval = setInterval(() => {
      count++;
      const packet = {
        metricName: 'kernel_context_switches_sec',
        value: parseFloat((2500 + Math.sin(count * 0.5) * 800 + Math.random() * 100).toFixed(1)),
        timestamp: Date.now(),
        sourceNode: 'node_alpha_h2'
      };

      const msg = MetricPacketType.create(packet);
      const buf = MetricPacketType.encode(msg).finish();
      const hex = buf.toString('hex').match(/.{1,2}/g).join(' ');

      const data = JSON.stringify({
        sequence: count,
        packet,
        protoHex: hex,
        protoBytes: buf.length,
        streamId: 3
      });

      res.write(`data: ${data}\n\n`);

      if (count >= 10) {
        clearInterval(interval);
        res.write(`data: ${JSON.stringify({ done: true, grpcStatus: 0, grpcMessage: 'STREAM_COMPLETED' })}\n\n`);
        res.end();
      }
    }, 1000);

    req.on('close', () => clearInterval(interval));
    return;
  }

  // 3. Client Streaming RPC: /grpc/telemetry.TelemetryService/UploadBatchMetrics
  if (pathname === '/grpc/telemetry.TelemetryService/UploadBatchMetrics' && method === 'POST') {
    const rawBuffer = await parseBody(req);
    const body = JSON.parse(rawBuffer.toString('utf-8'));
    const packets = body.packets || [];

    const values = packets.map(p => p.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? sum / values.length : 0;
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;

    const summary = {
      totalPackets: packets.length,
      averageValue: parseFloat(avg.toFixed(2)),
      minValue: parseFloat(min.toFixed(2)),
      maxValue: parseFloat(max.toFixed(2)),
      elapsedMs: 24,
      status: 'BATCH_AGGREGATED'
    };

    const msg = BatchSummaryType.create(summary);
    const protoBuf = BatchSummaryType.encode(msg).finish();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'grpc-status': '0',
      'grpc-message': 'OK'
    });
    res.end(JSON.stringify({
      grpcStatus: 0,
      grpcMessage: 'OK',
      summary,
      protobuf: {
        binaryHex: protoBuf.toString('hex').match(/.{1,2}/g).join(' '),
        byteLength: protoBuf.length
      },
      http2Simulation: {
        streamId: 5,
        type: 'Client Streaming (N Requests -> 1 Response)'
      }
    }, null, 2));
    return;
  }

  // 4. Bidirectional Streaming RPC: /grpc/telemetry.TelemetryService/LiveChannel
  if (pathname === '/grpc/telemetry.TelemetryService/LiveChannel' && method === 'POST') {
    const rawBuffer = await parseBody(req);
    const body = JSON.parse(rawBuffer.toString('utf-8'));

    const echoPacket = {
      metricName: `ACK_${body.metricName || 'metric'}`,
      value: (body.value || 0) * 1.05,
      timestamp: Date.now(),
      sourceNode: 'grpc_server_bidi_ack'
    };

    const msg = MetricPacketType.create(echoPacket);
    const buf = MetricPacketType.encode(msg).finish();

    res.writeHead(200, { 'Content-Type': 'application/json', 'grpc-status': '0' });
    res.end(JSON.stringify({
      grpcStatus: 0,
      packet: echoPacket,
      protoHex: buf.toString('hex').match(/.{1,2}/g).join(' '),
      protoBytes: buf.length,
      streamId: 7
    }));
    return;
  }

  // Serve static files from public/
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

async function main() {
  await initProtobuf();
  const serverInstance = server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`⚡ gRPC & Protobuf Working Model Server running at:`);
    console.log(`   👉 http://localhost:${PORT}`);
    console.log(`   👉 Proto file: http://localhost:${PORT}/api/proto`);
    console.log(`====================================================`);
  });

  // Clean shutdown
  function cleanup(signal) {
    console.log(`\n🛑 [gRPC] Received ${signal}. Stopping server and releasing port ${PORT}...`);
    serverInstance.close(() => {
      console.log(`✅ [gRPC] Port ${PORT} cleanly released.`);
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1000).unref();
  }

  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));
}

main().catch(err => {
  console.error('Fatal Server Error:', err);
  process.exit(1);
});

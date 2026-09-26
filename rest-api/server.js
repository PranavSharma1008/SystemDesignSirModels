const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

// Initial in-memory dataset
const INITIAL_PRODUCTS = [
  { id: 1, name: 'Cloud Compute Instance', category: 'Infrastructure', price: 49.99, stock: 120, status: 'active' },
  { id: 2, name: 'Managed PostgreSQL DB', category: 'Database', price: 79.50, stock: 45, status: 'active' },
  { id: 3, name: 'Global CDN Acceleration', category: 'Networking', price: 29.00, stock: 300, status: 'active' },
  { id: 4, name: 'AI Inference Gateway', category: 'Machine Learning', price: 99.00, stock: 15, status: 'active' },
  { id: 5, name: 'Object Storage Bucket (1TB)', category: 'Storage', price: 15.00, stock: 500, status: 'active' }
];

let products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
let nextId = 6;

function generateETag(data) {
  return `"${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();

  // CORS headers for interoperability
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, If-None-Match');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, Location, X-Response-Time');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Routes
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const startHr = process.hrtime();

    const endJson = (statusCode, payload, extraHeaders = {}) => {
      const [diffSec, diffNano] = process.hrtime(startHr);
      const latencyMs = (diffSec * 1000 + diffNano / 1e6).toFixed(2);
      res.setHeader('X-Response-Time', `${latencyMs}ms`);

      for (const [k, v] of Object.entries(extraHeaders)) {
        res.setHeader(k, v);
      }

      res.writeHead(statusCode);
      res.end(payload !== undefined ? JSON.stringify(payload, null, 2) : '');
    };

    try {
      // 1. Reset Database endpoint
      if (pathname === '/api/reset' && method === 'POST') {
        products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
        nextId = 6;
        return endJson(200, { message: 'Database reset to initial state', count: products.length });
      }

      // 2. GET /api/products (List with filter & search)
      if (pathname === '/api/products' && method === 'GET') {
        const category = urlObj.searchParams.get('category');
        const search = urlObj.searchParams.get('search');
        const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);

        let filtered = products;
        if (category && category !== 'All') {
          filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
        }
        if (search) {
          const s = search.toLowerCase();
          filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s));
        }
        filtered = filtered.slice(0, limit);

        const etag = generateETag(filtered);
        if (req.headers['if-none-match'] === etag) {
          return endJson(304, undefined, { ETag: etag });
        }

        return endJson(200, {
          meta: { total: products.length, returned: filtered.length, timestamp: new Date().toISOString() },
          data: filtered
        }, { ETag: etag, 'Cache-Control': 'public, max-age=60' });
      }

      // 3. POST /api/products (Create Resource)
      if (pathname === '/api/products' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name || typeof body.price !== 'number') {
          return endJson(422, {
            error: 'Unprocessable Entity',
            details: 'Field "name" (string) and "price" (number) are required.'
          });
        }

        const newProduct = {
          id: nextId++,
          name: String(body.name).trim(),
          category: String(body.category || 'General').trim(),
          price: parseFloat(Number(body.price).toFixed(2)),
          stock: parseInt(body.stock || '0', 10),
          status: body.status || 'active'
        };

        products.push(newProduct);
        return endJson(201, {
          message: 'Product created successfully',
          data: newProduct
        }, { Location: `/api/products/${newProduct.id}` });
      }

      // Check item-level routes: /api/products/:id
      const idMatch = pathname.match(/^\/api\/products\/(\d+)$/);
      if (idMatch) {
        const id = parseInt(idMatch[1], 10);
        const index = products.findIndex(p => p.id === id);

        // GET single item
        if (method === 'GET') {
          if (index === -1) {
            return endJson(404, { error: 'Not Found', details: `Product with ID ${id} does not exist.` });
          }
          const item = products[index];
          const etag = generateETag(item);
          if (req.headers['if-none-match'] === etag) {
            return endJson(304, undefined, { ETag: etag });
          }
          return endJson(200, { data: item }, { ETag: etag });
        }

        // PUT (Replace full resource - Idempotent)
        if (method === 'PUT') {
          if (index === -1) {
            return endJson(404, { error: 'Not Found', details: `Product with ID ${id} does not exist.` });
          }
          const body = await parseJsonBody(req);
          if (!body.name || typeof body.price !== 'number') {
            return endJson(422, { error: 'Validation Error', details: 'Full replacement requires "name" and "price".' });
          }
          products[index] = {
            id,
            name: String(body.name).trim(),
            category: String(body.category || 'General').trim(),
            price: parseFloat(Number(body.price).toFixed(2)),
            stock: parseInt(body.stock || '0', 10),
            status: body.status || 'active'
          };
          return endJson(200, { message: 'Product fully replaced (PUT is idempotent)', data: products[index] });
        }

        // PATCH (Partial update)
        if (method === 'PATCH') {
          if (index === -1) {
            return endJson(404, { error: 'Not Found', details: `Product with ID ${id} does not exist.` });
          }
          const body = await parseJsonBody(req);
          const current = products[index];
          if (body.name !== undefined) current.name = String(body.name).trim();
          if (body.category !== undefined) current.category = String(body.category).trim();
          if (body.price !== undefined) current.price = parseFloat(Number(body.price).toFixed(2));
          if (body.stock !== undefined) current.stock = parseInt(body.stock, 10);
          if (body.status !== undefined) current.status = String(body.status);

          return endJson(200, { message: 'Product patched partially', data: current });
        }

        // DELETE (Idempotent resource removal)
        if (method === 'DELETE') {
          if (index === -1) {
            return endJson(404, { error: 'Not Found', details: `Product with ID ${id} does not exist.` });
          }
          products.splice(index, 1);
          // Standard 204 No Content for successful deletion
          return endJson(204, undefined);
        }
      }

      return endJson(404, { error: 'Endpoint Not Found', pathname, method });
    } catch (err) {
      console.error('[REST SERVER ERROR]:', err);
      return endJson(500, { error: 'Internal Server Error', message: err.message });
    }
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

// Start Server
const serverInstance = server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌐 REST API Working Model Server running at:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`   👉 API: http://localhost:${PORT}/api/products`);
  console.log(`====================================================`);
});

// Automatic clean port shutdown
function cleanup(signal) {
  console.log(`\n🛑 [REST] Received ${signal}. Stopping server and releasing port ${PORT}...`);
  serverInstance.close(() => {
    console.log(`✅ [REST] Port ${PORT} cleanly released.`);
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));

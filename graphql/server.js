const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildSchema, graphql } = require('graphql');

const PORT = process.env.PORT || 5001;
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

// 1. Define GraphQL Schema using Schema Definition Language (SDL)
const schema = buildSchema(`
  enum UserStatus {
    ACTIVE
    OFFLINE
    AWAY
    BUSY
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
    status: UserStatus!
    avatar: String!
    posts: [Post!]!
  }

  type Comment {
    id: ID!
    text: String!
    authorName: String!
    createdAt: String!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    likes: Int!
    author: User!
    comments: [Comment!]!
    commentCount: Int!
  }

  type SystemMetrics {
    uptimeSeconds: Int!
    heapUsedMB: Float!
    resolversExecuted: Int!
    timestamp: String!
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
    posts(authorId: ID): [Post!]!
    post(id: ID!): Post
    metrics: SystemMetrics!
    schemaSDL: String!
  }

  type Mutation {
    createPost(title: String!, content: String!, authorId: ID!): Post!
    likePost(id: ID!): Post!
    updateUserStatus(id: ID!, status: UserStatus!): User!
    resetData: Boolean!
  }
`);

// 2. In-Memory Mock Database
const INITIAL_USERS = [
  { id: '1', name: 'Alice Chen', email: 'alice@distributed.io', role: 'Staff Engineer', status: 'ACTIVE', avatar: '👩‍💻' },
  { id: '2', name: 'Bob Smith', email: 'bob@networks.org', role: 'DevOps Architect', status: 'AWAY', avatar: '👨‍🔧' },
  { id: '3', name: 'Clara Patel', email: 'clara@systems.dev', role: 'Core Contributor', status: 'BUSY', avatar: '👩‍🔬' }
];

const INITIAL_POSTS = [
  { id: '101', title: 'Why GraphQL Solves Over-Fetching', content: 'In REST, getting user metadata returns 25 fields. GraphQL lets you pick 2.', likes: 42, authorId: '1' },
  { id: '102', title: 'Preventing the N+1 Problem with Resolvers', content: 'Batch loading and declarative relationships save dozens of HTTP round trips.', likes: 28, authorId: '1' },
  { id: '103', title: 'HTTP/2 vs HTTP/1.1 Multiplexing', content: 'How binary framing layers revolutionize head-of-line blocking.', likes: 65, authorId: '2' },
  { id: '104', title: 'Stateless Microservices in Production', content: 'Key principles for high-concurrency distributed state management.', likes: 19, authorId: '3' }
];

const INITIAL_COMMENTS = [
  { id: 'c1', postId: '101', text: 'Totally agree, mobile apps love this!', authorName: 'Bob Smith', createdAt: '10 mins ago' },
  { id: 'c2', postId: '101', text: 'Cut our payload size by 78%.', authorName: 'Clara Patel', createdAt: '5 mins ago' },
  { id: 'c3', postId: '103', text: 'HTTP/2 streaming is incredible.', authorName: 'Alice Chen', createdAt: '20 mins ago' }
];

let users = JSON.parse(JSON.stringify(INITIAL_USERS));
let posts = JSON.parse(JSON.stringify(INITIAL_POSTS));
let comments = JSON.parse(JSON.stringify(INITIAL_COMMENTS));
let resolverCounter = 0;
let nextPostId = 105;

// 3. Resolvers Implementation
const root = {
  users: () => {
    resolverCounter++;
    return users.map(u => attachUserRelations(u));
  },
  user: ({ id }) => {
    resolverCounter++;
    const user = users.find(u => u.id === id);
    return user ? attachUserRelations(user) : null;
  },
  posts: ({ authorId }) => {
    resolverCounter++;
    let result = posts;
    if (authorId) result = result.filter(p => p.authorId === authorId);
    return result.map(p => attachPostRelations(p));
  },
  post: ({ id }) => {
    resolverCounter++;
    const post = posts.find(p => p.id === id);
    return post ? attachPostRelations(post) : null;
  },
  metrics: () => {
    resolverCounter++;
    return {
      uptimeSeconds: Math.floor(process.uptime()),
      heapUsedMB: parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
      resolversExecuted: resolverCounter,
      timestamp: new Date().toLocaleTimeString()
    };
  },
  schemaSDL: () => {
    return schema;
  },
  createPost: ({ title, content, authorId }) => {
    resolverCounter++;
    const author = users.find(u => u.id === authorId);
    if (!author) throw new Error(`Author #${authorId} not found`);

    const newPost = {
      id: String(nextPostId++),
      title: String(title).trim(),
      content: String(content).trim(),
      likes: 0,
      authorId
    };
    posts.unshift(newPost);
    return attachPostRelations(newPost);
  },
  likePost: ({ id }) => {
    resolverCounter++;
    const post = posts.find(p => p.id === id);
    if (!post) throw new Error(`Post #${id} not found`);
    post.likes++;
    return attachPostRelations(post);
  },
  updateUserStatus: ({ id, status }) => {
    resolverCounter++;
    const user = users.find(u => u.id === id);
    if (!user) throw new Error(`User #${id} not found`);
    user.status = status;
    return attachUserRelations(user);
  },
  resetData: () => {
    users = JSON.parse(JSON.stringify(INITIAL_USERS));
    posts = JSON.parse(JSON.stringify(INITIAL_POSTS));
    comments = JSON.parse(JSON.stringify(INITIAL_COMMENTS));
    nextPostId = 105;
    return true;
  }
};

function attachUserRelations(u) {
  return {
    ...u,
    posts: () => {
      resolverCounter++;
      return posts.filter(p => p.authorId === u.id).map(p => attachPostRelations(p));
    }
  };
}

function attachPostRelations(p) {
  return {
    ...p,
    author: () => {
      resolverCounter++;
      const author = users.find(u => u.id === p.authorId);
      return author ? attachUserRelations(author) : null;
    },
    comments: () => {
      resolverCounter++;
      return comments.filter(c => c.postId === p.id);
    },
    commentCount: () => {
      resolverCounter++;
      return comments.filter(c => c.postId === p.id).length;
    }
  };
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format in request body'));
      }
    });
    req.on('error', reject);
  });
}

// 4. HTTP Server
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GraphQL Endpoint: /graphql
  if (pathname === '/graphql') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const startHr = process.hrtime();

    try {
      let query = '';
      let variables = null;
      let operationName = null;

      if (method === 'POST') {
        const body = await parseJsonBody(req);
        query = body.query || '';
        variables = body.variables || null;
        operationName = body.operationName || null;
      } else if (method === 'GET') {
        query = urlObj.searchParams.get('query') || '';
        const varsStr = urlObj.searchParams.get('variables');
        if (varsStr) {
          try { variables = JSON.parse(varsStr); } catch (_) {}
        }
      }

      if (!query) {
        res.writeHead(400);
        res.end(JSON.stringify({ errors: [{ message: 'Must provide query string.' }] }));
        return;
      }

      // Execute GraphQL AST Query
      const result = await graphql({
        schema,
        source: query,
        rootValue: root,
        variableValues: variables,
        operationName
      });

      const [diffSec, diffNano] = process.hrtime(startHr);
      const latencyMs = (diffSec * 1000 + diffNano / 1e6).toFixed(2);
      res.setHeader('X-GraphQL-Execution-Time', `${latencyMs}ms`);

      res.writeHead(200);
      res.end(JSON.stringify(result, null, 2));
      return;
    } catch (err) {
      console.error('[GRAPHQL SERVER ERROR]:', err);
      res.writeHead(500);
      res.end(JSON.stringify({ errors: [{ message: err.message }] }));
      return;
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
  console.log(`◈ GraphQL Working Model Server running at:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`   👉 Endpoint: http://localhost:${PORT}/graphql`);
  console.log(`====================================================`);
});

// Clean port shutdown
function cleanup(signal) {
  console.log(`\n🛑 [GRAPHQL] Received ${signal}. Stopping server and releasing port ${PORT}...`);
  serverInstance.close(() => {
    console.log(`✅ [GRAPHQL] Port ${PORT} cleanly released.`);
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));

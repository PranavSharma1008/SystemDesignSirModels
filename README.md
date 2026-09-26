# 🌐 Distributed Systems & Network Architecture Models

[![Node.js](https://img.shields.io/badge/Node.js-v16%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Protocols](https://img.shields.io/badge/Protocols-HTTP%2F1.1%20%7C%20HTTP%2F2%20%7C%20RFC%206455%20%7C%20proto3-007ACC?style=for-the-badge)](https://en.wikipedia.org/wiki/Internet_protocol_suite)
[![Architecture](https://img.shields.io/badge/Architecture-REST%20%7C%20GraphQL%20%7C%20gRPC%20%7C%20WebSockets-FF6F00?style=for-the-badge)](https://en.wikipedia.org/wiki/Software_architecture)
[![License](https://img.shields.io/badge/License-ISC-blue?style=for-the-badge)](LICENSE)

An interactive, production-grade visual laboratory and suite of working models demonstrating the **four foundational communication paradigms** in distributed systems and modern web architecture:

1. **REST API (RFC 9110)** — Stateless, resource-oriented HTTP architecture with caching & idempotency.
2. **GraphQL** — Client-driven declarative data fetching, AST execution, and resolver pipelines.
3. **gRPC & Protocol Buffers (proto3)** — High-performance binary Remote Procedure Calls over HTTP/2 streams.
4. **WebSockets (RFC 6455)** — Persistent, full-duplex bidirectional streaming over a single TCP connection.

Each model features an **in-memory backend server**, **zero-build vanilla engineering dashboards**, and **packet/wire-level inspectors** to visualize what actually travels over the wire.

---

## 📑 Table of Contents

- [Architectural Comparison Matrix](#-architectural-comparison-matrix)
- [Unified Dashboard Ecosystem](#-unified-dashboard-ecosystem)
- [The 4 Working Models](#-the-4-working-models)
  - [1. REST API Model (:5000)](#1--rest-api-working-model-port-5000)
  - [2. GraphQL Model (:5001)](#2--graphql-working-model-port-5001)
  - [3. gRPC & Protocol Buffers Model (:5002)](#3--grpc--protocol-buffers-working-model-port-5002)
  - [4. WebSocket Model (:4000)](#4--websocket-working-model-port-4000)
- [Quick Start & Setup](#-quick-start--setup)
- [Port Allocation & Endpoints](#-port-allocation--endpoints)
- [Repository Structure](#-repository-structure)
- [Architectural Decision Guide](#-architectural-decision-guide)
- [Clean Port Management](#-clean-port-management)

---

## 📊 Architectural Comparison Matrix

| Feature | 🌐 REST API | ◈ GraphQL | ⚡ gRPC | ⚡ WebSockets |
| :--- | :--- | :--- | :--- | :--- |
| **Specification / RFC** | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | GraphQL Spec (June 2018) | gRPC Spec / proto3 | [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455) |
| **Transport Protocol** | HTTP/1.1 or HTTP/2 | HTTP/1.1 (typically POST) | HTTP/2 multiplexed streams | TCP (post HTTP 101 Upgrade) |
| **Data Format** | JSON (Human-readable text) | JSON (Arbitrary query-shaped) | Protocol Buffers (Compact binary) | Text (JSON/UTF-8) or Binary frames |
| **Communication Style** | Request / Response (Stateless) | Request / Response (Declarative) | Remote Procedure Call (RPC) | Full-Duplex Persistent Bi-directional |
| **Data Over-fetching** | ⚠️ Common (fixed endpoint shape) | ✅ Solved (client requests fields) | ✅ Solved (strict proto schema) | ⚠️ Depends on application payload |
| **Under-fetching (N+1)** | ⚠️ Common (multiple round-trips) | ✅ Solved (nested query in 1 RTT) | ⚠️ Handled via RPC batching | ✅ Solved via real-time events |
| **Streaming Support** | Polling / SSE (Unidirectional) | Subscriptions (over WS or SSE) | Native bidirectional streaming | Native bidirectional streaming |
| **Schema & Typing** | Optional (OpenAPI / Swagger) | Strict (Schema Definition - SDL) | Strict (proto3 IDL with codegen) | Custom application protocol |
| **Idempotency Built-in** | ✅ Yes (`GET`, `PUT`, `DELETE`) | ❌ No (HTTP POST abstraction) | Contract-dependent | N/A (Event stream) |
| **Framing Overhead** | ~500–1000 bytes (HTTP headers) | ~500–1000 bytes (HTTP headers) | ~9 bytes (HTTP/2 binary frame) | **2 to 10 bytes** per frame |
| **Default Port** | `5000` | `5001` | `5002` | `4000` |

---

## 🖥️ Unified Dashboard Ecosystem

All four services run independent Node.js servers, but share a **global protocol navigation bar** across their web dashboards:

```
[⚡ WebSockets :4000] ─── [🌐 REST API :5000] ─── [◈ GraphQL :5001] ─── [⚡ gRPC :5002]
```

When you have all services running, you can click across any protocol tab to compare execution times, wire payload sizes, and header overhead in real-time.

---

## 🔬 The 4 Working Models

```
                               ┌────────────────────────────────────────┐
                               │   Distributed Systems Communication    │
                               └──────────────────┬─────────────────────┘
                 ┌───────────────────┬────────────┴───────┬───────────────────┐
                 ▼                   ▼                    ▼                   ▼
          ┌─────────────┐     ┌─────────────┐      ┌─────────────┐     ┌─────────────┐
          │  REST API   │     │   GraphQL   │      │    gRPC     │     │ WebSockets  │
          │  (RFC 9110) │     │ (SDL / AST) │      │  (proto3)   │     │ (RFC 6455)  │
          │  Port 5000  │     │  Port 5001  │      │  Port 5002  │     │  Port 4000  │
          └─────────────┘     └─────────────┘      └─────────────┘     └─────────────┘
```

---

### 1. 🌐 REST API Working Model (Port `5000`)

A **zero-dependency** implementation of Fielding's Representational State Transfer architecture over pure Node.js HTTP.

#### Core Architectural Concepts Demonstrated:
- **Roy Fielding's 6 Constraints**: Client-Server separation, Statelessness, Cacheability, Uniform Interface, Layered System, and Code on Demand.
- **HTTP Verb Safety & Idempotency**:
  - `GET` — Safe & Idempotent (queries resource state without mutation).
  - `POST` — Unsafe & Non-Idempotent (creates new resource, returns `201 Created` + `Location` header).
  - `PUT` — Unsafe & Idempotent (complete replacement at URI).
  - `PATCH` — Unsafe & Contextually Idempotent (partial delta mutation).
  - `DELETE` — Unsafe & Idempotent (returns `204 No Content`).
  - `OPTIONS` — Safe & Idempotent (CORS preflight discovery).
- **Conditional Caching with ETags**:
  - Computes MD5 digests of resource state.
  - Compares incoming `If-None-Match` request headers.
  - Returns `304 Not Modified` with an empty response body when the hash matches, saving 100% of body transmission bandwidth.
- **Latency & Wire Inspector**: Measures server processing time in microseconds using `process.hrtime()` and exposes `X-Response-Time`.

```
Client                                                  Server (:5000)
  │                                                           │
  ├─── GET /api/products ────────────────────────────────────>│
  │<── 200 OK (ETag: "abc123", Body: [...]) ──────────────────┤
  │                                                           │
  ├─── GET /api/products (If-None-Match: "abc123") ──────────>│
  │<── 304 Not Modified (0 bytes body transferred) ───────────┤
```

---

### 2. ◈ GraphQL Working Model (Port `5001`)

An interactive laboratory showcasing **Declarative Data Fetching** and Abstract Syntax Tree (AST) validation using the official `graphql` JavaScript engine.

#### Core Architectural Concepts Demonstrated:
- **Over-fetching Elimination**:
  - In REST, `GET /api/users/1` returns entire database records (emails, avatars, metadata), wasting bandwidth on mobile networks.
  - In GraphQL, requesting `{ user(id: "1") { name } }` returns strictly the name, cutting payload size by **up to 85%**.
- **Under-fetching & The N+1 Network Problem**:
  - In REST, rendering a profile with posts and comments requires $1 + 1 + N$ separate HTTP requests (waterfall latency).
  - In GraphQL, a single nested query traverses the graph schema in **1 single network round trip**:
    ```graphql
    query GetUserProfile {
      user(id: "1") {
        name
        posts {
          title
          comments {
            text
            authorName
          }
        }
      }
    }
    ```
- **Schema Definition Language (SDL)**: Strongly-typed schema containing `User`, `Post`, `Comment`, `SystemMetrics`, and `UserStatus` enums.
- **Mutations**: Write operations with returned field projections (`createPost`, `addComment`, `updateUserStatus`).
- **Interactive Checkbox Tree**: Check or uncheck fields in the UI to see the generated GraphQL query and payload size update live.

---

### 3. ⚡ gRPC & Protocol Buffers Working Model (Port `5002`)

A visual laboratory demonstrating **Google's Remote Procedure Call (gRPC)** engine, **Protocol Buffers v3 (`proto3`)** binary encoding, and **HTTP/2 multiplexing**.

#### Core Architectural Concepts Demonstrated:
- **Binary Protobuf vs Textual JSON**:
  - JSON sends repeated verbose keys (`"cluster_region": "ap-south-1"`) in ASCII/UTF-8.
  - Protocol Buffers serialize fields into binary **Varints** and **Tag-Length-Value (TLV)** wire formats.
  - Features a side-by-side **Binary Hex Dump Inspector** demonstrating an **~80% reduction in byte size**.
- **Interface Definition Language (IDL)**: Strict `.proto` contract defined in [`grpc/proto/telemetry.proto`](grpc/proto/telemetry.proto).
- **The 4 gRPC Communication Paradigms**:
  1. **Unary RPC**: Single request $\rightarrow$ Single response (`GetSystemStats`).
  2. **Server Streaming RPC**: Single request $\rightarrow$ Continuous stream of metric frames (`StreamMetrics`).
  3. **Client Streaming RPC**: Client streams bursts of metric packets $\rightarrow$ Server returns aggregation summary (`UploadBatchMetrics`).
  4. **Bidirectional Streaming RPC**: Full-duplex continuous live stream between client and server (`LiveChannel`).
- **HTTP/2 Framing Simulation**: Visualizes `HEADERS` frames, binary `DATA` frames, and trailing metadata with `grpc-status: 0 (OK)`.

```
1. UNARY RPC:
   Client [ Request ] ════════════════════════════════> Server
   Client <═══════════════════════════════ [ Response ] Server

2. SERVER STREAMING RPC:
   Client [ Request ] ════════════════════════════════> Server
   Client <═══════════════════════════ [ Stream Frame 1 ] Server
   Client <═══════════════════════════ [ Stream Frame 2 ] Server

3. CLIENT STREAMING RPC:
   Client [ Stream Frame 1 ] ═════════════════════════> Server
   Client [ Stream Frame 2 ] ═════════════════════════> Server
   Client <═══════════════════════════════ [ Response ] Server

4. BIDIRECTIONAL STREAMING RPC:
   Client [ Frame A1 ] ═══════════════════════════════> Server
   Client <═══════════════════════════ [ Frame B1 ] ═══ Server
   Client [ Frame A2 ] ═══════════════════════════════> Server
   Client <═══════════════════════════ [ Frame B2 ] ═══ Server
```

---

### 4. ⚡ WebSocket Working Model (Port `4000`)

A visual laboratory demonstrating **RFC 6455 WebSockets** for low-latency, full-duplex persistent networking.

#### Core Architectural Concepts Demonstrated:
- **HTTP 101 Switching Protocols Handshake**:
  - The client initiates an HTTP request with `Upgrade: websocket` and a random Base64 `Sec-WebSocket-Key`.
  - The server verifies the handshake by concatenating the RFC 6455 Magic GUID, generating a SHA-1 hash, and responding with `Sec-WebSocket-Accept`:
    $$\text{Sec-WebSocket-Accept} = \text{Base64}\Big(\text{SHA-1}\big(\text{Sec-WebSocket-Key} + \text{"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"}\big)\Big)$$
- **RFC 6455 Binary Frame Structure**:
  - 1-bit `FIN`, 4-bit `Opcode` (`0x1` Text, `0x2` Binary, `0x8` Close, `0x9` Ping, `0xA` Pong).
  - 1-bit `MASK` and 4-byte client masking key using XOR encryption:
    $$\text{Payload}[i] = \text{Encoded}[i] \oplus \text{Mask}[i \pmod 4]$$
  - Only **2 to 10 bytes of framing overhead** per message vs ~1 KB in standard HTTP.
- **Unsolicited Server Push**: Server telemetry push loop sends CPU/memory metrics every 2.5s without any client polling.
- **Multi-Client Broadcast**: Open two browser tabs side-by-side; typing a message in one broadcasts instantly to the other in under 5ms.
- **True Latency RTT**: Built-in ping/pong round-trip latency counter.

---

## 🚀 Quick Start & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (version **16.x** or higher)
- `npm` (version **7.x** or higher)

---

### Option A: Install Everything from Root

Clone the repository and install all dependencies for every model with one command:

```bash
git clone https://github.com/PranavSharma1008/SystemDesignSirModels-.git
cd SystemDesignSirModels-

# Install all sub-project dependencies
npm run install:all
```

---

### Option B: Run Services Individually

Open separate terminal windows to run individual models:

```bash
# Terminal 1: REST API (Port 5000 - Zero dependencies)
npm run start:rest

# Terminal 2: GraphQL (Port 5001)
npm run start:graphql

# Terminal 3: gRPC & Protocol Buffers (Port 5002)
npm run start:grpc

# Terminal 4: WebSockets (Port 4000)
npm run start:ws
```

---

### Option C: Run All Services Concurrently (One-Liner)

On macOS / Linux / WSL:

```bash
npm run start:rest & npm run start:graphql & npm run start:grpc & npm run start:ws
```

To stop all background services simultaneously:
```bash
kill $(lsof -t -i:4000,5000,5001,5002)
```

---

## 🌐 Port Allocation & Endpoints

| Protocol | Port | Web Dashboard URL | Primary API / Socket Endpoint | Dependencies |
| :--- | :---: | :--- | :--- | :--- |
| **REST API** | `5000` | [http://localhost:5000](http://localhost:5000) | `GET /api/products`<br>`POST /api/products` | None (Standard Node.js) |
| **GraphQL** | `5001` | [http://localhost:5001](http://localhost:5001) | `POST /graphql` | `graphql` |
| **gRPC** | `5002` | [http://localhost:5002](http://localhost:5002) | `POST /grpc/telemetry.TelemetryService/...`<br>`GET /api/proto` | `protobufjs` |
| **WebSockets** | `4000` | [http://localhost:4000](http://localhost:4000) | `ws://localhost:4000` | `ws` |

---

## 📁 Repository Structure

```
SystemDesignSirModels-/
├── package.json               # Root scripts to orchestrate all 4 models
├── README.md                  # Main documentation & architecture guide
│
├── rest-api/                  # 🌐 REST API Model (Port 5000)
│   ├── package.json
│   ├── server.js              # Pure Node.js HTTP server (CRUD, ETag, Status Codes)
│   ├── README.md              # REST theoretical deep-dive
│   └── public/
│       ├── index.html         # Interactive HTTP playground UI
│       ├── client.js          # REST client logic & wire inspector
│       └── style.css
│
├── graphql/                   # ◈ GraphQL Model (Port 5001)
│   ├── package.json
│   ├── server.js              # GraphQL SDL, Resolvers, & AST Executor
│   ├── README.md              # GraphQL theoretical deep-dive
│   └── public/
│       ├── index.html         # Schema Tree & Query Playground UI
│       ├── client.js          # AST query builder & live visualizer
│       └── style.css
│
├── grpc/                      # ⚡ gRPC & Protocol Buffers Model (Port 5002)
│   ├── package.json
│   ├── server.js              # Protobuf serializer & 4 RPC mode simulator
│   ├── README.md              # gRPC theoretical deep-dive
│   ├── proto/
│   │   └── telemetry.proto    # proto3 IDL service definition
│   └── public/
│       ├── index.html         # Binary Hex Inspector & Stream UI
│       ├── client.js          # RPC invoker & HTTP/2 frame visualizer
│       └── style.css
│
└── websockets/                # ⚡ WebSocket Model (Port 4000)
    ├── package.json
    ├── server.js              # HTTP 101 Upgrade handler & ws broadcast server
    ├── README.md              # RFC 6455 theoretical deep-dive
    └── public/
        ├── index.html         # Multi-client live sync & telemetry UI
        ├── client.js          # Browser WebSocket API handler & RTT calculator
        └── style.css
```

---

## 🎯 Architectural Decision Guide

When should you choose which communication protocol in a production distributed system?

```
                                What is your primary requirement?
                                                │
         ┌────────────────────────┬─────────────┴─────────────┬────────────────────────┐
         ▼                        ▼                           ▼                        ▼
  CRUD / Public Web       Complex Relational        Internal High-Throughput     Low-Latency Real-Time
     Integrations               Data                   Microservices                Bidirectional
         │                        │                           │                        │
         ▼                        ▼                           ▼                        ▼
     REST API                  GraphQL                      gRPC                   WebSockets
   (RFC 9110)                (SDL / AST)                  (proto3)                 (RFC 6455)
  - Public SDKs            - Mobile frontends           - Low latency            - Live chat apps
  - HTTP Caching           - Aggregate microservices    - Binary compression     - Financial tickers
  - Standard firewalls     - Prevent over-fetching      - Code-gen contracts     - Multiplayer gaming
```

---

## 🛑 Clean Port Management

All servers in this repository implement robust POSIX signal traps (`SIGINT` and `SIGTERM`):

```javascript
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Port released cleanly.');
    process.exit(0);
  });
});
```

When you hit `Ctrl + C` in any terminal, listeners are closed cleanly and ports (`4000`, `5000`, `5001`, `5002`) are immediately released—preventing `EADDRINUSE` socket errors.

---

## 👥 Authors & Academic Context

- **Course**: Semester 5 Distributed Systems & System Design
- **Author**: [Pranav Sharma](https://github.com/PranavSharma1008)
- **Repository**: [PranavSharma1008/SystemDesignSirModels-](https://github.com/PranavSharma1008/SystemDesignSirModels-)

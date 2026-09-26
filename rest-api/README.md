# REST API Interactive Working Model (RFC 9110)

A production-grade, zero-dependency visual laboratory and working model demonstrating **Representational State Transfer (REST)** and modern **HTTP/1.1 & HTTP/2** resource-oriented architecture.

---

## 📌 1. What is REST?

**REST** (Representational State Transfer) is an architectural style defined by Roy Fielding in 2000 for distributed hypermedia systems. Rather than calling remote methods (like RPC), clients interact with **resources** identified by Uniform Resource Identifiers (URIs), manipulating their state using standard HTTP methods.

### The 6 Core Architectural Constraints of REST:
1. **Client-Server Architecture**: Separation of concerns between UI/client state and data storage/server logic.
2. **Statelessness**: Every request from client to server must contain all of the information necessary to understand and complete the request. The server does not store client session context.
3. **Cacheability**: Responses must implicitly or explicitly define themselves as cacheable or non-cacheable (via `Cache-Control`, `ETag`, `Last-Modified`).
4. **Uniform Interface**:
   - Resource Identification in requests (e.g., `/api/products/1`).
   - Resource manipulation through representations (JSON payloads).
   - Self-descriptive messages (Headers like `Content-Type: application/json`).
   - Hypermedia as the Engine of Application State (HATEOAS).
5. **Layered System**: The client cannot tell whether it is connected directly to the end server or to an intermediary (proxy, reverse proxy, load balancer).
6. **Code on Demand (Optional)**: Server can temporarily extend client functionality by transferring executable code (e.g. JavaScript).

---

## 🔄 2. HTTP Methods: Safety & Idempotency Matrix

| HTTP Method | Safe? | Idempotent? | Typical Success Status | Semantics & Purpose |
| :--- | :---: | :---: | :---: | :--- |
| **GET** | ✅ Yes | ✅ Yes | `200 OK`, `304 Not Modified` | Read resource representation without side effects. |
| **POST** | ❌ No | ❌ No | `201 Created` (+ `Location` header) | Create subordinate resource or perform action. |
| **PUT** | ❌ No | ✅ Yes | `200 OK`, `204 No Content` | Complete replacement or creation at target URI. |
| **PATCH** | ❌ No | ⚠️ Contextual | `200 OK` | Apply partial delta modification to resource. |
| **DELETE** | ❌ No | ✅ Yes | `204 No Content` | Remove resource from target URI. |
| **OPTIONS** | ✅ Yes | ✅ Yes | `204 No Content` | Query communication options / CORS preflight. |

> **Definitions**:
> - **Safe**: The method does not alter server state (read-only).
> - **Idempotent**: Calling the method $N$ times ($N \ge 1$) produces the identical server state as calling it once: $f(f(x)) = f(x)$.

---

## ⚡ 3. How to Run This Project

### Prerequisites:
- [Node.js](https://nodejs.org/) (v16 or higher)
- **Zero external dependencies** (uses standard Node.js runtime).

### Step 1: Navigate to the folder & Start Server
```bash
cd rest-api
npm start
```

### Step 2: Open in Browser
Visit:
👉 **[http://localhost:5000](http://localhost:5000)**

### Step 3: Test Interactive Features
1. **HTTP Method Playground**: Test `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`.
2. **Observe Idempotency**: Click `PUT` or `DELETE` multiple times and inspect the wire log.
3. **Conditional Caching with ETags**:
   - Click the **"Conditional ETag (304 Not Modified)"** chip.
   - Observe how the server returns `304 Not Modified` with 0 bytes transferred in the body!
4. **Real-time Latency**: Column 3 displays millisecond round-trip time and exact HTTP wire representation.

---

## 🛑 Clean Port Release (No Stuck Ports)
This server includes built-in signal traps (`SIGINT`, `SIGTERM`):
When you press `Ctrl + C` in your terminal, the HTTP listener is closed immediately and port **5000** is freed instantly.

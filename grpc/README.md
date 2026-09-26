# gRPC & Protocol Buffers Interactive Working Model

A complete, production-grade visual laboratory and working model demonstrating **gRPC (Remote Procedure Call)**, **Protocol Buffers (proto3)** binary serialization, and **HTTP/2 multiplexed streams**.

---

## 📌 1. What is gRPC?

**gRPC** is an open-source, high-performance, language-agnostic Remote Procedure Call (RPC) framework developed by Google. Instead of thinking in terms of CRUD resources and URLs (like REST), gRPC allows a client application to directly invoke methods on a server application as if it were a local object in memory.

### Why gRPC Outperforms REST:
1. **Binary Protocol Buffers vs Textual JSON**:
   - JSON uses human-readable strings (`"server_id": "node-1"`), which consume significant bandwidth and require expensive string parsing CPU cycles.
   - Protocol Buffers serialize structured data into compact binary bytes using **Varints** and **Tag-Length-Value (TLV)**. This saves **70% to 85% in bandwidth** and serializes up to **10x faster**.
2. **HTTP/2 as Transport**:
   - Multiple bidirectional requests/responses multiplexed over a **single TCP connection** simultaneously without head-of-line blocking.
   - Server-push and streaming natively built-in.
   - Header compression with HPACK.
3. **Strict Contracts (Interface Definition Language - IDL)**:
   - Client and server are strictly typed and auto-generated from `.proto` contracts, eliminating runtime type mismatch errors.

---

## 🔄 2. The 4 gRPC Communication Paradigms

```
1. UNARY RPC:
   Client [ Request ] ════════════════════════════════> Server
   Client <═══════════════════════════════ [ Response ] Server

2. SERVER STREAMING RPC:
   Client [ Request ] ════════════════════════════════> Server
   Client <═══════════════════════════ [ Stream Frame 1 ] Server
   Client <═══════════════════════════ [ Stream Frame 2 ] Server
   Client <═══════════════════════════ [ Stream Frame N ] Server

3. CLIENT STREAMING RPC:
   Client [ Stream Frame 1 ] ═════════════════════════> Server
   Client [ Stream Frame 2 ] ═════════════════════════> Server
   Client <═══════════════════════════════ [ Response ] Server

4. BIDIRECTIONAL STREAMING RPC:
   Client [ Stream Frame A ] ═════════════════════════> Server
   Client <═══════════════════════════ [ Stream Frame 1 ] Server
   Client [ Stream Frame B ] ═════════════════════════> Server
   Client <═══════════════════════════ [ Stream Frame 2 ] Server
```

---

## 🚀 3. How to Run This Project

### Step 1: Navigate to the folder & Install Dependencies
```bash
cd grpc
npm install
```

### Step 2: Start the Server
```bash
npm start
```
The server will start on:
👉 **[http://localhost:5002](http://localhost:5002)**
👉 Protobuf Contract: `http://localhost:5002/api/proto`

### Step 3: Test Interactive Features
1. **Inspect Protobuf Hex Dump (Column 1)**:
   - Notice the raw binary hex output (`0a 09 73 65 72 76 65 72...`).
   - Compare the binary byte size vs JSON: observe the **~80% reduction** in bandwidth!
2. **Test the 4 RPC Modes (Column 2)**:
   - Select **Unary RPC** $\rightarrow$ Click **"Invoke RPC"** (standard request/response).
   - Select **Server Stream** $\rightarrow$ Watch real-time multiplexed packet streams without repeated polling.
   - Select **Client Stream** $\rightarrow$ Stream bursts of telemetry packets to server for aggregation.
   - Select **Bidirectional** $\rightarrow$ Simultaneous two-way RPC.
3. **HTTP/2 Frames & Trailers (Column 3)**:
   - Inspect the simulated HTTP/2 streams (`Stream #1`, `Stream #3`), HEADERS, DATA, and trailing `grpc-status: 0 (OK)`.

---

## 🛑 Clean Port Release
Built-in `SIGINT` (Ctrl+C) and `SIGTERM` listeners guarantee that port **5002** is immediately released when the server is stopped.

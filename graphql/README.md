# GraphQL Interactive Working Model

A complete, production-grade visual laboratory demonstrating **GraphQL declarative data fetching**, Abstract Syntax Tree (AST) query execution, and resolver architectures.

---

## 📌 1. What is GraphQL?

**GraphQL** is an open-source data query and manipulation language for APIs, and a runtime for executing queries with existing data.

### The Fundamental Shift from REST to GraphQL:
1. **REST is Endpoint-Driven**:
   - The server dictates what data is returned for each URL endpoint.
   - Getting a user and their articles requires multiple round-trip requests (`/api/users/1` then `/api/users/1/posts`).
2. **GraphQL is Client-Driven**:
   - The client describes the exact shape of the data it requires using a declarative query.
   - The server traverses the typed schema AST and returns **only** what was asked for—no more, no less—in a single round trip.

---

## 🔍 2. Two Classic Problems GraphQL Solves

### A. Over-fetching
In REST, calling `GET /api/users/1` returns every single field:
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@...",
  "address_line_1": "...",
  "address_line_2": "...",
  "phone_number": "...",
  "created_at": "...",
  "updated_at": "..."
}
```
If your mobile app only needed the user's `name` to show in a navbar, **95% of the transferred bytes were wasted**.
> **In GraphQL**: You request `{ user(id: "1") { name } }` and receive solely `{"data": {"user": {"name": "Alice"}}}`.

### B. Under-fetching & The N+1 Request Problem
In REST, to render a user profile screen with their posts and comments:
- Request 1: `GET /users/1`
- Request 2: `GET /users/1/posts` (returns 5 posts)
- Requests 3–7: `GET /posts/{id}/comments` for each post ($N=5$)
- **Total: $1 + 1 + 5 = 7$ round-trip HTTP requests!** On high-latency mobile networks, this causes major lag.
> **In GraphQL**: A single nested query fetches User, Posts, and Comments in **1 single network round trip**.

---

## 🚀 3. How to Run This Project

### Step 1: Navigate to the folder & Install Dependencies
```bash
cd graphql
npm install
```

### Step 2: Start the Server
```bash
npm start
```
The server will start on:
👉 **[http://localhost:5001](http://localhost:5001)**
👉 GraphQL Endpoint: `http://localhost:5001/graphql`

### Step 3: Test Interactive Features
1. **Schema Checkbox Tree (Column 1)**:
   - Check or uncheck fields like `email`, `role`, `avatar`.
   - Click **"Generate Query from Selection"** and observe how the payload size shrinks or expands in real-time.
2. **Query Presets**:
   - Click **"1. Avoid Over-fetching"** $\rightarrow$ Notice bandwidth savings jumping to ~85%.
   - Click **"2. Avoid Under-fetching"** $\rightarrow$ Fetch User + Posts + Comments in 1 single HTTP POST request.
   - Click **"3. Mutation: Create New Post"** $\rightarrow$ Perform a write operation.

---

## 🛑 Clean Port Release
Built-in `SIGINT` (Ctrl+C) and `SIGTERM` listeners guarantee that port **5001** is immediately released when the server is stopped.

# Social Network Analyzer — Backend API
**Production-Ready Upgrade**

A high-performance, scalable REST API built with **Node.js**, **Express.js**, and **MongoDB**. This backend powers the Social Network Analyzer graph, providing robust JWT-based authentication, an optimized graph analysis engine using BFS algorithms, and scalable data endpoints.

## 🚀 Key Features
*   **Authentication & Security**: JWT-based auth flows (`register`, `login`), protected routes, and standardized Error Handling.
*   **Graph Engine**:
    *   **Shortest Path (BFS)**: Finds the exact path and distance between any two users in the network.
    *   **Degree Centrality**: Calculates the most influential users in real-time.
    *   **Mutual Friends**: Optimized in-memory calculation using Sets/Maps.
*   **Optimization Layer**: Implemented `node-cache` for high-availability graph data serving.
*   **Unified API Format**: Every endpoint returns a strict `{ success, message, data }` structure.

---

## 📁 Project Structure

```
backend/
├── server.js                    # Entry point & global error boundary
├── config/
│   └── db.js                    # MongoDB connection
├── middleware/
│   ├── auth.js                  # JWT Protection layer
│   ├── error.js                 # Central error handler
│   └── validateObjectId.js      # ID formatting validation
├── models/
│   ├── User.js                  # Graph Node (with bcrypt passwords)
│   └── Connection.js            # Graph Edge
├── controllers/
│   ├── authController.js        # Register / Login logic
│   ├── userController.js        # Search and user CRUD
│   └── graphController.js       # BFS, Caching, Mutuals, and Ranking
├── routes/
│   ├── authRoutes.js            
│   ├── userRoutes.js            
│   └── connectionRoutes.js      
└── utils/
    ├── ErrorResponse.js         # Custom HTTP error class
    └── generateToken.js         # JWT signer
```

---

## ⚙️ Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Edit your `.env` file at the root of `backend/`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/social_network_analyzer
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=30d
```

### 3. Run the Server
```bash
# Production Mode
npm start

# Development Mode (auto-reload)
npm run dev
```

---

## 🔗 API Reference

*Note: All responses follow the `{ success: boolean, message: string, data: object }` format.*

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/register` | Register a new user | Public |
| `POST` | `/login` | Authenticate & get JWT token | Public |

### 👤 Users (`/api/users`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/` | Get all users | Public |
| `GET` | `/search?q=name` | Search users by name | Public |
| `POST` | `/` | Create a user | Private (Token) |
| `DELETE` | `/:id` | Delete user and all their connections | Private (Token) |

### 🧠 Connections & Graph Algorithms (`/api/connections`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/graph` | Get all nodes and edges (Cached) | Public |
| `GET` | `/stats` | Get graph density, avg degree (Cached)| Public |
| `GET` | `/influencer` | Get top users by Degree Centrality | Public |
| `GET` | `/mutual/:id` | Find mutual friends for a user | Public |
| `GET` | `/path/:u1/:u2` | **BFS Shortest Path** between two users| Public |
| `POST` | `/` | Create connection between two users | Private (Token) |
| `GET` | `/` | Get list of all connections | Public |
| `DELETE` | `/:id` | Remove a connection | Private (Token) |

---

## 🔒 Example: Protected Route Call

To call a private route like "Add Connection" or "Delete User", you must include the JWT token in your `Authorization` header:

```javascript
fetch('http://localhost:5000/api/connections', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer YOUR_JWT_TOKEN_HERE`
  },
  body: JSON.stringify({ user1: 'id1', user2: 'id2' })
})
.then(res => res.json())
.then(data => console.log(data));
```

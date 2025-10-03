import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname);
const DB_PATH = path.join(DATA_DIR, "app.db");

function initDb() {
  const db = new Database(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workshops (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      trainer TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration TEXT NOT NULL,
      location TEXT NOT NULL,
      availableSeats INTEGER NOT NULL,
      totalSeats INTEGER NOT NULL,
      category TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      workshopId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(userId, workshopId),
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(workshopId) REFERENCES workshops(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      workshopId TEXT NOT NULL,
      checkedInAt TEXT NOT NULL,
      UNIQUE(userId, workshopId),
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(workshopId) REFERENCES workshops(id) ON DELETE CASCADE
    );
  `);

  const hasAdmin = db.prepare("SELECT 1 FROM users WHERE email=?").get("admin@admin.com");
  if (!hasAdmin) {
    db.prepare("INSERT INTO users (id,name,email,password,role,createdAt) VALUES (?,?,?,?,?,?)")
      .run("admin-1", "Admin", "admin@admin.com", "admin", "admin", new Date().toISOString());
  }
  const hasWorkshop = db.prepare("SELECT 1 FROM workshops LIMIT 1").get();
  if (!hasWorkshop) {
    db.prepare(`INSERT INTO workshops (id,title,description,trainer,date,time,duration,location,availableSeats,totalSeats,category)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        "1",
        "Advanced Leadership Skills",
        "Master leadership with strategies and hands-on exercises.",
        "Sarah Johnson",
        "2025-12-15",
        "09:00",
        "4 hours",
        "Conference Room A",
        8,
        15,
        "Leadership"
      );
  }
  return db;
}

const app = express();
app.use(cors());
app.use(express.json());

// QR Token management
const qrTokens = new Map(); // token -> { userId, workshopId, expiresAt }

// Clean expired tokens every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of qrTokens.entries()) {
    if (data.expiresAt < now) {
      qrTokens.delete(token);
    }
  }
}, 30000);

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Auth (simple login/registration)
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });
  try {
    const id = String(Date.now());
    dbh.prepare("INSERT INTO users (id,name,email,password,role,createdAt) VALUES (?,?,?,?,?,?)")
      .run(id, name, email, password, "user", new Date().toISOString());
    const user = { id, name, email, role: "user" };
    return res.status(201).json({ user });
  } catch (e) {
    console.error("/register error:", e);
    if (String(e).includes("UNIQUE")) return res.status(400).json({ error: "email already registered" });
    return res.status(500).json({ error: "registration failed", detail: String(e) });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  const user = dbh.prepare("SELECT id,name,email,role FROM users WHERE email=? AND password=?").get(email, password);
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  return res.json({ user });
});

// Workshops
app.get("/workshops", async (_req, res) => {
  const rows = dbh.prepare("SELECT * FROM workshops").all();
  res.json(rows);
});

app.post("/workshops", async (req, res) => {
  const { title, description, trainer, date, time, duration, location, totalSeats, category } = req.body || {};
  if (!title || !trainer || !date || !time || !duration || !location || !totalSeats || !category) {
    return res.status(400).json({ error: "missing fields" });
  }
  const id = String(Date.now());
  dbh.prepare(`INSERT INTO workshops (id,title,description,trainer,date,time,duration,location,availableSeats,totalSeats,category)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,
      title,
      description || "",
      trainer,
      date,
      time,
      duration,
      location,
      Number(totalSeats),
      Number(totalSeats),
      category
    );
  const created = dbh.prepare("SELECT * FROM workshops WHERE id=?").get(id);
  res.status(201).json(created);
});

// Reservations
app.post("/reservations", async (req, res) => {
  const { userId, workshopId } = req.body || {};
  if (!userId || !workshopId) return res.status(400).json({ error: "userId and workshopId required" });
  const user = dbh.prepare("SELECT id FROM users WHERE id=?").get(userId);
  const workshop = dbh.prepare("SELECT * FROM workshops WHERE id=?").get(workshopId);
  if (!user || !workshop) return res.status(404).json({ error: "user or workshop not found" });
  // Prevent booking expired workshops (date strictly before today)
  try {
    const today = new Date();
    const wsDate = new Date(`${workshop.date}T00:00:00`);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (wsDate < startOfToday) return res.status(400).json({ error: "workshop expired" });
  } catch {}
  if (workshop.availableSeats <= 0) return res.status(400).json({ error: "workshop full" });
  const exists = dbh.prepare("SELECT 1 FROM reservations WHERE userId=? AND workshopId=?").get(userId, workshopId);
  if (exists) return res.status(400).json({ error: "already reserved" });
  const id = String(Date.now());
  const createdAt = new Date().toISOString();
  const tx = dbh.transaction(() => {
    dbh.prepare("INSERT INTO reservations (id,userId,workshopId,createdAt) VALUES (?,?,?,?)").run(id, userId, workshopId, createdAt);
    dbh.prepare("UPDATE workshops SET availableSeats=availableSeats-1 WHERE id=?").run(workshopId);
  });
  tx();
  const updatedWorkshop = dbh.prepare("SELECT * FROM workshops WHERE id=?").get(workshopId);
  res.status(201).json({ reservation: { id, userId, workshopId, createdAt }, workshop: updatedWorkshop });
});

// List reservations for a user
app.get("/reservations", async (req, res) => {
  const { userId } = req.query || {};
  if (!userId) return res.status(400).json({ error: "userId required" });
  const rows = dbh.prepare("SELECT * FROM reservations WHERE userId=?").all(String(userId));
  res.json(rows);
});

// Cancel reservation
app.delete("/reservations", async (req, res) => {
  const { userId, workshopId } = req.body || {};
  if (!userId || !workshopId) return res.status(400).json({ error: "userId and workshopId required" });
  const exists = dbh.prepare("SELECT * FROM reservations WHERE userId=? AND workshopId=?").get(userId, workshopId);
  if (!exists) return res.status(404).json({ error: "reservation not found" });
  const tx = dbh.transaction(() => {
    dbh.prepare("DELETE FROM reservations WHERE id=?").run(exists.id);
    dbh.prepare("UPDATE workshops SET availableSeats=availableSeats+1 WHERE id=?").run(workshopId);
  });
  tx();
  const updatedWorkshop = dbh.prepare("SELECT * FROM workshops WHERE id=?").get(workshopId);
  res.json({ ok: true, workshop: updatedWorkshop });
});

// Admin data
app.get("/admin/overview", async (_req, res) => {
  const users = dbh.prepare("SELECT id,name,email,role,createdAt FROM users").all();
  const workshops = dbh.prepare("SELECT * FROM workshops").all();
  const reservations = dbh.prepare("SELECT * FROM reservations").all();
  const attendance = dbh.prepare("SELECT * FROM attendance").all();
  res.json({ users, workshops, reservations, attendance });
});

// Generate QR token for user
app.post("/qr/generate", async (req, res) => {
  const { userId, workshopId } = req.body || {};
  if (!userId || !workshopId) return res.status(400).json({ error: "userId and workshopId required" });
  
  // Verify user has reservation
  const reservation = dbh.prepare("SELECT 1 FROM reservations WHERE userId=? AND workshopId=?").get(userId, workshopId);
  if (!reservation) return res.status(400).json({ error: "No reservation found" });
  
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 10000; // 10 seconds
  
  qrTokens.set(token, { userId, workshopId, expiresAt });
  
  res.json({ token, expiresAt });
});

// Validate QR token and mark attendance
app.post("/qr/validate", async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "token required" });
  
  const tokenData = qrTokens.get(token);
  if (!tokenData) return res.status(400).json({ error: "Invalid or expired token" });
  
  if (tokenData.expiresAt < Date.now()) {
    qrTokens.delete(token);
    return res.status(400).json({ error: "Token expired" });
  }
  
  const { userId, workshopId } = tokenData;
  
  // Get user details
  const user = dbh.prepare("SELECT id,name,email FROM users WHERE id=?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  
  // Check if already attended
  const existing = dbh.prepare("SELECT 1 FROM attendance WHERE userId=? AND workshopId=?").get(userId, workshopId);
  if (existing) {
    qrTokens.delete(token);
    return res.status(400).json({ error: "Already checked in" });
  }
  
  // Mark attendance
  const attendanceId = String(Date.now());
  const checkedInAt = new Date().toISOString();
  dbh.prepare("INSERT INTO attendance (id,userId,workshopId,checkedInAt) VALUES (?,?,?,?)").run(attendanceId, userId, workshopId, checkedInAt);
  
  // Clean up token
  qrTokens.delete(token);
  
  // Broadcast attendance event
  broadcastEvent("attendance", {
    id: attendanceId,
    userId,
    userName: user.name,
    userEmail: user.email,
    workshopId,
    checkedInAt
  });
  
  res.json({ 
    success: true, 
    user: { id: user.id, name: user.name, email: user.email },
    workshopId,
    checkedInAt
  });
});

// Server-Sent Events for realtime notifications
const sseClients = new Set();
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const client = res;
  sseClients.add(client);
  req.on("close", () => {
    sseClients.delete(client);
  });
});

function broadcastEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch {}
  }
}

const PORT = process.env.PORT || 3001;
const dbh = initDb();
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});



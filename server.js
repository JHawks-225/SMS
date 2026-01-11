const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("."));

/* ===== DONNÉES ===== */
let demandes = [];
let autorises = [];
let messages = [];
let onlineUsers = {}; // pseudo => socketId

function randomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

/* ===== ROUTES ===== */
app.post("/register", (req, res) => {
  const { pseudo, nom, numero, visibleNom } = req.body;
  if (!pseudo || !numero) return res.status(400).json({ error: "Champs requis" });
  
  // Éviter les doublons
  if (demandes.find(u => u.pseudo === pseudo) || autorises.find(u => u.pseudo === pseudo)) {
    return res.status(400).json({ error: "Déjà existant" });
  }

  demandes.push({ pseudo, nom, numero, visibleNom });
  res.json({ ok: true });
});

app.get("/status", (req, res) => {
  const pseudo = req.query.pseudo;
  const ok = autorises.find(u => u.pseudo === pseudo);
  res.json({ accepted: !!ok });
});

/* ===== ADMIN ===== */
app.get("/admin/demandes", (req, res) => res.json(demandes));

app.post("/admin/valider", (req, res) => {
  const { pseudo } = req.body;
  const index = demandes.findIndex(u => u.pseudo === pseudo);
  if (index !== -1) {
    const user = demandes.splice(index, 1)[0];
    user.couleur = randomColor();
    autorises.push(user);
  }
  res.json({ ok: true });
});

app.get("/download", (req, res) => {
  fs.writeFileSync("chat_history.json", JSON.stringify(messages, null, 2));
  res.download("chat_history.json");
});

/* ===== REAL-TIME ===== */
io.on("connection", (socket) => {
  socket.on("registerSocket", (pseudo) => {
    socket.pseudo = pseudo;
    onlineUsers[pseudo] = socket.id;
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  socket.on("message", (data) => {
    messages.push(data);
    if (data.type === "general") {
      io.emit("message", data);
    } else if (data.type === "private") {
      const targetId = onlineUsers[data.to];
      if (targetId) io.to(targetId).emit("message", data);
      socket.emit("message", data); 
    }
  });

  socket.on("disconnect", () => {
    if (socket.pseudo) delete onlineUsers[socket.pseudo];
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });
});

server.listen(3000, () => console.log("🚀 Serveur lancé sur http://localhost:3000"));

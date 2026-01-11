const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("."));

let demandes = [];
let autorises = [];
let messages = [];
let onlineUsers = [];

function randomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

// Inscription
app.post("/register", (req, res) => {
  const { pseudo, nom, numero, visibleNom } = req.body;
  if (!pseudo) return res.status(400).json({ error: "Pseudo requis" });
  
  const user = { pseudo, nom, numero, visibleNom };
  demandes.push(user);
  res.json({ ok: true });
});

// Vérification du statut (Correction ici)
app.get("/status", (req, res) => {
  const pseudo = req.query.pseudo;
  const ok = autorises.find(u => u.pseudo === pseudo);
  res.json({ accepted: !!ok });
});

// Admin
app.get("/admin/demandes", (req, res) => res.json(demandes));

app.post("/admin/valider", (req, res) => {
  const { pseudo } = req.body;
  const user = demandes.find(u => u.pseudo === pseudo);
  if (user) {
    user.couleur = randomColor();
    autorises.push(user);
    demandes = demandes.filter(u => u.pseudo !== pseudo);
  }
  res.json({ ok: true });
});

app.get("/download", (req, res) => {
  fs.writeFileSync("chat_history.json", JSON.stringify(messages, null, 2));
  res.download("chat_history.json");
});

// Socket.io pour le temps réel
io.on("connection", socket => {
  socket.on("registerSocket", pseudo => {
    socket.pseudo = pseudo;
    if (!onlineUsers.includes(pseudo)) onlineUsers.push(pseudo);
    io.emit("onlineUsers", onlineUsers);
  });

  socket.on("message", data => {
    messages.push(data);
    io.emit("message", data); // Diffusion à tous
  });

  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter(p => p !== socket.pseudo);
    io.emit("onlineUsers", onlineUsers);
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Serveur sur http://localhost:${PORT}`));

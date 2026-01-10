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
let users = {};       // pseudo => user
let onlineUsers = []; // pseudos connectés

/* ===== UTIL ===== */
function randomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

/* ===== INSCRIPTION ===== */
app.post("/register", (req, res) => {
  const { pseudo, nom, numero, visibleNom } = req.body;

  if (!pseudo || !numero) {
    return res.status(400).json({ error: "Pseudo et numéro requis" });
  }

  if (
    demandes.find(u => u.pseudo === pseudo) ||
    autorises.find(u => u.pseudo === pseudo)
  ) {
    return res.status(400).json({ error: "Pseudo déjà utilisé" });
  }

  const user = { pseudo, nom, numero, visibleNom };
  demandes.push(user);

  console.log("📩 Nouvelle demande :", pseudo);
  res.json({ ok: true });
});

/* ===== STATUS UTILISATEUR ===== */
app.get("/status/:pseudo", (req, res) => {
  const ok = autorises.find(u => u.pseudo === req.params.pseudo);
  res.json({ accepted: !!ok });
});

/* ===== ADMIN ===== */
app.get("/admin/demandes", (req, res) => {
  res.json(demandes);
});

app.post("/admin/valider", (req, res) => {
  const { pseudo } = req.body;
  const user = demandes.find(u => u.pseudo === pseudo);

  if (user) {
    user.couleur = randomColor();
    autorises.push(user);
    users[pseudo] = user;
    demandes = demandes.filter(u => u.pseudo !== pseudo);
    console.log("✅ Utilisateur validé :", pseudo);
  }

  res.json({ ok: true });
});

/* ===== LISTE UTILISATEURS ===== */
app.get("/users", (req, res) => {
  res.json(autorises);
});

/* ===== TÉLÉCHARGEMENT HISTORIQUE ===== */
app.get("/download", (req, res) => {
  fs.writeFileSync("chat_history.json", JSON.stringify(messages, null, 2));
  res.download("chat_history.json");
});

/* ===== SOCKET.IO ===== */
io.on("connection", socket => {

  socket.on("registerSocket", pseudo => {
    socket.pseudo = pseudo;

    if (!onlineUsers.includes(pseudo)) {
      onlineUsers.push(pseudo);
    }

    io.emit("onlineUsers", onlineUsers);
  });

  socket.on("disconnect", () => {
    if (socket.pseudo) {
      onlineUsers = onlineUsers.filter(p => p !== socket.pseudo);
      io.emit("onlineUsers", onlineUsers);
    }
  });

  socket.on("message", data => {
    messages.push(data);

    if (data.type === "general") {
      io.emit("message", data);

    } else if (data.type === "private") {
      for (const s of io.sockets.sockets.values()) {
        if (s.pseudo === data.to || s.pseudo === data.from) {
          s.emit("message", data);
        }
      }

    } else if (data.type === "group") {
      for (const s of io.sockets.sockets.values()) {
        if (data.members.includes(s.pseudo)) {
          s.emit("message", data);
        }
      }
    }
  });
});

/* ===== LANCEMENT ===== */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Serveur lancé sur le port", PORT);
});

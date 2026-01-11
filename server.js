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
let onlineUsers = {}; // Objet pour stocker pseudo => socketId

app.post("/register", (req, res) => {
  const { pseudo, nom, numero, visibleNom } = req.body;
  if (!pseudo || !numero) return res.status(400).json({ error: "Requis" });
  demandes.push({ pseudo, nom, numero, visibleNom });
  res.json({ ok: true });
});

app.get("/status", (req, res) => {
  const pseudo = req.query.pseudo;
  const ok = autorises.find(u => u.pseudo === pseudo);
  res.json({ accepted: !!ok });
});

// Admin Panel Functions
app.get("/admin/demandes", (req, res) => res.json(demandes));
app.post("/admin/valider", (req, res) => {
  const { pseudo } = req.body;
  const user = demandes.find(u => u.pseudo === pseudo);
  if (user) {
    autorises.push(user);
    demandes = demandes.filter(u => u.pseudo !== pseudo);
  }
  res.json({ ok: true });
});

app.get("/download", (req, res) => {
  fs.writeFileSync("chat_history.json", JSON.stringify(messages, null, 2));
  res.download("chat_history.json");
});

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
      socket.emit("message", data); // Retour à l'envoyeur
    }
  });

  socket.on("disconnect", () => {
    if (socket.pseudo) delete onlineUsers[socket.pseudo];
    io.emit("onlineUsers", Object.keys(onlineUsers));
  });
});

server.listen(3000, () => console.log("🚀 Port 3000"));

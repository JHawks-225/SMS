const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
// On sert les fichiers statiques à la racine
app.use(express.static(".")); 

// --- DONNÉES ---
let demandes = [];
let autorises = [];
let messages = [];
let users = {}; 
let onlineUsers = [];

// --- SÉCURITÉ ADMIN ---
// Le code d'accès que vous avez choisi
const ADMIN_PASSWORD = "10009";

// Middleware pour protéger les routes et le fichier admin.html
app.use((req, res, next) => {
  // On protège le fichier admin.html et toutes les routes commençant par /admin
  if (req.url.startsWith("/admin.html") || req.url.startsWith("/admin/")) {
    if (req.query.pw === ADMIN_PASSWORD) {
      next();
    } else {
      res.status(403).send("<h1>Accès refusé</h1><p>Vous n'avez pas l'autorisation d'accéder à cette page.</p>");
    }
  } else {
    next();
  }
});

// --- ROUTES ---

// Inscription
app.post("/register", (req, res) => {
  const { pseudo, nom, visibleNom } = req.body;
  if (!pseudo) return res.status(400).send("Pseudo requis");
  if (demandes.find(u => u.pseudo === pseudo) || autorises.find(u => u.pseudo === pseudo))
    return res.status(400).send("Pseudo déjà demandé ou autorisé");
  demandes.push({ pseudo, nom, visibleNom });
  res.send("Demande envoyée, en attente de validation");
});

// Vérifier accès chat
app.get("/check/:pseudo", (req, res) => {
  const ok = autorises.find(u => u.pseudo === req.params.pseudo);
  res.json({ ok: !!ok });
});

// Admin - lister demandes
app.get("/admin/demandes", (req, res) => res.json(demandes));

// Admin - valider pseudo
app.post("/admin/valider", (req, res) => {
  const pseudo = req.body.pseudo;
  const user = demandes.find(u => u.pseudo === pseudo);
  if (user) {
    user.couleur = "#" + Math.floor(Math.random() * 16777215).toString(16);
    autorises.push(user);
    users[pseudo] = user;
    demandes = demandes.filter(u => u.pseudo !== pseudo);
  }
  res.sendStatus(200);
});

// Lister utilisateurs validés
app.get("/users", (req, res) => res.json(autorises));

// Télécharger historique
app.get("/download", (req, res) => {
  fs.writeFileSync("chat_history.json", JSON.stringify(messages, null, 2));
  res.download("chat_history.json");
});

// --- SOCKET.IO ---
io.on("connection", socket => {
  socket.on("registerSocket", pseudo => {
    socket.pseudo = pseudo;
    if (!onlineUsers.includes(pseudo)) onlineUsers.push(pseudo);
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
      const sockets = Array.from(io.sockets.sockets.values());
      sockets.forEach(s => {
        if (s.pseudo === data.to || s.pseudo === data.from)
          s.emit("message", data);
      });
    }
  });
});

// --- LANCEMENT ---
// Utilisation du port dynamique pour Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Serveur lancé sur le port " + PORT));
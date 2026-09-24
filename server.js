const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const PLATFORM_URL = process.env.PLATFORM_URL || "";

const projectsDir = path.join(__dirname, "projects");
fs.mkdirSync(projectsDir, { recursive: true });

app.use(express.json({ limit: "100mb" }));
app.use(express.static(__dirname));

function safeName(value) {
  return String(value || "Untitled")
    .replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄ _-]/g, "_")
    .trim()
    .slice(0, 80) || "Untitled";
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "ZYVO Creator 3D V2" });
});

app.get("/api/projects", (req, res) => {
  const items = fs.readdirSync(projectsDir)
    .filter(x => x.endsWith(".zyvo"))
    .map(file => ({
      file,
      name: file.replace(/\.zyvo$/i, ""),
      updatedAt: fs.statSync(path.join(projectsDir, file)).mtime
    }));
  res.json(items);
});

app.post("/api/projects", (req, res) => {
  try {
    const project = req.body;
    if (!project || project.format !== "ZYVO") {
      return res.status(400).json({ error: "Невірний ZYVO проєкт." });
    }

    const file = safeName(project.name) + ".zyvo";
    fs.writeFileSync(
      path.join(projectsDir, file),
      JSON.stringify(project, null, 2),
      "utf8"
    );

    res.json({ ok: true, file });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Не вдалося зберегти проєкт." });
  }
});

app.get("/api/projects/:file", (req, res) => {
  const file = path.basename(req.params.file);
  if (!file.endsWith(".zyvo")) return res.status(400).json({ error: "Потрібен .zyvo" });

  const full = path.join(projectsDir, file);
  if (!fs.existsSync(full)) return res.status(404).json({ error: "Проєкт не знайдено." });

  res.type("application/json").send(fs.readFileSync(full, "utf8"));
});

/*
  Якщо PLATFORM_URL заданий, Creator може передати опубліковану гру
  на POST ${PLATFORM_URL}/api/published-games.
*/
app.post("/api/publish", async (req, res) => {
  try {
    const project = req.body;
    if (!project || project.format !== "ZYVO") {
      return res.status(400).json({ error: "Невірний ZYVO проєкт." });
    }

    const file = safeName(project.name) + ".zyvo";
    fs.writeFileSync(
      path.join(projectsDir, file),
      JSON.stringify(project, null, 2),
      "utf8"
    );

    if (!PLATFORM_URL) {
      return res.json({
        ok: true,
        saved: true,
        sentToPlatform: false,
        message: "Збережено локально. Додай PLATFORM_URL, щоб надсилати гру на платформу."
      });
    }

    const target = PLATFORM_URL.replace(/\/$/, "") + "/api/published-games";
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project)
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(502).json({
        error: "Платформа відхилила публікацію.",
        platform: text.slice(0, 500)
      });
    }

    res.json({
      ok: true,
      saved: true,
      sentToPlatform: true,
      platform: text.slice(0, 500)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка публікації." });
  }
});

/* Простий realtime multiplayer для прев'ю гри. */
const rooms = new Map();

io.on("connection", socket => {
  socket.on("joinGame", ({ gameId, nickname }) => {
    const room = String(gameId || "preview");
    socket.join(room);

    if (!rooms.has(room)) rooms.set(room, new Map());
    const players = rooms.get(room);

    players.set(socket.id, {
      id: socket.id,
      nickname: String(nickname || "Player").slice(0, 24),
      x: 0, y: 1, z: 0,
      yaw: 0,
      health: 100
    });

    socket.emit("players", [...players.values()]);
    socket.to(room).emit("playerJoined", players.get(socket.id));
  });

  socket.on("state", data => {
    for (const [room, players] of rooms.entries()) {
      if (!players.has(socket.id)) continue;
      const p = players.get(socket.id);
      p.x = Number(data.x) || 0;
      p.y = Number(data.y) || 0;
      p.z = Number(data.z) || 0;
      p.yaw = Number(data.yaw) || 0;
      p.health = Math.max(0, Math.min(100, Number(data.health) || 100));
      socket.to(room).emit("playerState", p);
      break;
    }
  });

  socket.on("shoot", data => {
    for (const [room, players] of rooms.entries()) {
      if (!players.has(socket.id)) continue;
      const target = players.get(String(data.targetId));
      if (!target) return;

      target.health -= Math.max(1, Math.min(100, Number(data.damage) || 25));

      if (target.health <= 0) {
        target.health = 0;
        io.to(room).emit("playerKilled", {
          victimId: target.id,
          killerId: socket.id
        });

        setTimeout(() => {
          if (!players.has(target.id)) return;
          target.health = 100;
          target.x = 0; target.y = 1; target.z = 0;
          io.to(room).emit("playerRespawn", target);
        }, 1200);
      } else {
        io.to(room).emit("playerHit", {
          targetId: target.id,
          health: target.health
        });
      }
      break;
    }
  });

  socket.on("disconnect", () => {
    for (const [room, players] of rooms.entries()) {
      if (!players.has(socket.id)) continue;
      players.delete(socket.id);
      socket.to(room).emit("playerLeft", socket.id);
      if (!players.size) rooms.delete(room);
    }
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ZYVO Creator 3D running on ${PORT}`);
});

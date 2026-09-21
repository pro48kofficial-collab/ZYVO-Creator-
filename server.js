const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

const games = new Map();

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "ZYVO Creator",
    version: "1.0.0"
  });
});

app.get("/api/games", (req, res) => {
  res.json([...games.values()]);
});

app.post("/api/games", (req, res) => {
  const title = String(req.body.title || "")
    .trim()
    .slice(0, 60);

  const author = String(req.body.author || "")
    .trim()
    .slice(0, 24);

  const description = String(
    req.body.description || ""
  )
    .trim()
    .slice(0, 300);

  if (!title) {
    return res.status(400).json({
      error: "Введи назву гри."
    });
  }

  if (!author) {
    return res.status(400).json({
      error: "Введи ім'я творця."
    });
  }

  const id =
    "game-" +
    Math.random()
      .toString(36)
      .slice(2, 10);

  const game = {
    id,
    title,
    author,
    description,
    players: 0,
    earnedCoins: 0,
    published: false,
    objects: [],
    createdAt: Date.now()
  };

  games.set(id, game);

  res.json(game);
});

app.put("/api/games/:id", (req, res) => {
  const game = games.get(req.params.id);

  if (!game) {
    return res.status(404).json({
      error: "Гру не знайдено."
    });
  }

  if (Array.isArray(req.body.objects)) {
    game.objects = req.body.objects.slice(0, 500);
  }

  games.set(game.id, game);

  res.json(game);
});

app.post("/api/games/:id/publish", (req, res) => {
  const game = games.get(req.params.id);

  if (!game) {
    return res.status(404).json({
      error: "Гру не знайдено."
    });
  }

  game.published = true;
  game.publishedAt = Date.now();

  games.set(game.id, game);

  res.json({
    ok: true,
    game
  });
});

app.get(/.*/, (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `ZYVO Creator running on port ${PORT}`
  );
});

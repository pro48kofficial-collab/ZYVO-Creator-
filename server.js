const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const projectsDir = path.join(__dirname, "projects");

fs.mkdirSync(projectsDir, { recursive: true });
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "ZYVO Creator 3D" });
});

app.get("/api/projects", (req, res) => {
  try {
    res.json(fs.readdirSync(projectsDir)
      .filter(f => f.endsWith(".zyvo"))
      .map(f => ({
        name: f.replace(/\.zyvo$/i, ""),
        file: f,
        updatedAt: fs.statSync(path.join(projectsDir, f)).mtime
      })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Не вдалося прочитати проєкти." });
  }
});

app.post("/api/projects", (req, res) => {
  try {
    const project = req.body;
    if (!project || project.format !== "ZYVO") {
      return res.status(400).json({ error: "Невірний .zyvo проєкт." });
    }

    const safeName = String(project.name || "Untitled")
      .replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄ _-]/g, "_")
      .trim().slice(0, 80) || "Untitled";

    const file = safeName + ".zyvo";
    fs.writeFileSync(
      path.join(projectsDir, file),
      JSON.stringify(project, null, 2),
      "utf8"
    );

    res.json({ ok: true, file, name: safeName });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Не вдалося зберегти .zyvo." });
  }
});

app.get("/api/projects/:file", (req, res) => {
  const file = path.basename(req.params.file);
  if (!file.endsWith(".zyvo")) {
    return res.status(400).json({ error: "Потрібен .zyvo файл." });
  }
  const full = path.join(projectsDir, file);
  if (!fs.existsSync(full)) {
    return res.status(404).json({ error: "Проєкт не знайдено." });
  }
  res.type("application/json").send(fs.readFileSync(full, "utf8"));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("ZYVO Creator 3D running on " + PORT);
});
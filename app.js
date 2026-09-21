let games = [];
let currentGame = null;
let selectedTool = "block";

async function loadGames() {
  const box = document.getElementById("games");

  box.innerHTML = "Завантаження...";

  try {
    const response = await fetch("/api/games");

    if (!response.ok) {
      throw new Error("Server error");
    }

    games = await response.json();

    renderGames();
    updateStats();

  } catch (error) {
    console.error(error);

    box.innerHTML = `
      <div class="game">
        ❌ Не вдалося завантажити ігри.
      </div>
    `;
  }
}


function renderGames() {
  const box = document.getElementById("games");

  if (!games.length) {
    box.innerHTML = `
      <div class="game">
        🎮 У тебе ще немає ігор.
      </div>
    `;

    return;
  }

  box.innerHTML = games.map(function(game) {
    return `
      <div class="game">
        <div class="game-title">
          🎮 ${escapeHtml(game.title)}
        </div>

        <div class="game-info">
          👤 ${escapeHtml(game.author)}
          • 👥 ${game.players || 0} гравців
        </div>

        <div class="game-buttons">
          <button onclick="openEditor('${game.id}')">
            🧱 Редактор
          </button>

          <button onclick="publishGameById('${game.id}')">
            🚀 Опублікувати
          </button>
        </div>
      </div>
    `;
  }).join("");
}


function showCreate() {
  document
    .getElementById("createPanel")
    .classList.remove("hidden");

  document
    .getElementById("gameTitle")
    .focus();
}


function hideCreate() {
  document
    .getElementById("createPanel")
    .classList.add("hidden");
}


async function createGame() {
  const title =
    document.getElementById("gameTitle").value.trim();

  const author =
    document.getElementById("gameAuthor").value.trim();

  const description =
    document.getElementById("gameDescription").value.trim();

  const result =
    document.getElementById("createResult");

  if (!title) {
    result.textContent = "Введи назву гри.";
    return;
  }

  if (!author) {
    result.textContent = "Введи ім'я творця.";
    return;
  }

  result.textContent = "Створення...";

  try {
    const response = await fetch("/api/games", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        author,
        description
      })
    });

    const data = await response.json();

    if (!response.ok) {
      result.textContent =
        data.error || "Помилка створення.";
      return;
    }

    result.textContent =
      "✅ Гру створено!";

    document.getElementById("gameTitle").value = "";
    document.getElementById("gameDescription").value = "";

    await loadGames();

    setTimeout(function() {
      hideCreate();
      openEditor(data.id);
    }, 500);

  } catch (error) {
    console.error(error);

    result.textContent =
      "❌ Сервер недоступний.";
  }
}


function openEditor(id) {
  const game = games.find(function(item) {
    return item.id === id;
  });

  if (!game) {
    return;
  }

  currentGame = game;

  document
    .getElementById("editorPanel")
    .classList.remove("hidden");

  document.getElementById("editorGameName").textContent =
    game.title;

  clearCanvas();

  if (Array.isArray(game.objects)) {
    game.objects.forEach(function(object) {
      createObject(
        object.x,
        object.y,
        object.type
      );
    });
  }

  document
    .getElementById("editorPanel")
    .scrollIntoView({
      behavior: "smooth"
    });
}


function closeEditor() {
  currentGame = null;

  document
    .getElementById("editorPanel")
    .classList.add("hidden");
}


function selectTool(tool) {
  selectedTool = tool;
}


function createObject(x, y, type) {
  const canvas =
    document.getElementById("gameCanvas");

  const object =
    document.createElement("div");

  object.className = "editor-object";

  object.style.left = x + "px";
  object.style.top = y + "px";

  if (type === "spawn") {
    object.textContent = "🟢";
  } else if (type === "coin") {
    object.textContent = "🪙";
  } else {
    object.textContent = "🧱";
  }

  object.dataset.type = type;

  object.addEventListener("click", function(event) {
    event.stopPropagation();

    if (selectedTool === "delete") {
      object.remove();
    }
  });

  canvas.appendChild(object);
}


document
  .getElementById("gameCanvas")
  .addEventListener("click", function(event) {

    if (selectedTool === "delete") {
      return;
    }

    const rect =
      this.getBoundingClientRect();

    let x =
      event.clientX -
      rect.left -
      15;

    let y =
      event.clientY -
      rect.top -
      15;

    x = Math.max(
      0,
      Math.min(x, rect.width - 30)
    );

    y = Math.max(
      0,
      Math.min(y, rect.height - 30)
    );

    createObject(
      Math.round(x),
      Math.round(y),
      selectedTool
    );
  });


function clearCanvas() {
  const canvas =
    document.getElementById("gameCanvas");

  canvas.querySelectorAll(".editor-object")
    .forEach(function(object) {
      object.remove();
    });
}


async function saveEditor() {
  if (!currentGame) {
    return;
  }

  const objects =
    [...document.querySelectorAll(".editor-object")]
      .map(function(object) {
        return {
          x: parseInt(object.style.left) || 0,
          y: parseInt(object.style.top) || 0,
          type: object.dataset.type || "block"
        };
      });

  try {
    const response = await fetch(
      "/api/games/" + currentGame.id,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          objects
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Save error"
      );
    }

    currentGame.objects = objects;

    document.getElementById("editorMessage")
      .textContent =
      "✅ Гру збережено.";

    await loadGames();

  } catch (error) {
    console.error(error);

    document.getElementById("editorMessage")
      .textContent =
      "❌ Не вдалося зберегти.";
  }
}


async function publishGame() {
  if (!currentGame) {
    return;
  }

  await publishGameById(currentGame.id);
}


async function publishGameById(id) {
  try {
    const response = await fetch(
      "/api/games/" + id + "/publish",
      {
        method: "POST"
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Не вдалося опублікувати.");
      return;
    }

    alert("🚀 Гру опубліковано на ZYVO!");

    await loadGames();

  } catch (error) {
    console.error(error);

    alert("❌ Сервер недоступний.");
  }
}


function updateStats() {
  document.getElementById("gameCount")
    .textContent = games.length;

  const players =
    games.reduce(function(total, game) {
      return total + (game.players || 0);
    }, 0);

  document.getElementById("totalPlayers")
    .textContent = players;

  const coins =
    games.reduce(function(total, game) {
      return total + (game.earnedCoins || 0);
    }, 0);

  document.getElementById("earnedCoins")
    .textContent = coins;
}


function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    function(char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    }
  );
}


document.addEventListener(
  "DOMContentLoaded",
  function() {
    loadGames();
  }
);

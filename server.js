const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const PORT =
  process.env.PORT || 3000;

const db = new Pool({
  connectionString:
    process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  }
});

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.static(__dirname)
);

/* DATABASE */

async function initDB() {

  await db.query(`
    CREATE TABLE IF NOT EXISTS games (

      id SERIAL PRIMARY KEY,

      title VARCHAR(100)
        NOT NULL,

      author VARCHAR(50)
        NOT NULL,

      description TEXT
        DEFAULT '',

      objects JSONB
        DEFAULT '[]',

      players INTEGER
        DEFAULT 0,

      earned_coins INTEGER
        DEFAULT 0,

      published BOOLEAN
        DEFAULT FALSE,

      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

    )
  `);
}

/* HEALTH */

app.get(
  "/api/health",
  async (req, res) => {

    try {

      await db.query(
        "SELECT 1"
      );

      res.json({
        ok: true,
        database:
          "connected"
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        ok: false,
        database:
          "error"
      });
    }
  }
);

/* ALL GAMES */

app.get(
  "/api/games",
  async (req, res) => {

    try {

      const result =
        await db.query(`
          SELECT
            id,
            title,
            author,
            description,
            objects,
            players,
            earned_coins
              AS "earnedCoins",
            published

          FROM games

          ORDER BY id DESC
        `);

      res.json(
        result.rows
      );

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Не вдалося завантажити ігри."
      });
    }
  }
);

/* CREATE GAME */

app.post(
  "/api/games",
  async (req, res) => {

    try {

      const title =
        String(
          req.body.title || ""
        )
          .trim()
          .slice(0, 100);

      const author =
        String(
          req.body.author || ""
        )
          .trim()
          .slice(0, 50);

      const description =
        String(
          req.body.description || ""
        )
          .trim()
          .slice(0, 1000);

      if (!title) {

        return res.status(400).json({
          error:
            "Введи назву гри."
        });
      }

      if (!author) {

        return res.status(400).json({
          error:
            "Введи ім'я творця."
        });
      }

      const result =
        await db.query(
          `
          INSERT INTO games
            (
              title,
              author,
              description
            )

          VALUES
            ($1, $2, $3)

          RETURNING
            id,
            title,
            author,
            description,
            objects,
            players,
            earned_coins
              AS "earnedCoins",
            published
          `,
          [
            title,
            author,
            description
          ]
        );

      res.json(
        result.rows[0]
      );

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Не вдалося створити гру."
      });
    }
  }
);

/* SAVE GAME */

app.put(
  "/api/games/:id",
  async (req, res) => {

    try {

      const objects =
        req.body.objects;

      if (!Array.isArray(objects)) {

        return res.status(400).json({
          error:
            "Неправильні дані об'єктів."
        });
      }

      const cleanObjects =
        objects
          .slice(0, 1000)
          .map(
            function(object) {

              return {
                x:
                  Number(
                    object.x
                  ) || 0,

                y:
                  Number(
                    object.y
                  ) || 0,

                type:
                  String(
                    object.type ||
                    "block"
                  )
              };

            }
          );

      const result =
        await db.query(
          `
          UPDATE games

          SET objects = $1

          WHERE id = $2

          RETURNING
            id,
            title,
            author,
            description,
            objects,
            players,
            earned_coins
              AS "earnedCoins",
            published
          `,
          [
            JSON.stringify(
              cleanObjects
            ),
            req.params.id
          ]
        );

      if (!result.rows.length) {

        return res.status(404).json({
          error:
            "Гру не знайдено."
        });
      }

      res.json(
        result.rows[0]
      );

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Не вдалося зберегти гру."
      });
    }
  }
);

/* PUBLISH */

app.post(
  "/api/games/:id/publish",
  async (req, res) => {

    try {

      const result =
        await db.query(
          `
          UPDATE games

          SET published = TRUE

          WHERE id = $1

          RETURNING
            id,
            title,
            author,
            description,
            objects,
            players,
            earned_coins
              AS "earnedCoins",
            published
          `,
          [
            req.params.id
          ]
        );

      if (!result.rows.length) {

        return res.status(404).json({
          error:
            "Гру не знайдено."
        });
      }

      res.json({
        ok: true,
        game:
          result.rows[0]
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Не вдалося опублікувати гру."
      });
    }
  }
);

/* FRONTEND */

app.get(
  /.*/,
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }
);

/* START */

initDB()
  .then(
    function() {

      app.listen(
        PORT,
        "0.0.0.0",
        function() {

          console.log(
            `ZYVO Creator running on ${PORT}`
          );

        }
      );

    }
  )
  .catch(
    function(error) {

      console.error(
        "Database initialization failed:",
        error
      );

      process.exit(1);
    }
  );

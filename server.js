const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const app = express();

const server =
  http.createServer(app);

const io =
  new Server(server, {
    cors: {
      origin: "*"
    }
  });


const PORT =
  process.env.PORT || 3000;


const pool =
  new Pool({
    connectionString:
      process.env.DATABASE_URL,

    ssl:
      process.env.DATABASE_URL
        ? {
            rejectUnauthorized: false
          }
        : false
  });


app.use(
  express.json({
    limit: "25mb"
  })
);


app.use(
  express.static(__dirname)
);


async function initDB() {

  if (!process.env.DATABASE_URL) {

    console.warn(
      "DATABASE_URL не встановлено"
    );

    return;

  }


  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      project JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS published_games (
      id SERIAL PRIMARY KEY,
      title TEXT,
      description TEXT,
      multiplayer BOOLEAN DEFAULT FALSE,
      project JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

}


app.get(
  "/api/health",
  async (req, res) => {

    try {

      if (process.env.DATABASE_URL) {
        await pool.query(
          "SELECT 1"
        );
      }


      res.json({
        ok: true
      });


    } catch (error) {

      res.status(500).json({
        ok: false,
        error: error.message
      });

    }

  }
);


app.post(
  "/api/projects",
  async (req, res) => {

    try {

      if (!process.env.DATABASE_URL) {

        return res.json({
          saved: "localStorage"
        });

      }


      const result =
        await pool.query(
          `
          INSERT INTO projects(project)
          VALUES($1)
          RETURNING id
          `,
          [
            req.body.project
          ]
        );


      res.json({
        id:
          result.rows[0].id
      });


    } catch (error) {

      console.error(error);


      res.status(500).json({
        error:
          "Не вдалося зберегти проєкт"
      });

    }

  }
);


app.get(
  "/api/projects/:id",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT project
          FROM projects
          WHERE id=$1
          `,
          [
            req.params.id
          ]
        );


      if (!result.rows[0]) {

        return res
          .status(404)
          .json({
            error: "Not found"
          });

      }


      res.json(
        result.rows[0].project
      );


    } catch {

      res.status(500).json({
        error:
          "Database error"
      });

    }

  }
);


app.post(
  "/api/publish",
  async (req, res) => {

    try {

      const platform =
        process.env.PLATFORM_URL;


      if (!platform) {

        return res
          .status(500)
          .json({
            error:
              "PLATFORM_URL не встановлено"
          });

      }


      const url =
        platform.replace(
          /\/$/,
          ""
        ) + "/api/games";


      const response =
        await fetch(
          url,
          {

            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                req.body
              )

          }
        );


      if (!response.ok) {

        const text =
          await response.text();

        return res
          .status(response.status)
          .send(text);

      }


      res.json({
        ok: true
      });


    } catch (error) {

      console.error(error);


      res.status(500).json({
        error:
          "Не вдалося передати гру на платформу"
      });

    }

  }
);


const players =
  new Map();


io.on(
  "connection",
  socket => {

    const player = {

      id: socket.id,

      x: 0,

      y: 1,

      z: 0

    };


    players.set(
      socket.id,
      player
    );


    socket.emit(
      "players",
      [...players.values()]
    );


    socket.broadcast.emit(
      "player",
      player
    );


    socket.on(
      "move",
      position => {

        const current =
          players.get(
            socket.id
          );


        if (!current) {
          return;
        }


        current.x =
          Number(position.x) || 0;

        current.y =
          Number(position.y) || 1;

        current.z =
          Number(position.z) || 0;


        socket.broadcast.emit(
          "player",
          current
        );

      }
    );


    socket.on(
      "disconnect",
      () => {

        players.delete(
          socket.id
        );


        io.emit(
          "playerLeft",
          socket.id
        );

      }
    );

  }
);


app.get(
  "*",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);


initDB()
  .catch(error => {

    console.error(
      "Database initialization failed:",
      error
    );

  })
  .finally(() => {

    server.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          `ZYVO Creator running on ${PORT}`
        );

      }
    );

  });

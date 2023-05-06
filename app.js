const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const intilizeDbAndServer = async () => {
  try {
    db = open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server started");
    });
  } catch (e) {
    console.log(`Error Details ${e.message}`);
  }
};
intilizeDbAndServer();

//API 1
app.post(`/register/`, async (request, response) => {
  const { username, password, name, gender } = request.body;
  console.log(username);
  const userDetails = `
  SELECT * FROM user WHERE
  username = '${username}'
  `;
  const userArray = await db.get(userDetails);
  console.log(userArray);

  if (userArray !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      response.status(200);
      response.send("User created successfully");
    }
  }
});

module.exports = app;

const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
app.use(express.json());
module.exports = app;

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started At http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateJwtToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "NO_BODY_NOSE", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//register API
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}' ;
    `;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
                INSERT INTO user(name, username,password, gender)
                VALUES(
                    '${name}',
                    '${username}',
                    '${hashedPassword}',
                    '${gender}'
                );
            `;
      const dbResponse = await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}'
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    console.log(isPasswordMatched);
    if (isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "NO_BODY_NOSE");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//feeds API
app.get(
  "/user/tweets/feed/",
  authenticateJwtToken,
  async (request, response) => {
    const { username } = request;
    console.log(username);
    const getLatestTweetsQuery = `
        SELECT user.username, tweet.tweet, tweet.date_time
        FROM (follower INNER JOIN user ON follower.following_user_id = user.user_id) 
        INNER JOIN tweet ON tweet.user_id = user.user_id
        WHERE follower_user_id = (
            SELECT user_id
            FROM user
            WHERE username = '${username}'
        )
        ORDER BY tweet.date_time DESC
        LIMIT 4;
    `;
    const dbTweets = await db.all(getLatestTweetsQuery);
    const jsTweets = dbTweets.map((eachTweet) => {
      return {
        username: eachTweet.username,
        tweet: eachTweet.tweet,
        dateTime: eachTweet.date_time,
      };
    });
    response.send(jsTweets);
  }
);

//get user following API
app.get("/user/following/", authenticateJwtToken, async (request, response) => {
  const { username } = request;
  const getUserFollowsQuery = `
        SELECT user.name
        FROM follower INNER JOIN user ON user.user_id = follower.following_user_id
        WHERE follower_user_id = (
            SELECT user_id
            FROM user
            WHERE username = '${username}'
        );
    `;

  const dbUsers = await db.all(getUserFollowsQuery);
  response.send(dbUsers);
});

//get user followers API
app.get("/user/followers", authenticateJwtToken, async (request, response) => {
  const { username } = request;
  const getUserFollowersQuery = `
        SELECT user.name
        FROM follower INNER JOIN user ON user.user_id = follower.follower_user_id
        WHERE following_user_id = (
            SELECT user_id
            FROM user 
            WHERE username = '${username}'
        );
    `;
  const dbFollowers = await db.all(getUserFollowersQuery);
  response.send(dbFollowers);
});

//GET tweet API
app.get("/tweets/:tweetId", authenticateJwtToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;

  const getTweetQuery = `
        SELECT tweet.tweet,
        (
            SELECT COUNT(*)
            FROM like
            WHERE tweet_id = ${tweetId}
        ) AS likes,
        (
            SELECT COUNT(*)
            FROM reply
            WHERE tweet_id = ${tweetId}
        ) AS replies,
        date_time AS dateTime
        FROM follower INNER JOIN tweet 
        ON follower.following_user_id = tweet.user_id
        WHERE follower_user_id = (
            SELECT user_id
            FROM user
            WHERE username = '${username}' 
            AND tweet.tweet_id = ${tweetId} 
        )
        ;
    `;

  const dbTweet = await db.get(getTweetQuery);
  console.log(dbTweet);
  if (dbTweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(dbTweet);
  }
});

//get tweet liked users API
app.get(
  "/tweets/:tweetId/likes",
  authenticateJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    const getTweetQuery = `
        SELECT *,
        (
            SELECT COUNT(*)
            FROM like
            WHERE tweet_id = ${tweetId}
        ) AS likes,
        (
            SELECT COUNT(*)
            FROM reply
            WHERE tweet_id = ${tweetId}
        ) AS replies,
        date_time AS dateTime
        FROM follower INNER JOIN tweet 
        ON follower.following_user_id = tweet.user_id
        WHERE follower_user_id = (
            SELECT user_id
            FROM user
            WHERE username = '${username}' 
            AND tweet.tweet_id = ${tweetId} 
        )
        ;
    `;
    const dbTweet = await db.get(getTweetQuery);

    if (dbTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const likedUsersQuery = `
            SELECT user.username
            FROM like INNER JOIN user ON like.user_id = user.user_id
            WHERE tweet_id = ${tweetId};
        `;

      const dbLikedUsers = await db.all(likedUsersQuery);
      const likedUsers = dbLikedUsers.map((eachUser) => {
        return eachUser.username;
      });

      response.send({
        likes: likedUsers,
      });
    }
  }
);

//get tweet reply users API
app.get(
  "/tweets/:tweetId/replies",
  authenticateJwtToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    const getTweetQuery = `
        SELECT *,
        (
            SELECT COUNT(*)
            FROM like
            WHERE tweet_id = ${tweetId}
        ) AS likes,
        (
            SELECT COUNT(*)
            FROM reply
            WHERE tweet_id = ${tweetId}
        ) AS replies,
        date_time AS dateTime
        FROM follower INNER JOIN tweet 
        ON follower.following_user_id = tweet.user_id
        WHERE follower_user_id = (
            SELECT user_id
            FROM user
            WHERE username = '${username}' 
            AND tweet.tweet_id = ${tweetId} 
        )
        ;
    `;
    const dbTweet = await db.get(getTweetQuery);

    if (dbTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const repliedUsersQuery = `
            SELECT user.name, reply.reply
            FROM reply INNER JOIN user ON reply.user_id = user.user_id
            WHERE tweet_id = ${tweetId};
        `;

      const dbReplyUsers = await db.all(repliedUsersQuery);

      response.send({
        replies: dbReplyUsers,
      });
    }
  }
);

//get list of tweets of user API
app.get("/user/tweets/", authenticateJwtToken, async (request, response) => {
  const { username } = request;

  const getTweetsQuery = `
        SELECT tweet.tweet,
        COUNT(DISTINCT like_id) AS likes,
        COUNT(DISTINCT reply_id) AS replies,
        date_time AS dateTime
        FROM (tweet INNER JOIN user ON user.user_id = tweet.user_id) INNER JOIN like ON like.tweet_id = tweet.tweet_id INNER JOIN reply ON reply.tweet_id == tweet.tweet_id
        WHERE username = '${username}'
        GROUP BY tweet.tweet_id ;
    `;

  const userTweets = await db.all(getTweetsQuery);

  response.send(userTweets);
});

//create Tweet
app.post("/user/tweets/", authenticateJwtToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;

  const selectUserQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}';
    `;

  const user = await db.get(selectUserQuery);
  console.log(user);

  const createTweetQuery = `
        INSERT INTO tweet(tweet, user_id, date_time)
        VALUES(
            '${tweet}',
            ${user.user_id},
            '${new Date()}'
        );
    `;

  const dbResponse = await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

//delete tweet of user API
app.delete(
  "/tweets/:tweetId/",
  authenticateJwtToken,
  async (request, response) => {
    const { username } = request;

    const { tweetId } = request.params;

    const selectTweetQuery = `
        SELECT *
        FROM tweet INNER JOIN user ON user.user_id = tweet.user_id
        WHERE username = '${username}' AND tweet_id = ${tweetId};
    `;

    const tweet = await db.get(selectTweetQuery);
    if (tweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `
            DELETE FROM tweet
            WHERE tweet_id = ${tweetId};
        `;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);

const { GraphQLNormalizr } = require('graphql-normalizr');
const { normalize } = new GraphQLNormalizr({
  typenames: true,
});

const express = require("express");
const request = require("request");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
const Redis = require("ioredis");
const redis = new Redis();

const EXPIRATION = 1200; // 20 minutes
const YELP_API_URL = "https://api.yelp.com/v3/graphql";
const YELP_API_KEY = process.env.ACCESS_TOKEN;
var app = express();



app.use(
  cors({
    origin: "http://localhost:8888",
    optionsSuccessStatus: 200,
  })
);

app.use(bodyParser.json());

app.post(
  "/api",
  (req, resp, next) => {
    console.log(req.body.variables.term);
    resp.locals.start = Date.now();
    redis.get(JSON.stringify(req.body), (err, result) => {
      if (err) {
        console.log("~~ERROR~~ in redis.get: ", err);
      } else if (result) {
        console.log("++RESULT++ in redis.get");
        resp.locals.result = JSON.parse(result);
      } else {
        console.log("==NULL== in redis.get");
        resp.locals.query = JSON.stringify(req.body);
      }
      next();
    });
  },
  (req, resp, next) => {
    if (resp.locals.result) {
      console.log(Date.now() - resp.locals.start, " ms");
      return resp.send(resp.locals.result);
    } else {
      console.log("$$ POST REQUEST TO YELP API $$");
      request.post(
        {
          url: YELP_API_URL,
          method: "POST",
          headers: {
            Authorization: "Bearer " + YELP_API_KEY,
          },
          json: true,
          body: req.body,
        },
        (err, res, body) => {
          resp.locals.body = body;
          //resp.locals.body = JSON.stringify(body);
          resp.send(body);
          next();
        }
      );
    }
  },
  (req, resp, next) => {
    console.log("@@ INSERTING INTO REDIS @@");
    console.log(Date.now() - resp.locals.start, " ms");
    // console.log(resp.locals.body)
    let normalizedData = normalize(resp.locals.body);
    // console.log(normalizedData)
    Object.keys(normalizedData).forEach(key => {
      console.log(normalizedData[key])
      let objects = normalizedData[key]
      while(!Object.entries(objects[__typename])) {
        keys = Object.keys(objects);
        
      }
    })
    
    redis.set(resp.locals.query, JSON.stringify(normalizedData), "ex", EXPIRATION);
  }
);

app.listen(3020);

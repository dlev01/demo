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

const flatten = (object) => {
  return Object.assign( {}, ...function flattener( objectBit, path = '') {
    return [].concat(
      ...Object.keys( objectBit ).map(
        key => {
          return typeof objectBit[key] === 'object' && objectBit[key] !== null ?
          flattener( objectBit[key], `${path}.${key}`) : 
          ( { [`${ path }.${ key }` ]: objectBit[key]});
        }
      )
    )
  }(object));
}

const denormalize = (pathsObject) => {
  const payload = {};
  for (let key in pathsObject) {
    let workingObj = payload;
    let path = key.split('.');
    for (let i = 1; i < path.length; i += 1) {
      const e = path[i];
      // if we're at the end of the array, we can do the value assignment! yay!!
      if (i === path.length - 1) workingObj[e] = pathsObject[key];
      // only construct a sub-object if one doesn't exist with that name yet
      if (!workingObj[e]) {
        // if the item following this one in path array is a number, this nested object must be an array
        if (Number(path[i + 1]) || Number(path[i + 1]) === 0) {
          workingObj[e] = [];
        }
        else workingObj[e] = {};
      }
      // dive further into the object
      workingObj = workingObj[e];
    }
  }
  return payload;
}


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
        // resp.locals.result = JSON.parse(result);
        // console.log(JSON.stringify(result));
        // console.log(JSON.parse(result));
        // console.log(JSON.stringify(result));
        resp.locals.result = denormalize(JSON.parse(result));
        // console.log(resp.locals.result)
        console.log(Date.now() - resp.locals.start, " ms");
        return resp.send(resp.locals.result)
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
          resp.locals.body = JSON.stringify(body);
          resp.locals.bodyClone = body;
          // console.log(body.data.search.business);
          // resp.send(body);
          next();
        }
      );
    }
  },
  (req, resp, next) => {
    console.log("@@ INSERTING INTO REDIS @@");
    console.log(Date.now() - resp.locals.start, " ms");
    console.log("@@ Normalized Data @@");
    // const normalizedResponse = normalize(req.body, JSON.parse(resp.locals.body));\
    let normalized = JSON.stringify(flatten(resp.locals.bodyClone));
    let denormalized = denormalize(JSON.parse(normalized));
    // console.log(resp.locals.body);
    console.log(normalized);
    console.log(denormalized);
    resp.send(denormalized);
    // console.log(normalized);
    redis.set(resp.locals.query, normalized, "ex", EXPIRATION);
    // redis.set(1, normalized, "ex", EXPIRATION);
  }
);

app.listen(3020);

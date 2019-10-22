const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pool = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000
});

pool.on('error', () => console.log('Lost PG connection'));

pool
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(err => console.log(err));

// Redis Setup

const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// Express Route Handlers

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  console.log('Selecting');
  const values = await pool.query('SELECT * from values');
  res.send(values.rows);
});


app.get('/values/current', async (req, res) => {
  console.log('Inserting Redis');
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {

  console.log('Insert Values');

  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet');
  redisPublisher.publish('insert', index);
  //pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  pool.query('INSERT INTO values(number) VALUES($1)', [index], (err, result) => {
    if (err) {
      return console.error('Insert error', err.stack)
    }
    res.send({working: true });
  });
});

app.listen(5000, err => {
  console.log('Listenting');
});

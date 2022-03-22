const express = require('express');
const router = express.Router();

const pool = require('../modules/pool');

router.get('/', (req, res) => {
  // res.send('Hello?');
  const sqlText = 
    `SELECT "account"."name", SUM("register"."amount")
    FROM "account" 
    JOIN "register" ON "account"."id" = "register"."acct_id"
    GROUP BY "account"."name";`;

    pool.query(sqlText)
    .then(result => {
      console.log('Got the balances!', result.rows);
      res.send(result.rows);
    })
    .catch(error => {
      console.log('Query error:', sqlText, error)
      res.send(500);
    })
})

// post route for money transfer

router.post('/transfer', async (req, res) => {
  const toId = req.body.toId;
  const fromId = req.body.fromId;
  const amount = req.body.amount;

  // we need to use the same connection for all queries
  const connection = await pool.connect();

  // basic JS try/catch/finally
  try {
    await connection.query('BEGIN');
    const sqlText = `INSERT INTO register (acct_id, amount) VALUES ($1, $2)`
    // use - amount for the widthdrawal 
    await connection.query(sqlText, [fromId, -amount]);
    // the deposit
    await connection.query(sqlText, [toId, amount]);
    await connection.query('COMMIT');
    res.sendStatus(200);
  } catch (error) {
    await connection.query('ROLLBACK');
    console.log('Transaction error! Rolling back!', error);
    res.sendStatus(500);
  } finally {
    // always runs - both after a successful try and after a catch
    // put the client connection back in the pool
    // VERY IMPORTANT
    connection.release();
  }
})

router.post('/new', async (req, res) => {
  const name = req.body.name;
  const amount = req.body.amount;

  const connection = await pool.connect();

  try {
    await connection.query('BEGIN');
    const sqlAddAccount = `INSERT INTO "account" ("name") VALUES ($1) RETURNING id;`;
    // save the result so we can get the returned value
    const result = await connection.query(sqlAddAccount, [name]);
    // get the id from the result - there will only be one row
    const accountId = result.rows[0].id;
    const sqlInitialDeposit = `INSERT INTO "register" ("acct_id", "amount") VALUES ($1, $2);`;
    await connection.query(sqlInitialDeposit, [accountId, amount]);
    await connection.query('COMMIT');
    res.sendStatus(200);
  } catch (error) {
    await connection.query('ROLLBACK');
    console.log('Transaction error! Rolling back new account!', error)
    res.sendStatus(500);
  } finally {
    connection.release();
  }
})

module.exports = router;

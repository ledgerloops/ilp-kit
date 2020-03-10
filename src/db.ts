import bcrypt from "bcrypt";
import { Pool } from "pg";

let pool;
let client;

export async function runSql(query, params?): Promise<object[]> {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL || "postgresql://snap:snap@localhost/dev"
      // ssl: true, // - see https://github.com/ledgerloops/nlt-kit/issues/50
    });
    try {
      client = await pool.connect();
    } catch (e) {
      console.error("Error connecting to pool!", e.message); // eslint-disable-line no-console
      throw new Error("Could not connect to Postgres server");
    }
  }
  try {
    const result = await client.query(query, params);
    const results = result && result.rowCount ? result.rows : null;
    return results;
  } catch (err) {
    console.log("DATABASE ERROR!"); // eslint-disable-line no-console
    console.error(err.message); // eslint-disable-line no-console
    throw err;
  }
}

export function checkPass(
  username,
  password
): Promise<{ id: number; name: string } | boolean> {
  // console.log('checking  password', username, password);
  return runSql("SELECT * FROM users WHERE name=$1", [username]).then(
    results => {
      // console.log('sql query result', results);
      if (results == null) {
        // console.log('registering!', username);
        return bcrypt
          .hash(password, 10)
          .then(hash =>
            runSql("INSERT INTO users (name, secrethash) VALUES ($1, $2)", [
              username,
              hash
            ])
          );
      }
      const secretHash = (results[0] as { secrethash: string }).secrethash;
      // console.log('returning compare', results, password, secretHash);
      return bcrypt
        .compare(password, secretHash)
        .then(ret => ret && results[0]);
    }
  );
}

export function getObject(query, params?): Promise<object> {
  return runSql(query, params).then(results => {
    if (!results || !results.length) {
      // console.log('throwing row not found!', query, params);
      throw new Error("db row not found");
    }
    return results[0];
  });
}

export function getValue(query, params?, defaultVal?): Promise<number> {
  return getObject(query, params)
    .then((obj: { value: number }) => obj.value)
    .catch(e => {
      if (e.message === "db row not found" && defaultVal !== undefined) {
        return defaultVal;
      }
      throw e;
    });
}

export function close(): void {
  client.release();
  client = null;
  return pool.end().then(() => {
    pool = null;
  });
}

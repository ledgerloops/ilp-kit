/* eslint-disable camelcase */
const Static = require('node-static');
const atob = require('atob');
const randomBytes = require('randombytes');

const db = require('./db');
const { snapOut, snapIn } = require('./snap');
const { loop } = require('./loops');
const routing = require('./routing');
const balances = require('./balances');
const friendForm = require('./friendForm');

const file = new Static.Server('./public');

function mixInBalances(contacts) {
  if (!contacts || !contacts.length) {
    return [];
  }
  async function addBalances(contact) {
    return Object.assign(contact, {
      payable: await balances.getTheirPayable(contact.user_id, contact.id),
      receivable: await balances.getTheirReceivable(contact.user_id, contact.id),
      current: await balances.getTheirCurrent(contact.user_id, contact.id),
    });
  }
  return Promise.all(contacts.map(addBalances));
}

function mixInContactNames(transactions) {
  if (!transactions || !transactions.length) {
    return [];
  }
  async function addContactName(transaction) {
    // console.log('adding contact name', transaction);
    return Object.assign(transaction, {
      peerName: await db.getValue('SELECT name AS value FROM contacts WHERE id = $1 AND user_id = $2', [transaction.contact_id, transaction.user_id]),
    });
  }
  return Promise.all(transactions.map(addContactName));
}

function getData(user_id, resource) {
  const columns = {
    contacts: '"id", "user_id", "name", "url", "token", "min", "max"',
    transactions: '"user_id", "contact_id", "requested_at", "description", "direction", "amount"',
  };
  return db.runSql(`SELECT ${columns[resource]} FROM ${resource} WHERE user_id = $1;`, [user_id]).then((data) => {
    if (resource === 'contacts') {
      return mixInBalances(data);
    }
    if (resource === 'transactions') {
      return mixInContactNames(data);
    }
    return data;
  });
}

function makeHandler(hubbie) {
  hubbie.on('peer', async (eventObj) => {
    const users = await db.runSql('SELECT * FROM users WHERE name = $1', [eventObj.userName]);
    if (users === null || users.length === 0) {
      // console.log('verdict 1  false!');
      return false;
    }
    // console.log('still here 1');
    const user = users[0];
    const contacts = await db.runSql('SELECT * FROM contacts WHERE name = $1 AND user_id  = $2', [eventObj.peerName, user.id]);
    if (contacts === null || contacts.length === 0) {
      // console.log('verdict 2 true!');
      await db.runSql('INSERT INTO contacts (user_id, name, token, landmark) VALUES ($1, $2, $3, $4)', [user.id, eventObj.peerName, eventObj.peerSecret, `${user.name}:${eventObj.peerName}`]);
      return true;
    }
    // console.log('still here 2');
    const contact = contacts[0];
    // console.log('contact found!', eventObj, users, contacts);
    return (eventObj.peerSecret === contact.token);
  });

  hubbie.on('message', (peerName, msg, userName) => snapIn(peerName, msg, userName, hubbie));

  return function handler(req, res) {
    // console.log('hubbie passed req to app\'s own handler', req.method, req.url);
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    async function handleReq() {
      const [, resource, who] = req.url.split('/');
      switch (resource) {
        case 'session':
          try {
            // console.log(req.headers);
            const [username, password] = atob(req.headers.authorization.split(' ')[1]).split(':');
            db.checkPass(username, password).then((user_id) => {
              res.end(JSON.stringify({ username, ok: (user_id !== false) }));
            });
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
          break;
        case 'pay':
          try {
            // console.log(req.headers, body);
            const [username, password] = atob(req.headers.authorization.split(' ')[1]).split(':');
            const userId = await db.checkPass(username, password);
            if (userId === false) {
              throw new Error('auth fail');
            }
            // console.log('calling  snapOut',  userId, body);
            const transactionId = await snapOut(userId, JSON.parse(body), hubbie);
            const response = {
              ok: true,
              transactionId,
              contacts: await getData(userId, 'contacts'),
              transactions: await getData(userId, 'transactions'),
            };
            res.end(JSON.stringify(response));
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
          break;
        case 'topup':
          try {
            const [username, password] = atob(req.headers.authorization.split(' ')[1]).split(':');
            const userId = await db.checkPass(username, password);
            if (userId === false) {
              throw new Error('auth fail');
            }
            const result = await loop(userId, JSON.parse(body), hubbie);
            res.end(JSON.stringify({ ok: true, result }));
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
          break;
        case 'sendroutes':
          try {
            const [username, password] = atob(req.headers.authorization.split(' ')[1]).split(':');
            const userId = await db.checkPass(username, password);
            if (userId === false) {
              throw new Error('auth fail');
            }
            const result = await routing.sendRoutes(userId, JSON.parse(body), hubbie);
            res.end(JSON.stringify({ ok: true, result }));
          } catch (e) {
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
          break;
        case 'profile': {
          res.end(friendForm(who));
          break;
        }
        case 'contacts':
        case 'transactions':
          try {
            // console.log(resource, req.headers.authorization, req.method, body);
            const [username, password] = atob(req.headers.authorization.split(' ')[1]).split(':');
            // console.log('checkpass', username, password);
            const user_id = await db.checkPass(username, password);
            // console.log(user_id, req.method);
            if (user_id === false) {
              throw new Error('auth error');
            }
            if (req.method === 'PUT') {
              // console.log('yes', resource, body);
              const obj = JSON.parse(body);
              // console.log('saving', resource, obj);
              if (resource === 'contacts') {
                const myRemoteName = randomBytes(12).toString('hex');
                const token = randomBytes(12).toString('hex');
                const channelName = `${username}/${obj.name}`;
                const landmark = `${username}:${obj.name}`;

                let contactId;
                if (who === undefined) {
                  contactId = await db.getValue('INSERT INTO contacts ("user_id", "name", "url", "token", "min", "max", "landmark") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id AS value;', [user_id, obj.name, `${obj.url}/${myRemoteName}`, token, obj.min, 0, landmark]);
                } else {
                  contactId = parseInt(who, 10);
                  await db.runSql('UPDATE contacts SET "name" = $2, "url" =$3, "token" = $4, "min" = $5, "max" = $6, "landmark" = $7 WHERE user_id = $1 AND id = $8;', [user_id, obj.name, `${obj.url}/${myRemoteName}`, token, obj.min, 0, landmark, contactId]);
                }
                hubbie.addClient({
                  peerUrl: `${obj.url}/${myRemoteName}`,
                  /* fixme: hubbie should omit myName before mySecret in outgoing url */
                  myName: token,
                  peerName: channelName,
                });
                await hubbie.send(obj.name /* part of channelName */, JSON.stringify({
                  msgType: 'FRIEND-REQUEST',
                  url: `${hubbie.myBaseUrl}/${username}/${obj.name}`,
                  trust: -obj.min,
                  token,
                }), username /* other part of channelName */);
                await routing.sendRoutesToNewContact(user_id, contactId, hubbie);
              }
            }
            if (req.method === 'DELETE' && resource === 'contacts') {
              const contactId = parseInt(who, 10);
              await db.runSql('DELETE FROM contacts WHERE user_id = $1 AND id = $2;', [user_id, contactId]);
            }
            const data = await getData(user_id, resource);
            res.end(JSON.stringify({
              ok: true,
              [resource]: data,
            }));
          } catch (e) {
            console.error(e.message); // eslint-disable-line no-console
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
          break;
        default:
          file.serve(req, res);
      }
    }
    req.on('end', handleReq);
  };
}

module.exports = { makeHandler };

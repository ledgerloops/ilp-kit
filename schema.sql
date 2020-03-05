CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR,
  secretHash VARCHAR
);
CREATE TYPE tdirection AS ENUM('IN', 'OUT');
CREATE TYPE tstatus AS ENUM('pending', 'accepted', 'rejected');
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  user_id INT,
  contact_id INT,
  direction tdirection,
  seen_at timestamp without time zone,
  message_json VARCHAR
);
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  user_id INT,
  name VARCHAR,
  url VARCHAR,
  token VARCHAR,
  CONSTRAINT unq_userid_name UNIQUE(user_id,name)
);
CREATE TABLE preimages (
  user_id INT,
  hash VARCHAR,
  preimage VARCHAR
);
CREATE TABLE forwards (
  user_id INT,
  incoming_peer_id INT,
  incoming_msg_id INT,
  outgoing_peer_id INT,
  hash VARCHAR
);
CREATE TABLE routes (
  user_id INT,
  contact_id INT,
  landmark VARCHAR,
  approach VARCHAR,
  max_to INT,
  max_from INT
);

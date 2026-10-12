-- L0 spike only. L1 replaces this file with the real schema before any user data exists.
CREATE TABLE spike (
  id INTEGER PRIMARY KEY,
  amount INTEGER NOT NULL,
  note TEXT
);

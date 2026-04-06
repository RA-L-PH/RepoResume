const Database = require('better-sqlite3');
const CryptoJS = require('crypto-js');
const path = require('path');
require('dotenv').config();

const db = new Database(path.join(__dirname, 'reporesume.db'));

// Encryption Key (should be in .env)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'repo-resume-default-key-321';

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    email_encrypted TEXT,
    accessToken TEXT,
    profile_encrypted TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS repo_cache (
    fullName TEXT PRIMARY KEY,
    data TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    userId TEXT,
    phase TEXT,
    status TEXT,
    results TEXT,
    consolidated TEXT,
    markdown TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const encrypt = (text) => {
  if (!text) return null;
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
};

const decrypt = (ciphertext) => {
  if (!ciphertext) return null;
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

module.exports = {
  // User operations
  saveUser: (user) => {
    const { id, username, email, accessToken, profileData } = user;
    const strId = String(id);
    console.log(`\x1b[32m[DB SAVE]\x1b[0m User: ${strId} (type ${typeof id}) | ProfileSize: ${JSON.stringify(profileData || {}).length} chars`);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO users (id, username, email_encrypted, accessToken, profile_encrypted)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(strId, username, encrypt(email), accessToken, encrypt(JSON.stringify(profileData || {})));
  },
  
  getUser: (id) => {
    const strId = String(id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(strId);
    if (!user) {
      console.log(`\x1b[33m[DB GET]\x1b[0m User Not Found: ${strId} (type ${typeof id})`);
      return null;
    }
    const profile = JSON.parse(decrypt(user.profile_encrypted) || '{}');
    console.log(`\x1b[36m[DB GET]\x1b[0m User: ${strId} | ProfileSize: ${JSON.stringify(profile).length} chars`);
    return {
      ...user,
      email: decrypt(user.email_encrypted),
      profileData: profile
    };
  },

  // Repo Cache operations
  saveRepoCache: (fullName, data) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO repo_cache (fullName, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    stmt.run(fullName, JSON.stringify(data));
  },
  
  getRepoCache: () => {
    const rows = db.prepare('SELECT * FROM repo_cache').all();
    const cache = {};
    rows.forEach(row => {
      cache[row.fullName] = JSON.parse(row.data);
    });
    return cache;
  },

  // Job operations (for persistent state)
  saveJob: (job) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO jobs (id, userId, phase, status, results, consolidated, markdown)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      job.id, 
      job.userId, 
      job.phase, 
      job.status, 
      JSON.stringify(job.results || []), 
      JSON.stringify(job.consolidated || {}), 
      job.markdown || ''
    );
  },

  getJob: (id) => {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) return null;
    return {
      ...job,
      results: JSON.parse(job.results),
      consolidated: JSON.parse(job.consolidated)
    };
  },

  getIncompleteJobs: () => {
    const rows = db.prepare("SELECT * FROM jobs WHERE status NOT IN ('COMPLETED', 'FAILED', 'STOPPED')").all();
    return rows.map(row => ({
      ...row,
      results: JSON.parse(row.results),
      consolidated: JSON.parse(row.consolidated)
    }));
  },

  dbInstance: db
};

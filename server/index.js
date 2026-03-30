const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const OpenAI = require('openai');
const crypto = require('crypto');
const fs = require('fs-extra');
require('dotenv').config();

const requiredEnv = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'NVIDIA_API_KEY', 'SESSION_SECRET'];
const missingEnv = requiredEnv.filter(k => !process.env[k]);

if (missingEnv.length > 0) {
  console.warn(`\x1b[33mWarning: Missing environment variables: ${missingEnv.join(', ')}\x1b[0m`);
  if(!process.env.GITHUB_CLIENT_ID) process.env.GITHUB_CLIENT_ID = 'placeholder';
  if(!process.env.GITHUB_CLIENT_SECRET) process.env.GITHUB_CLIENT_SECRET = 'placeholder';
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Verbose Logging (After body-parser)
app.use((req, res, next) => {
  console.log(`\x1b[36m[REQUEST]\x1b[0m ${req.method} ${req.url} - ${new Date().toISOString()}`);
  if (req.body && Object.keys(req.body).length) {
    console.debug(`\x1b[90m[BODY]\x1b[0m`, JSON.stringify(req.body).slice(0, 200) + '...');
  }
  next();
});
app.use(session({
  store: new FileStore({
    path: './sessions',
    retries: 0
  }),
  secret: process.env.SESSION_SECRET || 'repo-resume-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
    maxAge: 30 * 24 * 60 * 60 * 1000 
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || "http://localhost:3001/auth/github/callback",
    scope: ['repo', 'user']
  },
  (accessToken, refreshToken, profile, done) => {
    profile.accessToken = accessToken;
    return done(null, profile);
  }
));

const jobs = new Map();
const activeStreams = new Map();
const CACHE_FILE = './repo-cache.json';
const PROFILES_FILE = './profiles.json';

// Simple Cache/Profile Management
async function loadCache() {
  try {
    if (await fs.pathExists(CACHE_FILE)) return await fs.readJson(CACHE_FILE);
  } catch (err) { console.error(`Failed to load ${CACHE_FILE}, defaulting to empty.`, err) }
  return {};
}
async function saveCache(cache) {
  await fs.writeJson(CACHE_FILE, cache, { spaces: 2 });
}
async function loadProfiles() {
  try {
    if (await fs.pathExists(PROFILES_FILE)) return await fs.readJson(PROFILES_FILE);
  } catch (err) { console.error(`Failed to load ${PROFILES_FILE}, defaulting to empty.`, err) }
  return {};
}
async function writeProfile(userId, data) {
  const profiles = await loadProfiles();
  profiles[userId] = data;
  await fs.writeJson(PROFILES_FILE, profiles, { spaces: 2 });
}

const getEmailHash = (email) => crypto.createHash('md5').update(email.toLowerCase()).digest('hex');

const broadcast = (userId, data) => {
  console.log(`\x1b[35m[SSE BROADCAST]\x1b[0m User: ${userId} Event: ${data.type}`);
  const stream = activeStreams.get(userId);
  if (stream) {
    stream.write(`data: ${JSON.stringify(data)}\n\n`);
  }
};

app.get('/auth/github', passport.authenticate('github', { scope: ['repo', 'user'] }));
app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173')
);

app.get('/auth/me', async (req, res) => {
  if (req.isAuthenticated()) {
    const profiles = await loadProfiles();
    const email = req.user.emails?.[0]?.value || req.user.id;
    const hash = getEmailHash(email);
    res.json({ ...req.user, hash, profile: profiles[req.user.id] || {} });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

app.get('/api/profile', async (req, res) => {
  if (!req.user) return res.status(401).send();
  const profiles = await loadProfiles();
  res.json(profiles[req.user.id] || {});
});

app.post('/api/profile', async (req, res) => {
  if (!req.user) return res.status(401).send();
  await writeProfile(req.user.id, req.body);
  res.json({ success: true });
});

app.get('/api/stream', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  activeStreams.set(userId, res);
  console.log(`\x1b[32m[SSE OPEN]\x1b[0m User: ${userId}`);

  for (let [key, job] of jobs.entries()) {
    if (key.startsWith(`${userId}:`)) {
       broadcast(userId, { type: 'RECOVERY', state: job });
    }
  }

  req.on('close', () => {
    console.log(`\x1b[31m[SSE CLOSE]\x1b[0m User: ${userId}`);
    activeStreams.delete(userId);
  });
});

const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

const { runIntelligenceEngine } = require('./engines/intelligence-engine');
const { runResumeEngine, generateLatexSnippet } = require('./engines/resume-engine');

app.post('/api/generate-latex', async (req, res) => {
  try {
    const { markdown } = req.body;
    if (!markdown) return res.status(400).json({ error: 'No markdown provided' });
    const latex = await generateLatexSnippet(markdown, nvidia);
    res.json({ latex });
  } catch (error) {
    console.error('LaTeX Error:', error);
    res.status(500).json({ error: 'LaTeX generation failed' });
  }
});

async function runIntelligenceTask(userId, accessToken, repos) {
  const cache = await loadCache();
  const totalChunks = Math.ceil(repos.length / 8);
  const job = { 
    userId, mode: 'intelligence', status: 'RUNNING', chunks: [], totalChunks, 
    currentChunk: 0, results: [], phase: 'idle', consolidated: null, markdown: null 
  };
  jobs.set(`${userId}:intelligence`, job);
  broadcast(userId, { type: 'START', job });

  const ctx = {
    userId, accessToken, repos, mode: 'intelligence', broadcast, nvidia, cache, saveCache: saveCache, job,
    loadProfiles, axios, getEmailHash
  };
  return runIntelligenceEngine(ctx);
}

async function runResumeTask(userId, accessToken, repos, jobProfile, staticInfo, autoSelect = false) {
  const cache = await loadCache();
  const eduBlock = (staticInfo?.education || '').trim();
  const experienceBlock = (staticInfo?.jobHistory || '').trim();
  const certBlock = (staticInfo?.certifications || '').trim();

  let activeRepos = repos;
  if (autoSelect && (!repos || repos.length === 0)) {
    try {
      console.log(`\x1b[34m[AUTO-SELECT]\x1b[0m Fetching all repos for user ${userId} to perform global selection...`);
      const { data } = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: { Authorization: `token ${accessToken}` }
      });
      activeRepos = data;
    } catch (e) {
      console.error("Failed to fetch repos for global auto-select", e);
    }
  }

  const totalChunks = Math.ceil(activeRepos.length / 8);
  const job = { 
    userId, mode: 'resume', status: 'RUNNING', chunks: [], totalChunks, 
    currentChunk: 0, results: [], phase: 'idle', consolidated: null, markdown: null 
  };
  jobs.set(`${userId}:resume`, job);
  broadcast(userId, { type: 'START', job });

  const ctx = {
    userId, accessToken, repos: activeRepos, mode: 'resume', broadcast, nvidia, cache, saveCache: saveCache, job,
    jobProfile, staticInfo, autoSelect,
    educationBlock: eduBlock,
    experienceBlock,
    certBlock,
    loadProfiles, axios, getEmailHash
  };
  return runResumeEngine(ctx);
}

app.post('/api/analyze-intelligence', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  const { repos } = req.body;
  if (jobs.get(`${userId}:intelligence`)?.status === 'RUNNING') return res.status(429).end();
  
  runIntelligenceTask(userId, req.user.accessToken, repos);
  res.json({ message: 'Intelligence analysis started' });
});

app.post('/api/generate-resume', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  const { repos, jobProfile, staticInfo } = req.body;
  if (jobs.get(`${userId}:resume`)?.status === 'RUNNING') return res.status(429).end();

  const autoSelect = !repos || repos.length === 0;
  runResumeTask(userId, req.user.accessToken, repos, jobProfile, staticInfo, autoSelect);
  res.json({ message: 'Resume generation started' });
});

app.get('/api/repos', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  
  // Cache busting: If ?refresh=true, purge the analysis cache
  if (req.query.refresh === 'true') {
    try {
      if (await fs.pathExists(CACHE_FILE)) {
        await fs.remove(CACHE_FILE);
        console.log(`\x1b[33m[CACHE PURGE]\x1b[0m Analysis cache cleared via UI refresh.`);
      }
    } catch (err) { console.error("Cache purge failed", err) }
  }

  try {
    const { data } = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: { Authorization: `token ${req.user.accessToken}` }
    });
    res.json(data);
  } catch (err) { res.status(500).end(); }
});

app.listen(PORT, () => console.log(`\x1b[32m[SERVER]\x1b[0m Running on port ${PORT}`));

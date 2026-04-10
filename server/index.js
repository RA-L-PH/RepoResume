const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const axios = require('axios');
const { z } = require('zod');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const OpenAI = require('openai');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const db = require('./db');
const { callAI, nvidia } = require('./ai-helper');
const { generatePDFFromMarkdown } = require('./pdf-exporter');
const { runIntelligenceEngine } = require('./engines/intelligence-engine');
const { runResumeEngine, generateLatexSnippet } = require('./engines/resume-engine');
const { runCoverLetterEngine } = require('./engines/cover-letter-engine');
const { runLinkedInPostEngine } = require('./engines/linkedin-post-engine');
const { scrapePage } = require('./scraper');
const Database = require('better-sqlite3');
const SqliteStore = require('better-sqlite3-session-store')(session);
require('dotenv').config();

const sqliteDb = new Database(path.join(__dirname, 'sessions.db'));
const app = express();
const PORT = process.env.PORT || 3001;

// Global State
const jobs = new Map();
const activeStreams = new Map();
let analysisCache = {};

// Initial Cache Load
(async () => {
  analysisCache = await db.getRepoCache();
  console.log(`\x1b[34m[CACHE LOAD]\x1b[0m ${Object.keys(analysisCache).length} entries.`);
})();

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(session({
  store: new SqliteStore({ client: sqliteDb }),
  secret: process.env.SESSION_SECRET || 'repo-resume-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
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
    const email = profile.emails?.[0]?.value || profile.id;
    const existingUser = db.getUser(profile.id);
    db.saveUser({
      id: profile.id, username: profile.username, email, accessToken,
      profileData: existingUser?.profileData || {} 
    });
    profile.accessToken = accessToken;
    return done(null, profile);
  }
));

// Utilities
const getEmailHash = (email) => crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
const broadcast = (userId, data) => {
  const stream = activeStreams.get(userId);
  if (stream) stream.write(`data: ${JSON.stringify(data)}\n\n`);
  const jobKey = data.mode ? `${userId}:${data.mode}` : (data.job?.mode ? `${userId}:${data.job.mode}` : null);
  if (jobKey) {
    const job = jobs.get(jobKey);
    if (job) db.saveJob({ ...job, id: jobKey });
  }
};

// Task Runners (Defining BEFORE routes to avoid hoisting confusion)
async function runIntelligenceTask(userId, accessToken, repos, intelModel, staticInfo, apiKey) {
  const job = { id: `${userId}:intelligence`, userId, status: 'RUNNING', phase: 'INITIALIZING', results: [], consolidated: null, totalChunks: 0, currentChunk: 0 };
  jobs.set(job.id, job);
  broadcast(userId, { type: 'START', job });
  runIntelligenceEngine({ userId, accessToken, repos, mode: 'intelligence', broadcast, nvidia, cache: analysisCache, 
    saveCache: async (c) => { 
      analysisCache = c; 
      for (const [name, data] of Object.entries(c)) db.saveRepoCache(name, data);
    }, job, staticInfo, callAI, intelModel, apiKey 
  });
}

async function runResumeTask(userId, accessToken, repos, jobProfile, staticInfo, autoSelect, resumeModel, humanize, apiKey) {
  const job = { id: `${userId}:resume`, userId, status: 'RUNNING', phase: 'INITIALIZING', results: [], consolidated: null, markdown: '', totalChunks: 0, currentChunk: 0, humanize };
  jobs.set(job.id, job);
  broadcast(userId, { type: 'START', job });
  runResumeEngine({ userId, accessToken, repos, mode: 'resume', broadcast, nvidia, cache: analysisCache, 
    saveCache: async (c) => { 
      analysisCache = c; 
      for (const [name, data] of Object.entries(c)) db.saveRepoCache(name, data);
    }, job, jobProfile, staticInfo, loadProfiles: async () => [staticInfo], callAI, resumeModel, humanize, apiKey 
  });
}

async function runCoverLetterTask(userId, accessToken, repos, jobProfile, staticInfo, resumeModel, humanize, apiKey) {
  const job = { id: `${userId}:cover-letter`, userId, status: 'RUNNING', phase: 'INITIALIZING', results: [], markdown: '', totalChunks: 0, currentChunk: 0 };
  jobs.set(job.id, job);
  broadcast(userId, { type: 'START', job });
  runCoverLetterEngine({ userId, accessToken, repos, mode: 'cover-letter', broadcast, nvidia, cache: analysisCache, 
    saveCache: async (c) => { 
      analysisCache = c; 
      for (const [name, data] of Object.entries(c)) db.saveRepoCache(name, data);
    }, job, jobProfile, staticInfo, callAI, resumeModel, humanize, apiKey 
  });
}

async function runLinkedInPostTask(userId, accessToken, repos, jobProfile, staticInfo, resumeModel, humanize, apiKey) {
  const job = { id: `${userId}:linkedin-post`, userId, status: 'RUNNING', phase: 'INITIALIZING', results: [], markdown: '', totalChunks: 0, currentChunk: 0 };
  jobs.set(job.id, job);
  broadcast(userId, { type: 'START', job });
  runLinkedInPostEngine({ userId, accessToken, repos, mode: 'linkedin-post', broadcast, nvidia, cache: analysisCache, 
    saveCache: async (c) => { 
      analysisCache = c; 
      for (const [name, data] of Object.entries(c)) db.saveRepoCache(name, data);
    }, job, jobProfile, staticInfo, callAI, resumeModel, humanize, apiKey 
  });
}

// Routes
app.get('/auth/github', passport.authenticate('github', { scope: ['repo', 'user'] }));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173'));
app.get('/auth/me', (req, res) => {
  if (req.isAuthenticated()) {
    const user = db.getUser(req.user.id);
    res.json({ ...req.user, hash: getEmailHash(req.user.emails?.[0]?.value || req.user.id), profile: user?.profileData || {} });
  } else res.status(401).send();
});

app.get('/api/stream', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  activeStreams.set(userId, res);
  const resumeJob = jobs.get(`${userId}:resume`);
  if (resumeJob && resumeJob.status === 'RUNNING') broadcast(userId, { type: 'RECOVERY', state: resumeJob });
  req.on('close', () => activeStreams.delete(userId));
});

app.post('/api/analyze-intelligence', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  const user = db.getUser(req.user.id);
  const { repos, intelModel, staticInfo } = req.body;
  if (jobs.get(`${userId}:intelligence`)?.status === 'RUNNING') return res.status(429).end();
  runIntelligenceTask(userId, req.user.accessToken, repos, intelModel, staticInfo || {}, user?.profileData?.nvidiaApiKey);
  res.json({ message: 'Started' });
});

app.get('/api/test', (req, res) => res.json({ status: 'up', time: new Date().toISOString() }));

app.post('/api/research-links', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const { researchContext, resumeModel } = req.body;
  if (!researchContext) return res.status(400).json({ error: "Missing news/context" });

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = researchContext.match(urlRegex) || [];
  if (urls.length === 0) return res.json({ summary: researchContext }); // No URLs, just return original

  console.log(`[INTELLIGENCE RESEARCH] Scraping ${urls.length} links...`);
  
  let totalContent = "";
  for (const url of urls.slice(0, 3)) { // Limit to top 3 for speed
     const text = await scrapePage(url);
     if (text) totalContent += `[SOURCE: ${url}]\n${text}\n\n`;
  }

  if (!totalContent) return res.json({ summary: researchContext });

  const prompt = `CRITICAL: Output ONLY the professional narrative summary. No intros, No apologies, No meta-commentary, No conversational filler. 
  
  Do NOT say "Unfortunately I could not find..." or "This is based on...".
  If the content looks like an error message (Wikipedia non-existent, 404, etc.), ignore it and use your INTERNAL knowledge of this company or sector to create a premium competitive brief.
  
  TASK: Synthesize these research notes into a high-impact narrative summary for a Cover Letter.
  Identify: 
  - Recent momentum (funding, growth, new focus).
  - Mirroring vocabulary (specific industry terms they use).
  - Cultural tone (e.g. results-driven, visionary, agile).
  
  CONTENT TO PROCESS:
  ${totalContent.substring(0, 10000)}
  
  OUTPUT: Strictly a concise professional intelligence summary paragraph.`;

  const user = db.getUser(req.user.id);
  const summaryComp = await callAI([{ role: "system", content: "Corporate Intelligence Archivist" }, { role: "user", content: prompt }], {
    model: resumeModel || "meta/llama-3.3-70b-instruct",
    max_tokens: 800,
    apiKey: user?.profileData?.nvidiaApiKey
  });

  const summary = summaryComp.choices[0].message.content;
  res.json({ summary });
});

app.post('/api/generate-cover-letter', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  const user = db.getUser(req.user.id);
  const { repos, jobProfile, staticInfo, resumeModel, humanize } = req.body;
  if (jobs.get(`${userId}:cover-letter`)?.status === 'RUNNING') return res.status(429).end();
  runCoverLetterTask(userId, req.user.accessToken, repos, jobProfile, staticInfo || {}, resumeModel, humanize, user?.profileData?.nvidiaApiKey);
  res.json({ message: 'Started' });
});

app.post('/api/generate-linkedin-post', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  const user = db.getUser(req.user.id);
  const { repos, jobProfile, staticInfo, resumeModel, humanize } = req.body;
  if (jobs.get(`${userId}:linkedin-post`)?.status === 'RUNNING') return res.status(429).end();
  runLinkedInPostTask(userId, req.user.accessToken, repos, jobProfile, staticInfo || {}, resumeModel, humanize, user?.profileData?.nvidiaApiKey);
  res.json({ message: 'Started' });
});

app.post('/api/generate-resume', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  const { repos, jobProfile, staticInfo, resumeModel, humanize } = req.body;
  
  if (jobs.get(`${userId}:resume`)?.status === 'RUNNING') return res.status(429).end();

  const autoSelect = !repos || repos.length === 0;
  let activeRepos = repos || [];

  if (autoSelect) {
    try {
      console.log(`\x1b[34m[AUTO-SELECT]\x1b[0m Fetching repos for ${userId}...`);
      const { data } = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: { 
          Authorization: `token ${req.user.accessToken}`,
          'User-Agent': 'RepoResume-Server/1.0'
        },
        timeout: 10000 
      });
      activeRepos = data;
    } catch (e) { console.error("Auto-select fetch failed", e.message); }
  }

  const user = db.getUser(req.user.id);
  runResumeTask(userId, req.user.accessToken, activeRepos, jobProfile, staticInfo || {}, autoSelect, resumeModel, humanize, user?.profileData?.nvidiaApiKey);
  res.json({ message: 'Started' });
});

app.post('/api/stop-resume', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  const rj = jobs.get(`${userId}:resume`);
  if (rj) { rj.status = 'STOPPED'; db.saveJob(rj); jobs.delete(`${userId}:resume`); broadcast(userId, { type: 'ERROR', error: 'Stopped' }); }
  res.json({ success: true });
});

app.post('/api/settings', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send();
  const user = db.getUser(req.user.id);
  if (user) {
    user.profileData = { 
      ...(user.profileData || {}), 
      nvidiaApiKey: req.body.nvidiaApiKey,
      selectedModels: req.body.selectedModels
    };
    db.saveUser(user);
  }
  res.json({ success: true });
});

app.post('/api/profile', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).send();
  const user = db.getUser(req.user.id);
  if (user) { user.profileData = req.body; db.saveUser(user); }
  res.json({ success: true });
});

app.post('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ success: true });
  });
});

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
  });
});

app.post('/api/export-pdf', async (req, res) => {
  const pdf = await generatePDFFromMarkdown(req.body.markdown);
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdf);
});

app.post('/api/generate-latex', async (req, res) => {
  const latex = await generateLatexSnippet(req.body.markdown, nvidia, callAI);
  res.json({ latex });
});

app.get('/api/repos', async (req, res) => {
  try {
    const { data } = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=100', { 
      headers: { 
        Authorization: `token ${req.user.accessToken}`,
        'User-Agent': 'RepoResume-Server/1.0'
      },
      timeout: 10000
    });
    res.json(data);
  } catch (e) {
    console.error("Fetch repos error:", e.message);
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`[SERVER] Running on ${PORT}`));

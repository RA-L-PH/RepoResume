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
  if (await fs.pathExists(CACHE_FILE)) return fs.readJson(CACHE_FILE);
  return {};
}
async function saveCache(cache) {
  await fs.writeJson(CACHE_FILE, cache, { spaces: 2 });
}
async function loadProfiles() {
  if (await fs.pathExists(PROFILES_FILE)) return fs.readJson(PROFILES_FILE);
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

// AI Auto-Selection Logic
async function autoSelectRepos(allRepos, jobProfile) {
  console.log(`\x1b[34m[AI AUTO-SELECT]\x1b[0m Analyzing ${allRepos.length} repos for relevance...`);
  const repoMeta = allRepos.map(r => ({ id: r.id, name: r.name, description: r.description }));
  
  const completion = await nvidia.chat.completions.create({
    model: "meta/llama-3.3-70b-instruct",
    messages: [{
      role: "system",
      content: `You are a technical recruiter. Given a job profile and a list of GitHub repositories, select the TOP 12 MOST RELEVANT repositories that show skills required for the job.
      Respond ONLY with a JSON array of repository IDs.
      Job: ${jobProfile.title}
      JD: ${jobProfile.description}`
    }, {
       role: "user",
       content: JSON.stringify(repoMeta)
    }],
    response_format: { type: "json_object" }
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  const selectedIds = Array.isArray(parsed) ? parsed : (parsed.selectedIds || parsed.ids || Object.values(parsed)[0]);
  console.log(`\x1b[34m[AI AUTO-SELECT]\x1b[0m Selected IDs:`, selectedIds);
  return allRepos.filter(r => selectedIds.includes(r.id));
}

async function runResumeBuilder(userId, accessToken, repos, jobProfile, staticInfo, autoSelect = false, mode = 'resume') {
  // Load structured profile data from disk for accurate section building
  const profiles = await loadProfiles();
  // Find this user's profile by iterating values (userId here is a hash, profiles keyed by GitHub ID)
  const savedProfile = Object.values(profiles).find(p => p.email === staticInfo.email) || {};

  // Prefer structured arrays from saved profile; fall back to what came in via staticInfo
  const eduList   = savedProfile.eduList   || [];
  const expList   = savedProfile.expList   || [];
  const certList  = savedProfile.certList  || [];

  // Build pre-formatted markdown-ready strings for each section
  // - Education: Bold degree, then institution on next line, joined by double-newlines
  const educationBlock = eduList.length
    ? eduList.map(e => `**${e.degree}**\n${e.institution}${e.period ? ' | ' + e.period : ''}`).join('\n\n')
    : (staticInfo.education || '');

  // - Experience: Bold role | company | period, then indented description bullets
  const experienceBlock = expList.length
    ? expList.map(e => {
        const header = `**${e.role}** | ${e.company} | ${e.period}`;
        // Ensure description bullets are properly indented if they aren't already
        const formattedDesc = (e.description || '')
          .split('\n')
          .map(line => line.trim().startsWith('•') || line.trim().startsWith('-') ? `  ${line.trim()}` : `  • ${line.trim()}`)
          .join('\n');
        return `${header}\n${formattedDesc}`;
      }).join('\n\n')
    : (staticInfo.jobHistory || '');

  const certBlock = certList.filter(c => c.name).length
    ? certList.filter(c => c.name).map(c => `- **${c.name}** | ${c.issuer} | ${c.date}`).join('\n')
    : (staticInfo.certifications || '');

  const job = { 
    userId, mode, status: 'RUNNING', chunks: [], totalChunks: 0, 
    currentChunk: 0, results: [], phase: 'INITIALIZING', consolidated: null, markdown: null 
  };
  jobs.set(`${userId}:${mode}`, job);
  broadcast(userId, { type: 'START', job });

  try {
    const cache = await loadCache();
    let finalRepos = repos;
    
    // Phase: Deep Context Extraction
    job.phase = 'UNDERSTANDING_REPOS';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'UNDERSTANDING_REPOS' });

    if (autoSelect) {
      job.phase = 'SELECTING_PROJECTS';
      broadcast(userId, { type: 'PHASE_CHANGE', phase: 'SELECTING_PROJECTS' });
      finalRepos = await autoSelectRepos(repos, jobProfile);
    }

    job.totalChunks = Math.ceil(finalRepos.length / 8);
    job.phase = 'SUMMARIZING_CONTENT';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'SUMMARIZING_CONTENT' });

    const authHeaders = { Authorization: `token ${accessToken}` };
    const analysisPromises = [];

    for (let i = 0; i < finalRepos.length; i += 8) {
      const chunkIndex = (i / 8) + 1;
      const chunk = finalRepos.slice(i, i + 8);
      
      const chunkAnalysis = (async () => {
        let combinedDocs = "";
        const chunkResults = [];

          const chunkDocs = await Promise.all(chunk.map(async (repo) => {
            if (cache[repo.full_name]) return { cached: true, repoName: repo.name, data: cache[repo.full_name] };
            
            const [owner, name] = repo.full_name.split('/');
            console.log(`\x1b[90m[GITHUB FETCH]\x1b[0m ${repo.full_name}`);
            try {
              const { data: repoInfo } = await axios.get(`https://api.github.com/repos/${owner}/${name}`, { headers: authHeaders });
              const { data: treeData } = await axios.get(`https://api.github.com/repos/${owner}/${name}/git/trees/${repoInfo.default_branch}?recursive=1`, { headers: authHeaders });
              const docFiles = treeData.tree.filter(f => f.type === 'blob' && (f.path.endsWith('.md') || f.path.endsWith('.txt'))).slice(0, 3);
              let combined = `\n\n### REPO: ${repo.name}\n`;
              for (const file of docFiles) {
                const { data: content } = await axios.get(`https://api.github.com/repos/${owner}/${name}/contents/${file.path}`, { 
                  headers: { ...authHeaders, Accept: 'application/vnd.github.raw' } 
                });
                combined += `\n- ${file.path}:\n${content.slice(0, 2000)}\n`;
              }
              return { cached: false, combined };
            } catch (err) { 
              console.error(`Failed to fetch docs for ${repo.full_name}`);
              return null;
            }
          }));

          const cachedItems = chunkDocs.filter(d => d?.cached).map(d => d.data);
          const newDocString = chunkDocs.filter(d => d && !d.cached).map(d => d.combined).join("\n");

          if (cachedItems.length > 0) {
            console.log(`\x1b[36m[CACHE HIT]\x1b[0m Chunk ${chunkIndex}: ${cachedItems.length} repos loaded from cache.`);
          }

          if (newDocString) {
            console.log(`\x1b[32m[AI SUMMARIZING]\x1b[0m Sending chunk ${chunkIndex} (new repos) to Dracarys [Parallel]...`);
            const sysPrompt = mode === 'intelligence' 
              ? "For each project, generate a DENSE structured analysis. Respond ONLY with a JSON array named 'projects' containing objects: { projectName, oneLineSummary, techStack: string[], coreFeatures: [{title, implementation}] }. Focus on technical depth and 'How' it works. Extract exactly 3 core features for each."
              : "For each project, generate a high-impact technical summary for a professional resume. Respond ONLY with a JSON array named 'projects' containing [{projectName, oneLineSummary, technicalSummary, techStack, bullets}]. Use 'oneLineSummary' to capture the core value proposition.";

            const completion = await nvidia.chat.completions.create({
              model: "abacusai/dracarys-llama-3.1-70b-instruct",
              messages: [{ role: "system", content: sysPrompt }, { role: "user", content: newDocString }],
              response_format: { type: "json_object" }
            });
            
            const parsed = JSON.parse(completion.choices[0].message.content);
            const summaries = (parsed.projects || parsed.summaries || parsed || []);
            const normalized = Array.isArray(summaries) ? summaries : [summaries];
            
            // Cache each summary
            normalized.forEach(s => {
              const originalRepo = chunk.find(r => r.name === (s.projectName || s.name));
              if (originalRepo) cache[originalRepo.full_name] = s;
            });
            chunkResults.push(...normalized);
          }
          chunkResults.push(...cachedItems);

        job.currentChunk++;
        job.results.push(...chunkResults);
        broadcast(userId, { type: 'CHUNK_COMPLETE', newResults: chunkResults, totalResults: job.results });
        return chunkResults;
      })();
      
      analysisPromises.push(chunkAnalysis);
    }

    await Promise.all(analysisPromises);
    await saveCache(cache);

    if (job.results.length === 0) {
      throw new Error("No repositories were successfully analyzed. Please check repo content.");
    }

    job.phase = mode === 'intelligence' ? 'CREATING_DESCRIPTIONS' : 'REFINING_EXPERIENCE';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: job.phase });

    if (mode === 'intelligence') {
       // Direct mapping to ensure NO project data is lost/truncated for intelligence view
       const refinedProjects = job.results.map(r => ({
          name: r.projectName || r.name,
          oneLineSummary: r.oneLineSummary,
          techStack: r.techStack,
          formattedFeatures: (r.coreFeatures || r.features || []).map(f => typeof f === 'string' ? f : `${f.title}: ${f.implementation}`)
       }));
       
       // Generate only the summary via LLM
       const sumComp = await nvidia.chat.completions.create({
          model: "meta/llama-3.3-70b-instruct",
          messages: [
            { role: "system", content: "Create a 2-sentence Professional summary for a portfolio based on these projects. Respond with JSON: { unifiedSummary: string }" }, 
            { role: "user", content: JSON.stringify(refinedProjects.slice(0, 10)) }
          ],
          response_format: { type: "json_object" }
       });
       const sumData = JSON.parse(sumComp.choices[0].message.content);

       job.consolidated = { unifiedSummary: sumData.unifiedSummary || "", refinedProjects };
       broadcast(userId, { type: 'CONSOLIDATED', mode: 'intelligence', data: job.consolidated });
       job.status = 'COMPLETED';
       broadcast(userId, { type: 'COMPLETE', mode: 'intelligence', data: refinedProjects });
       return;
    }

    const consSysPrompt = `You are an AI Career Consultant and ATS Expert.
Your task is to analyze these ${job.results.length} technical project summaries and SELECT only the 3 or 4 most relevant projects that align with the Target Role: ${jobProfile.title} and the Job Description: ${jobProfile.description}.

For each of the selected projects:
1. Create 3 high-impact, quantified bullet points.
2. Focus on hard tech skills and measurable results (e.g., "Improved performance by 20%").
3. Ensure the project name is the exact repo name.

Respond ONLY with JSON: { unifiedSummary: string, projects: [{name, resumeBullets: []}] } where 'projects' contains exactly the 3-4 best matches.`;

    // Limit results for consolidation to avoid context blowout for resume mode
    const consolidatedInput = job.results.slice(0, 20); 
    
    const consCompletion = await nvidia.chat.completions.create({
      model: "meta/llama-3.3-70b-instruct",
      messages: [{ role: "system", content: consSysPrompt }, { role: "user", content: JSON.stringify(consolidatedInput) }],
      response_format: { type: "json_object" }
    });
    job.consolidated = JSON.parse(consCompletion.choices[0].message.content);
    broadcast(userId, { type: 'CONSOLIDATED', mode, data: job.consolidated });

    if (mode === 'intelligence') {
       job.status = 'COMPLETED';
       console.log(`\x1b[32m[JOB COMPLETE]\x1b[0m Intelligence extraction + Global Summary finished for user ${userId}`);
       broadcast(userId, { type: 'COMPLETE', mode: 'intelligence', data: job.consolidated.refinedProjects || job.results });
       return;
    }

    job.phase = 'GENERATING_NARRATIVE';
    job.markdown = "";
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'GENERATING_NARRATIVE' });
    const mdCompletionStream = await nvidia.chat.completions.create({
      model: "meta/llama-3.3-70b-instruct",
      messages: [
        { 
          role: "system",
          content: `You are an Executive Résumé Architect and ATS (Applicant Tracking System) Optimization Expert.
Your primary unique value is transforming complex GitHub repository analysis into professional, impact-driven resume content.

CRITICAL VISUAL & DATA RULES:
1. START WITH NAME: The VERY FIRST line of your response MUST be a # Header with the candidate's name. Example: # ${staticInfo.name || 'CANDIDATE'}
2. CONTACT INFO: Immediately below the name, place a single line: ${staticInfo.email || 'Email'} | ${staticInfo.links || 'Portfolio/GitHub'}.
3. NO PLACEHOLDERS: NEVER output text like "No data to report". If a section has no data, OMIT the header entirely.
4. PROJECTS: The GitHub Analysis JSON contains the top 3-4 most relevant projects selected specifically for this role. List EVERY project from this JSON as its own ### Header in the ## PROJECTS section.
5. DATA-DRIVEN BULLETS: Use the 'resumeBullets' from the JSON for each project. Do not invent new details, but you may polish the wording for executive tone.
6. HIERARCHY: ## PROFESSIONAL SUMMARY -> ## TECHNICAL SKILLS -> ## PROJECTS -> ## EXPERIENCE -> ## EDUCATION -> ## CERTIFICATIONS.
7. QUANTIFIED ACHIEVEMENTS: Use strong action verbs. Quantify results using metrics found in the JSON or provided context.
8. EXPERIENCE: Use the pre-formatted experienceBlock exactly. Ensure it is separated from PROJECTS by ample vertical space.
9. NO TABLES: Use only Markdown bullets and clean indentation.

Respond ONLY with valid Markdown.`
        }, 
        { 
          role: "user", 
          content: `Generate a high-impact engineering resume for ${staticInfo.name || 'this candidate'}.

TARGET JOB:
- Title: ${jobProfile.title || 'Software Engineer'}
- JD: ${jobProfile.description || ''}

MANDATORY DATA TO INCORPORATE:

[GITHUB PROJECT ANALYSIS] -> Transform every entry here into a separate ### Project section:
${JSON.stringify(job.consolidated, null, 2)}

[WORK EXPERIENCE] -> Use exactly as provided:
${experienceBlock || ''}

[EDUCATION] -> Use exactly as provided:
${educationBlock || ''}

[CERTIFICATIONS] -> Omit section if empty:
${certBlock || ''}`
        }
      ],
      stream: true
    });

    console.log(`\x1b[35m[AI STREAMING]\x1b[0m Starting Markdown Resume...`);
    for await (const chunk of mdCompletionStream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        if (job.markdown === "") console.log(`\x1b[35m[AI FIRST CHUNK]\x1b[0m ${content.slice(0, 50)}`);
        job.markdown += content;
        broadcast(userId, { type: 'MD_CHUNK', chunk: content });
      }
    }

    job.status = 'COMPLETED';
    broadcast(userId, { type: 'COMPLETE', markdown: job.markdown });
    console.log(`\x1b[32m[JOB COMPLETE]\x1b[0m User: ${userId}`);
    
  } catch (error) {
    console.error(`\x1b[31m[JOB ERROR]\x1b[0m`, error);
    job.status = 'FAILED';
    broadcast(userId, { type: 'ERROR', error: 'Background analysis failed' });
  }
}

app.post('/api/start-resume-job', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  const userId = getEmailHash(req.user.emails?.[0]?.value || req.user.id);
  const { repos, jobProfile, staticInfo, mode } = req.body;

  const resolvedMode = mode || 'resume';
  if (jobs.get(`${userId}:${resolvedMode}`)?.status === 'RUNNING') {
    return res.status(429).json({ error: 'Job already running.' });
  }

  // If repos is empty or user implicitly wants auto-select
  const autoSelect = !repos || repos.length === 0;
  
  runResumeBuilder(userId, req.user.accessToken, repos, jobProfile, staticInfo, autoSelect, resolvedMode);
  res.json({ message: 'Job started' });
});

app.get('/api/repos', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).end();
  try {
    const { data } = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: { Authorization: `token ${req.user.accessToken}` }
    });
    res.json(data);
  } catch (err) { res.status(500).end(); }
});

app.listen(PORT, () => console.log(`\x1b[32m[SERVER]\x1b[0m Running on port ${PORT}`));

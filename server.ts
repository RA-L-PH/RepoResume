import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1); // Required for secure cookies behind proxy
  console.log('Starting server with APP_URL:', process.env.APP_URL);

  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || 'repo-resume-secret',
    resave: true,
    saveUninitialized: true,
    name: 'repo_resume_session',
    proxy: true,
    cookie: {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // GitHub OAuth Routes
  app.get('/api/auth/github/url', (req, res) => {
    const host = req.get('host');
    const protocol = req.protocol;
    const currentUrl = `${protocol}://${host}`;
    const redirectUri = `${process.env.APP_URL || currentUrl}/auth/github/callback`;
    console.log('Generating OAuth URL with redirect:', redirectUri);
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: 'repo,user',
      state: Math.random().toString(36).substring(7),
    });
    res.json({ url: `https://github.com/login/oauth/authorize?${params.toString()}` });
  });

  app.get('/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    console.log('Received GitHub callback with code');
    try {
      const response = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }, {
        headers: { Accept: 'application/json' }
      });

      const { access_token } = response.data;
      if (!access_token) {
        console.error('No access token in GitHub response:', response.data);
        throw new Error('No access token received');
      }

      // Store token in session
      (req as any).session.githubToken = access_token;
      console.log('GitHub token stored in session. ID:', (req as any).sessionID);

      (req as any).session.save((err: any) => {
        if (err) console.error('Session save error:', err);
        console.log('Session saved successfully. ID:', (req as any).sessionID);
        
        res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Authentication successful. This window should close automatically.</p>
            </body>
          </html>
        `);
      });
    } catch (error: any) {
      console.error('GitHub OAuth error:', error.response?.data || error.message);
      res.status(500).send('Authentication failed');
    }
  });

  // NVIDIA NIM Analysis Endpoint
  app.post('/api/analyze/nvidia', async (req, res) => {
    const { readmeContent } = req.body;
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: 'NVIDIA API Key not configured' });
    }

    try {
      const response = await axios.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          model: "deepseek-ai/deepseek-v3.2",
          messages: [
            { 
              role: "system", 
              content: "You are a technical recruiter. Extract structured project info (projectName, purpose, techStack, keyFeatures) from the README in JSON format." 
            },
            { role: "user", content: readmeContent }
          ],
          temperature: 0.2,
          top_p: 0.7,
          max_tokens: 4096,
          extra_body: {
            chat_template_kwargs: { thinking: true }
          },
          response_format: { type: "json_object" }
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );

      const content = response.data.choices[0].message.content;
      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error('NVIDIA NIM error:', error.response?.data || error.message);
      res.status(500).json({ error: 'NVIDIA NIM analysis failed' });
    }
  });

  app.get('/api/auth/status', (req, res) => {
    const hasToken = !!(req as any).session.githubToken;
    const sessionId = (req as any).sessionID;
    console.log('Auth status check. Session ID:', sessionId, 'Has token:', hasToken);
    res.json({ 
      isAuthenticated: hasToken,
      sessionId: sessionId 
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    (req as any).session.destroy(() => {
      res.json({ success: true });
    });
  });

  // GitHub API Proxies
  app.get('/api/github/user', async (req, res) => {
    const token = (req as any).session.githubToken;
    console.log('Fetching GitHub user. Token exists:', !!token);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${token}` }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Fetch user error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  app.get('/api/github/repos', async (req, res) => {
    const token = (req as any).session.githubToken;
    console.log('Fetching GitHub repos. Token exists:', !!token);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const response = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: { Authorization: `token ${token}` }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Fetch repos error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch repos' });
    }
  });

  app.get('/api/github/readme', async (req, res) => {
    const token = (req as any).session.githubToken;
    const { owner, repo } = req.query;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: { 
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.raw'
        }
      });
      res.json({ content: response.data });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch readme' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

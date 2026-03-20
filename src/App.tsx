import { useState, useEffect, useCallback } from 'react';
import { Github, Search, Sparkles, Copy, LogOut, Loader2, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { Repo, ProjectAnalysis, ResumeSummary } from './types';
import { analyzeProject, generateResumeSummary } from './services/geminiService';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [summary, setSummary] = useState<ResumeSummary | null>(null);
  const [editedSummary, setEditedSummary] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<'gemini' | 'nvidia'>('gemini');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      const data = await res.json();
      console.log('Auth status check:', data.isAuthenticated, 'Session ID:', data.sessionId);
      setIsAuthenticated(data.isAuthenticated);
      setSessionId(data.sessionId);
      if (data.isAuthenticated) {
        fetchUser();
        fetchRepos();
      }
    } catch (err) {
      console.error('Auth check failed', err);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log('Received OAuth success message');
        // Small delay to ensure session is persisted on server
        setTimeout(checkAuth, 1000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [checkAuth]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/github/user', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch user');
      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.error('Fetch user failed', err);
    }
  };

  const fetchRepos = async () => {
    try {
      const res = await fetch('/api/github/repos', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch repos');
      const data = await res.json();
      setRepos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch repos failed', err);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/auth/github/url', { credentials: 'include' });
      const { url } = await res.json();
      window.open(url, 'github_oauth', 'width=600,height=700');
    } catch (err) {
      setError('Failed to start GitHub connection');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setIsAuthenticated(false);
    setUser(null);
    setRepos([]);
    setSelectedRepo(null);
    setAnalysis(null);
    setSummary(null);
  };

  const handleAnalyze = async (repo: Repo) => {
    setSelectedRepo(repo);
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setSummary(null);

    try {
      const res = await fetch(`/api/github/readme?owner=${repo.owner.login}&repo=${repo.name}`, { credentials: 'include' });
      const { content } = await res.json();
      
      if (!content) throw new Error('Could not find README.md');

      let projectAnalysis;
      if (aiModel === 'nvidia') {
        const nvidiaRes = await fetch('/api/analyze/nvidia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ readmeContent: content })
        });
        if (!nvidiaRes.ok) {
          const errData = await nvidiaRes.json();
          throw new Error(errData.error || 'NVIDIA NIM analysis failed');
        }
        projectAnalysis = await nvidiaRes.json();
      } else {
        projectAnalysis = await analyzeProject(content);
      }
      
      setAnalysis(projectAnalysis);

      const resumeSummary = await generateResumeSummary(projectAnalysis);
      setSummary(resumeSummary);
      setEditedSummary(resumeSummary.bulletPoints);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = () => {
    const text = editedSummary.map(point => `• ${point}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tight">RepoResume</span>
          </div>

          {isAuthenticated && user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                <img src={user.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                <span className="text-sm font-medium">{user.login}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-400 hover:text-white"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {!isAuthenticated ? (
          <div className="max-w-2xl mx-auto text-center py-20">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent"
            >
              Your GitHub work, <br />resume-ready.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-zinc-400 text-lg mb-10"
            >
              Transform your repositories into high-impact project descriptions using AI. 
              Bridge the gap between code and career storytelling.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-4"
            >
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-500/20"
              >
                <Github className="w-5 h-5" />
                Connect GitHub
              </button>
              
              <button
                onClick={checkAuth}
                className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
              >
                Already authorized? Click here to refresh status
              </button>
              
              {isAuthenticated === false && (
                <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-xl text-xs text-zinc-500 font-mono">
                  <p>Debug Info:</p>
                  <p>Session ID: {sessionId || 'Loading...'}</p>
                </div>
              )}
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar: Repo Browser */}
            <div className="lg:col-span-4 space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>

              <div className="p-1 bg-white/5 border border-white/10 rounded-xl flex gap-1">
                <button
                  onClick={() => setAiModel('gemini')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                    aiModel === 'gemini' ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
                  )}
                >
                  Gemini
                </button>
                <button
                  onClick={() => setAiModel('nvidia')}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
                    aiModel === 'nvidia' ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
                  )}
                >
                  NVIDIA NIM
                </button>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => handleAnalyze(repo)}
                    disabled={isAnalyzing}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all group",
                      selectedRepo?.id === repo.id 
                        ? "bg-emerald-500/10 border-emerald-500/50" 
                        : "bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.07]"
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-semibold truncate">{repo.name}</span>
                      {repo.private && (
                        <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-white/5">
                          Private
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-2">
                      {repo.description || "No description provided."}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1 group-hover:text-emerald-400 transition-colors">
                        Analyze <Sparkles className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content: Analysis & Summary */}
            <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                {!selectedRepo ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]"
                  >
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                      <Github className="w-8 h-8 text-zinc-500" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Select a repository</h2>
                    <p className="text-zinc-500 max-w-xs">
                      Choose a project from the sidebar to start the AI-powered analysis.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={selectedRepo.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                  >
                    {/* Repo Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight mb-1">{selectedRepo.name}</h2>
                        <a 
                          href={selectedRepo.html_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-zinc-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                        >
                          {selectedRepo.full_name} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      {isAnalyzing && (
                        <div className="flex items-center gap-2 text-emerald-500 font-medium animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                      </div>
                    )}

                    {analysis && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Project Purpose</h3>
                          <p className="text-zinc-200 leading-relaxed">{analysis.purpose}</p>
                        </div>
                        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Tech Stack</h3>
                          <div className="flex flex-wrap gap-2">
                            {analysis.techStack.map((tech, i) => (
                              <span key={i} className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/20">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {summary && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-8 bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-4">
                          <button 
                            onClick={copyToClipboard}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
                              copied 
                                ? "bg-emerald-500 text-black" 
                                : "bg-white/10 hover:bg-white/20 text-white"
                            )}
                          >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? "Copied!" : "Copy Text"}
                          </button>
                        </div>

                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-emerald-500" />
                          Resume Summary
                        </h3>

                        <div className="space-y-4">
                          {editedSummary.map((point, index) => (
                            <div key={index} className="flex gap-4 group">
                              <span className="text-emerald-500 font-bold mt-1">•</span>
                              <textarea
                                value={point}
                                onChange={(e) => {
                                  const newSummary = [...editedSummary];
                                  newSummary[index] = e.target.value;
                                  setEditedSummary(newSummary);
                                }}
                                className="w-full bg-transparent text-zinc-300 leading-relaxed focus:outline-none focus:text-white transition-colors resize-none overflow-hidden"
                                rows={Math.ceil(point.length / 60)}
                              />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Loader2 } from 'lucide-react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'

// Components
// Pages
import { Login } from './pages/Login'
import { Explorer } from './pages/Explorer'
import { ResumeMaker } from './pages/ResumeMaker'

const BACKEND_URL = 'http://localhost:3001'
axios.defaults.withCredentials = true

interface Repository {
  id: number
  name: string
  description: string
  full_name: string
  updated_at: string
}
interface EduEntry { degree: string; institution: string; period: string }
interface ExpEntry { role: string; company: string; period: string; description: string }
interface CertEntry { name: string; issuer: string; date: string }

const PHASES_MAP: any = {
  'UNDERSTANDING_REPOS': 'Analyzing Repository Graph...',
  'SELECTING_PROJECTS': 'Orchestrating Project Portfolio...',
  'SUMMARIZING_CONTENT': 'Synthesizing Architectural Narratives...',
  'REFINING_EXPERIENCE': 'Vectorizing Impact Bullet Points...',
  'CREATING_DESCRIPTIONS': 'Forging Technical Project Blocks...',
  'GENERATING_NARRATIVE': 'Drafting Professional Engineering Narrative...',
  'CONSOLIDATING': 'Strategizing Content...',
  'idle': 'Initializing Engine...'
};

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [repos, setRepos] = useState<Repository[]>([])
  const [search, setSearch] = useState('')
  const [jobProfile, setJobProfile] = useState({ title: '', description: '' })
  const [staticInfo, setStaticInfo] = useState({
    name: '', email: '', links: '', education: '', certifications: '', jobHistory: ''
  })
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<number>>(new Set())
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, phase: 'idle' })
  const [markdownResume, setMarkdownResume] = useState('')
  const [sseConnected, setSseConnected] = useState(false)
  const [isIntelligenceRunning, setIsIntelligenceRunning] = useState(false)
  const [isResumeRunning, setIsResumeRunning] = useState(false)
  const [intelligenceResults, setIntelligenceResults] = useState<any>(null)
  const [eduList, setEduList] = useState<EduEntry[]>([{ degree: '', institution: '', period: '' }])
  const [expList, setExpList] = useState<ExpEntry[]>([{ role: '', company: '', period: '', description: '' }])
  const [certList, setCertList] = useState<CertEntry[]>([{ name: '', issuer: '', date: '' }])
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('repo-resume-theme') as 'light' | 'dark') || 'dark';
  });

  const toggleTheme = () => {
    toast.dismiss();
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    toast.success(`Engine Mode: ${next.toUpperCase()}`, { position: 'bottom-center', duration: 1500 });
  };

  useEffect(() => {
    localStorage.setItem('repo-resume-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => { checkAuth() }, [])

  useEffect(() => {
    if (user) {
      const eventSource = new EventSource(`${BACKEND_URL}/api/stream`, { withCredentials: true })
      eventSource.onopen = () => { console.log("SSE Connection Established"); setSseConnected(true); }
      eventSource.onerror = (err) => { 
        console.error("SSE Connection Error", err); 
        setSseConnected(false); 
        eventSource.close();
        setTimeout(() => checkAuth(), 3000); 
      }
      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data)
        switch(data.type) {
           case 'RECOVERY':
             const s = data.state
             if (s.mode === 'intelligence') {
               setIsIntelligenceRunning(s.status === 'RUNNING')
               if (s.consolidated) setIntelligenceResults(s.consolidated)
             } else {
               setIsResumeRunning(s.status === 'RUNNING')
               if (s.markdown) setMarkdownResume(s.markdown)
             }
             break
           case 'START':
             if (data.job.mode === 'intelligence') {
                setIsIntelligenceRunning(true)
                setIntelligenceResults(null)
             } else {
                setIsResumeRunning(true)
             }
             setMarkdownResume('');
             setBulkProgress({ current: 0, total: data.job.totalChunks, phase: 'initializing' })
             break
           case 'PHASE_CHANGE':
             setBulkProgress(prev => ({ ...prev, phase: data.phase }))
             break
           case 'MD_CHUNK':
             setMarkdownResume(prev => prev + data.chunk)
             break
            case 'CONSOLIDATED':
              if (data.mode === 'intelligence' && (data.data.refinedProjects || data.data.projects)) {
                 setIntelligenceResults(data.data)
              }
              break
            case 'COMPLETE':
               if (data.markdown) setMarkdownResume(data.markdown)
               if (data.mode === 'intelligence' && data.data) {
                  setIntelligenceResults(data.data)
               }
               setIsResumeRunning(false)
               setIsIntelligenceRunning(false)
               break
           case 'ERROR':
             setIsIntelligenceRunning(false); setIsResumeRunning(false); alert(data.error); break
        }
      }
      return () => eventSource.close()
    }
  }, [user])

  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/auth/me`)
      setUser(data); 
      if (data.profile && Object.keys(data.profile).length > 0) {
        const { eduList: savedEdu, expList: savedExp, certList: savedCert, ...savedStatic } = data.profile;
        if (Object.keys(savedStatic).length > 0) setStaticInfo(prev => ({ ...prev, ...savedStatic }));
        if (savedEdu?.length) setEduList(savedEdu);
        if (savedExp?.length) setExpList(savedExp);
        if (savedCert?.length) setCertList(savedCert);
      }
      fetchRepos();
    } catch (err) { setUser(null) } finally { setLoading(false) }
  }

  const saveProfile = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/profile`, { ...staticInfo, eduList, expList, certList })
      toast.success("Career Intelligence Saved Permanently!");
    } catch (err) { toast.error("Failed to save profile") }
  }

  const fetchRepos = async (force = false) => {
    if (!force) {
      const cached = localStorage.getItem('repo_cache')
      if (cached) {
        setRepos(JSON.parse(cached))
        return
      }
    }
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/repos${force ? '?refresh=true' : ''}`)
      setRepos(data)
      localStorage.setItem('repo_cache', JSON.stringify(data))
    } catch (err) { console.error("Fetch repos failed") }
  }

  const handleLogout = async () => {
    await axios.post(`${BACKEND_URL}/auth/logout`)
    setUser(null); setRepos([])
  }

  const startResumeJob = async (mode: 'resume' | 'intelligence' = 'resume') => {
    const reposToAnalyze = selectedRepoIds.size === 0
      ? [] 
      : repos.filter(r => selectedRepoIds.has(r.id))
    const enrichedStaticInfo = {
      ...staticInfo,
      education: eduList.filter(e => e.degree || e.institution).map(e => `${e.degree} | ${e.institution} | ${e.period}`).join('\n'),
      certifications: certList.filter(c => c.name).map(c => `${c.name} | ${c.issuer} | ${c.date}`).join('\n'),
      jobHistory: expList.filter(e => e.role || e.company).map(e => `${e.role} | ${e.company} | ${e.period}${e.description ? ' | ' + e.description : ''}`).join('\n'),
    }
    try {
      const endpoint = mode === 'intelligence' ? '/api/analyze-intelligence' : '/api/generate-resume';
      const payload = mode === 'intelligence' 
        ? { repos: reposToAnalyze, mode }
        : { repos: reposToAnalyze, jobProfile, staticInfo: enrichedStaticInfo, mode };
      await axios.post(`${BACKEND_URL}${endpoint}`, payload)
    } catch (err: any) { toast.error("Failed to start job") }
  }

  const toggleRepoSelection = (id: number) => {
    const next = new Set(selectedRepoIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedRepoIds(next)
  }

  const copyStructuredToClipboard = () => {
    let text = `GLOBAL CAREER INTELLIGENCE:\n"${intelligenceResults?.unifiedSummary || ''}"\n\n`;
    text += `PROJECT HIGHLIGHTS:\n${'='.repeat(20)}\n\n`;
    (intelligenceResults?.refinedProjects || intelligenceResults?.projects || []).forEach((r: any) => {
      text += `${r.projectName || r.name}\n`;
      text += `Summary: ${r.oneLineSummary || ''}\n`;
      text += `Technologies: ${(r.techStack || []).join(', ')}\n\n`;
      if (r.formattedFeatures) {
        text += `Key Features & Implementation:\n`;
        (r.formattedFeatures || []).forEach((f: string) => text += `  · ${f}\n`);
      }
      text += `\n\n`;
    });
    navigator.clipboard.writeText(text);
    toast.success('Career History Copied to Clipboard!');
  }

  if (loading) return <div className="h-screen bg-[#0c0c0e] flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>

  const explorerProps = {
    user, repos, selectedRepoIds, toggleRepoSelection, isIntelligenceRunning, 
    intelligenceResults, bulkProgress, PHASES_MAP, handleLogout, fetchRepos, 
    startResumeJob, search, setSearch, setSelectedRepoIds, copyStructuredToClipboard,
    theme, toggleTheme
  };

  const resumeProps = {
    user, handleLogout, staticInfo, setStaticInfo, jobProfile, setJobProfile, 
    eduList, setEduList, certList, setCertList, expList, setExpList, 
    saveProfile, startResumeJob, isResumeRunning, markdownResume, 
    sseConnected, bulkProgress, PHASES_MAP, theme, toggleTheme, BACKEND_URL
  };

  return (
    <div className="relative min-h-screen text-primary overflow-hidden transition-colors duration-300">
      <Toaster 
        position="bottom-center"
        toastOptions={{
          duration: 1500,
          style: {
            background: theme === 'dark' ? 'rgba(12, 12, 14, 0.95)' : '#ffffff',
            color: theme === 'dark' ? '#ffffff' : '#0c0c0e',
            borderRadius: '1rem',
            fontSize: '0.75rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            padding: '12px 24px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
          }
        }}
      />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="h-screen w-full flex">
          <Routes>
            <Route path="/" element={<Navigate to="/explorer" />} />
            <Route 
              path="/login" 
              element={user ? <Navigate to="/explorer" /> : <Login BACKEND_URL={BACKEND_URL} theme={theme} toggleTheme={toggleTheme} />} 
            />
            <Route 
              path="/explorer" 
              element={!user ? <Navigate to="/login" /> : <Explorer {...explorerProps} />} 
            />
            <Route 
              path="/resume" 
              element={!user ? <Navigate to="/login" /> : <ResumeMaker {...resumeProps} />} 
            />
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  )
}

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Github, LogOut, User, Copy, Search, Loader2, FileText, Layout as LayoutIcon, Briefcase, GraduationCap, Sparkles, Terminal, Award, Save, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
  'SELECTING_PROJECTS': 'Auto-Selecting Best-Fit Repositories...',
  'SUMMARIZING_CONTENT': 'Synthesizing Architectural Narratives...',
  'REFINING_EXPERIENCE': 'Vectorizing Impact Bullet Points...',
  'CREATING_DESCRIPTIONS': 'Forging Technical Project Blocks...',
  'GENERATING_NARRATIVE': 'Drafting Professional Engineering Narrative...'
};

function PageHeader({ user, handleLogout, activeView }: any) {
  return (
    <header className="h-20 border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-md sticky top-0 z-30 px-8 flex items-center justify-between">
       <div className="flex items-center gap-8">
          <Link to="/explorer" className={cn("text-xs font-black italic tracking-widest uppercase transition-all", activeView === 'explorer' ? "text-indigo-400" : "text-gray-500 hover:text-white")}>Project Intelligence</Link>
          <Link to="/resume" className={cn("text-xs font-black italic tracking-widest uppercase transition-all", activeView === 'resume' ? "text-indigo-400" : "text-gray-500 hover:text-white")}>Resume Maker</Link>
       </div>
       <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 group cursor-default">
             <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-fuchsia-500 p-[1px] overflow-hidden">
                <div className="h-full w-full rounded-full bg-[#0c0c0e] flex items-center justify-center overflow-hidden">
                  {user.photos?.[0]?.value ? (
                     <img src={user.photos[0].value} alt={user.username} className="h-full w-full object-cover scale-110" />
                  ) : (
                     <User size={14} className="text-white" />
                  )}
                </div>
             </div>
             <span className="text-xs font-bold text-gray-300">{user.username}</span>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition-all">
             <LogOut size={16} />
          </button>
       </div>
    </header>
  )
}

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [repos, setRepos] = useState<Repository[]>([])
  const [search, setSearch] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
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
           case 'CHUNK_COMPLETE':
             // Not needed if we only show results once consolidated
             break
           case 'PHASE_CHANGE':
             setBulkProgress(prev => ({ ...prev, phase: data.phase })) // Keep original case for PHASES_MAP
             break
           case 'MD_CHUNK':
             setMarkdownResume(prev => prev + data.chunk)
             break
            case 'CONSOLIDATED':
              // Only update Explorer's project blocks if this is from an intelligence job
              if (data.mode === 'intelligence' && (data.data.refinedProjects || data.data.projects)) {
                 setIntelligenceResults(data.data)
              }
              break
            case 'COMPLETE':
              if (data.markdown) setMarkdownResume(data.markdown)
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
      alert("Career Intelligence Saved Permanently!");
    } catch (err) { alert("Failed to save profile") }
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
      const { data } = await axios.get(`${BACKEND_URL}/api/repos`)
      setRepos(data)
      localStorage.setItem('repo_cache', JSON.stringify(data))
    } catch (err) { console.error("Fetch repos failed") }
  }

  const handleLogout = async () => {
    await axios.post(`${BACKEND_URL}/auth/logout`)
    setUser(null); setRepos([])
  }

  const startResumeJob = async (mode: 'resume' | 'intelligence' = 'resume') => {
    const reposToAnalyze = (mode === 'resume' || selectedRepoIds.size === 0)
      ? repos
      : repos.filter(r => selectedRepoIds.has(r.id))
    // Serialize structured lists to pipe-delimited strings for the AI prompt
    const enrichedStaticInfo = {
      ...staticInfo,
      education: eduList.filter(e => e.degree || e.institution).map(e => `${e.degree} | ${e.institution} | ${e.period}`).join('\n'),
      certifications: certList.filter(c => c.name).map(c => `${c.name} | ${c.issuer} | ${c.date}`).join('\n'),
      jobHistory: expList.filter(e => e.role || e.company).map(e => `${e.role} | ${e.company} | ${e.period}${e.description ? ' | ' + e.description : ''}`).join('\n'),
    }
    try {
      await axios.post(`${BACKEND_URL}/api/start-resume-job`, { repos: reposToAnalyze, jobProfile, staticInfo: enrichedStaticInfo, mode })
    } catch (err: any) { alert("Failed to start job") }
  }

  const selectRepo = async (repo: Repository) => {
    setSelectedRepo(repo)
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
    alert('Structured Plain Text copied to clipboard!');
  }

  if (loading) return <div className="h-screen bg-[#0c0c0e] flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>

  if (!user) return (
    <div className="h-screen bg-[#0c0c0e] flex items-center justify-center text-white p-10">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-8 max-w-sm">
        <h1 className="text-5xl font-bold tracking-tight">Repo<span className="text-indigo-500">Resume</span></h1>
        <p className="text-gray-500">The Ultimate Engineering Resume Engine</p>
        <button onClick={() => window.location.href = `${BACKEND_URL}/auth/github`} className="w-full py-4 bg-white text-black rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-all">
          <Github className="h-5 w-5" /> Login with GitHub
        </button>
      </motion.div>
    </div>
  )

  const explorerSidebar = (
    <div className="w-80 border-r border-white/5 bg-white/[0.02] flex flex-col h-full overflow-hidden">
       <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <FileText className="text-indigo-500" />
             <span className="font-bold text-lg">Explorer</span>
          </div>
          <button onClick={() => fetchRepos(true)} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-indigo-400 transition-all active:rotate-180 duration-500">
             <Search size={16} /> 
          </button>
       </div>
       <div className="p-4 space-y-4 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <input 
              placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedRepoIds(new Set(repos.map(r => r.id)))} className="flex-1 py-1 text-[10px] bg-white/5 border border-white/10 rounded-md font-bold text-gray-300">Select All</button>
            <button onClick={() => setSelectedRepoIds(new Set())} className="flex-1 py-1 text-[10px] bg-white/5 border border-white/10 rounded-md font-bold text-gray-300">Select None</button>
          </div>
          <button 
             onClick={() => startResumeJob('intelligence')}
             disabled={isIntelligenceRunning || selectedRepoIds.size === 0}
             className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30 shadow-xl shadow-indigo-600/10"
          >
             {isIntelligenceRunning ? <Loader2 className="h-3 w-3 animate-spin"/> : <Terminal className="h-3 w-3"/>}
             Extract Intelligence
          </button>
          <div className="h-[1px] bg-white/5 my-2" />
          <nav className="space-y-2">
             {repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).map(repo => (
               <div key={repo.id} className={cn(
                 "flex items-center gap-3 p-1 rounded-2xl transition-all",
                 selectedRepoIds.has(repo.id) ? "bg-indigo-500/20 ring-1 ring-indigo-500/50" : ""
               )}>
                  <input type="checkbox" checked={selectedRepoIds.has(repo.id)} onChange={() => toggleRepoSelection(repo.id)} className="accent-indigo-500 ml-2" />
                  <button 
                    onClick={() => selectRepo(repo)}
                    className={cn("flex-1 text-left p-2.5 rounded-xl text-xs truncate transition-all", selectedRepo?.id === repo.id ? "text-white" : "text-gray-400")}
                  >
                    <span className={cn("font-bold", selectedRepoIds.has(repo.id) && "text-white")}>{repo.name}</span>
                    <span className="opacity-30 mx-1">|</span>
                    <span className="text-[10px] opacity-60 uppercase">{repo.full_name.split('/')[0]}</span>
                  </button>
               </div>
             ))}
          </nav>
       </div>
    </div>
  )

  const resumeSidebar = (
    <div className="w-80 border-r border-white/5 bg-[#0c0c0e] flex flex-col h-full overflow-hidden p-4 gap-4">
      {/* Card with Save top-right */}
      <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col overflow-hidden relative min-h-0">
        {/* Save button — top-right of card */}
        <button
          onClick={saveProfile}
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all"
        >
          <Save size={10} /> Save
        </button>

        {/* Scrollable input fields */}
        <div className="flex-1 overflow-y-auto p-5 pt-10 space-y-6 scrollbar-thin">
          {/* Personal Info */}
          <div className="space-y-3">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Personal Info</h3>
            <input
              placeholder="Full Name"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors"
              value={staticInfo.name} onChange={e => setStaticInfo({...staticInfo, name: e.target.value})}
            />
            <input
              placeholder="Email address"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors"
              value={staticInfo.email} onChange={e => setStaticInfo({...staticInfo, email: e.target.value})}
            />
            <textarea
              placeholder="Portfolio, GitHub, LinkedIn (one per line)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-colors h-16 resize-none"
              value={staticInfo.links} onChange={e => setStaticInfo({...staticInfo, links: e.target.value})}
            />
          </div>

          {/* Target Role */}
          <div className="space-y-3">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-400">Target Role</h3>
            <input
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-fuchsia-500/50 transition-colors"
              value={jobProfile.title} onChange={e => setJobProfile({...jobProfile, title: e.target.value})}
            />
            <textarea
              placeholder="Paste the full Job Description here..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-fuchsia-500/50 transition-colors h-28 resize-none"
              value={jobProfile.description} onChange={e => setJobProfile({...jobProfile, description: e.target.value})}
            />
          </div>

          {/* Education */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1.5">
                <GraduationCap size={10} /> Education
              </h3>
              <button onClick={() => setEduList(p => [...p, { degree: '', institution: '', period: '' }])}
                className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60 hover:text-emerald-400 transition-colors flex items-center gap-1">
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {eduList.map((edu, i) => (
                <div key={i} className="relative bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2 group">
                  <button onClick={() => setEduList(p => p.filter((_, j) => j !== i))}
                    className="absolute top-2 right-2 text-white/10 hover:text-red-400 transition-colors text-xs font-black">✕</button>
                  <input placeholder="Degree / Course"
                    className="w-full bg-transparent border-b border-white/10 pb-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    value={edu.degree} onChange={e => setEduList(p => p.map((x, j) => j === i ? { ...x, degree: e.target.value } : x))} />
                  <input placeholder="Institution"
                    className="w-full bg-transparent border-b border-white/10 pb-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    value={edu.institution} onChange={e => setEduList(p => p.map((x, j) => j === i ? { ...x, institution: e.target.value } : x))} />
                  <input placeholder="Period (e.g. 2020–2024)"
                    className="w-full bg-transparent text-xs text-white placeholder:text-white/20 focus:outline-none transition-colors"
                    value={edu.period} onChange={e => setEduList(p => p.map((x, j) => j === i ? { ...x, period: e.target.value } : x))} />
                </div>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1.5">
                <Award size={10} /> Certifications
              </h3>
              <button onClick={() => setCertList(p => [...p, { name: '', issuer: '', date: '' }])}
                className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60 hover:text-emerald-400 transition-colors flex items-center gap-1">
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {certList.map((cert, i) => (
                <div key={i} className="relative bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2 group">
                  <button onClick={() => setCertList(p => p.filter((_, j) => j !== i))}
                    className="absolute top-2 right-2 text-white/10 hover:text-red-400 transition-colors text-xs font-black">✕</button>
                  <input placeholder="Certification Name"
                    className="w-full bg-transparent border-b border-white/10 pb-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    value={cert.name} onChange={e => setCertList(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input placeholder="Issuing Body"
                    className="w-full bg-transparent border-b border-white/10 pb-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    value={cert.issuer} onChange={e => setCertList(p => p.map((x, j) => j === i ? { ...x, issuer: e.target.value } : x))} />
                  <input placeholder="Date (e.g. Oct 2023)"
                    className="w-full bg-transparent text-xs text-white placeholder:text-white/20 focus:outline-none transition-colors"
                    value={cert.date} onChange={e => setCertList(p => p.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                </div>
              ))}
            </div>
          </div>

          {/* Work Experience */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-400 flex items-center gap-1.5">
                <Briefcase size={10} /> Work Experience
              </h3>
              <button onClick={() => setExpList(p => [...p, { role: '', company: '', period: '', description: '' }])}
                className="text-[9px] font-black uppercase tracking-widest text-sky-400/60 hover:text-sky-400 transition-colors flex items-center gap-1">
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {expList.map((exp, i) => (
                <div key={i} className="relative bg-white/[0.03] border border-white/10 rounded-xl p-3 space-y-2 group">
                  <button onClick={() => setExpList(p => p.filter((_, j) => j !== i))}
                    className="absolute top-2 right-2 text-white/10 hover:text-red-400 transition-colors text-xs font-black">✕</button>
                  <input placeholder="Job Title / Role"
                    className="w-full bg-transparent border-b border-white/10 pb-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-sky-500/40 transition-colors"
                    value={exp.role} onChange={e => setExpList(p => p.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} />
                  <input placeholder="Company"
                    className="w-full bg-transparent border-b border-white/10 pb-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-sky-500/40 transition-colors"
                    value={exp.company} onChange={e => setExpList(p => p.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} />
                  <input placeholder="Period (e.g. June 2022 – Present)"
                    className="w-full bg-transparent border-b border-white/10 pb-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-sky-500/40 transition-colors"
                    value={exp.period} onChange={e => setExpList(p => p.map((x, j) => j === i ? { ...x, period: e.target.value } : x))} />
                  <textarea placeholder="What you did — key responsibilities & achievements..."
                    className="w-full bg-transparent text-xs text-white placeholder:text-white/20 focus:outline-none resize-none h-20 transition-colors"
                    value={exp.description} onChange={e => setExpList(p => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Generate button — outside card, sticky at bottom */}
      <button
        onClick={() => startResumeJob('resume')}
        disabled={isResumeRunning}
        className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-2xl shadow-indigo-900/40 active:scale-95 transition-all disabled:opacity-40 disabled:grayscale hover:-translate-y-0.5 flex items-center justify-center gap-2.5 shrink-0"
      >
        {isResumeRunning
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
          : <><Zap className="h-4 w-4 fill-white" /> Generate Resume</>
        }
      </button>
    </div>
  )

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="h-screen bg-[#0c0c0e] flex overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/explorer" />} />
          <Route path="/explorer" element={
            <>
              {explorerSidebar}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                 <PageHeader user={user} handleLogout={handleLogout} activeView="explorer" />
                <div className="flex-1 overflow-y-auto p-10 scrollbar-thin">
                   <div className="max-w-4xl mx-auto space-y-8">
                      <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-black italic tracking-tighter">Project Intelligence Creator</h1>
                        {intelligenceResults && (intelligenceResults.refinedProjects || intelligenceResults.projects || []).length > 0 && (
                           <button onClick={copyStructuredToClipboard} className="px-6 py-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-xs font-bold text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                              <Copy size={16} /> Copy All as Plain Text
                           </button>
                        )}
                      </div>
                      
                       {/* Removed Global Career Intelligence block from Project Intelligence View per user request */}
                       { isIntelligenceRunning ? (
                         <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-10 py-20">
                            <div className="space-y-6">
                               <div className="h-20 w-20 mx-auto relative">
                                  <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping" />
                                  <div className="absolute inset-0 rounded-2xl bg-indigo-500 flex items-center justify-center">
                                     <Loader2 size={32} className="text-white animate-spin" />
                                  </div>
                               </div>
                               <h1 className="text-6xl font-black text-white tracking-tight uppercase italic">{PHASES_MAP[bulkProgress.phase] || 'Synthesizing...'}</h1>
                            </div>
                         </div>
                       ) : (intelligenceResults?.refinedProjects || intelligenceResults?.projects || []).length > 0 ? (
                        <div className="space-y-12 pb-20">
                           {(intelligenceResults.refinedProjects || intelligenceResults.projects || []).map((r: any, i: number) => (
                             <div key={i} className="p-10 rounded-3xl bg-white/[0.01] border border-white/5 space-y-6 relative group hover:bg-white/[0.02] transition-colors overflow-hidden">
                                <div className="flex items-center justify-between">
                                   <div>
                                      <h4 className="font-black text-3xl tracking-tight text-white mb-2">{r.projectName || r.name}</h4>
                                      <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest opacity-80">{r.oneLineSummary}</p>
                                   </div>
                                   <div className="flex flex-wrap gap-2 justify-end max-w-xs">
                                      {(Array.isArray(r.techStack) ? r.techStack : []).map((t: string) => <span key={t} className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-400 font-bold uppercase tracking-tight">{t}</span>)}
                                   </div>
                                </div>

                                <div className="space-y-6 pt-4">
                                   <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 border-b border-white/5 pb-2">Core Features & Architecture</h5>
                                   <ul className="space-y-6">
                                      {(r.formattedFeatures || []).map((f: string, idx: number) => {
                                        const [title, ...rest] = f.split(':');
                                        return (
                                          <li key={idx} className="space-y-2">
                                             <div className="flex items-center gap-3">
                                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                                <span className="font-black text-xs text-white uppercase tracking-wider">{title}</span>
                                             </div>
                                             <p className="text-sm text-gray-400 leading-relaxed pl-4 border-l border-white/10 ml-[3px]">
                                                {rest.join(':').trim()}
                                             </p>
                                          </li>
                                        );
                                      })}
                                   </ul>
                                </div>
                                
                                <button 
                                  onClick={() => {
                                     let text = `${r.projectName || r.name}\nSummary: ${r.oneLineSummary}\nTechnologies: ${(r.techStack || []).join(', ')}\n\nKey Features:\n`;
                                     (r.formattedFeatures || []).forEach((f: string) => text += `· ${f}\n`);
                                     navigator.clipboard.writeText(text);
                                     alert('Structured Project Block copied!');
                                  }}
                                  className="absolute bottom-6 right-6 p-4 bg-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-500/10 hover:scale-110"
                                >
                                   <Copy size={20} className="text-indigo-400" />
                                </button>
                             </div>
                           ))}
                        </div>
                      ) : (
                         <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-10 py-20">
                            <LayoutIcon size={80} className="opacity-10" />
                            <p className="text-lg font-bold opacity-20">Select repositories to begin technical extraction.</p>
                         </div>
                       )}
                   </div>
                </div>
              </div>
            </>
          } />
          <Route path="/resume" element={
            <>
              {resumeSidebar}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                 <PageHeader user={user} handleLogout={handleLogout} activeView="resume" />
                <div className="flex-1 overflow-y-auto p-10 scrollbar-thin">
                   <div className="max-w-4xl mx-auto">
                       <div className="bg-white rounded-3xl min-h-[1100px] flex flex-col shadow-2xl relative overflow-hidden ring-1 ring-black/5 p-16">
                          <div className="flex items-center justify-between mb-12 border-b border-gray-100 pb-4">
                             <div className="flex items-center gap-6">
                                <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2"><Briefcase size={20} className="text-indigo-600" /> Professional Document Preview</h2>
                                <div className="flex items-center gap-2.5 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full select-none">
                                   <div className={cn("h-1.5 w-1.5 rounded-full transition-all duration-500", sseConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-400 animate-pulse")} />
                                   <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">
                                     {sseConnected ? "LIVE SYNC ACTIVE" : "OFFLINE"}
                                   </span>
                                </div>
                              </div>
                              {markdownResume && (
                               <button 
                                 onClick={() => {
                                   navigator.clipboard.writeText(markdownResume);
                                   alert('Markdown Resume Copied!');
                                 }} 
                                 className="p-2 bg-gray-50 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 text-gray-400 transition-colors"
                               >
                                 <Copy size={16}/>
                               </button>
                             )}
                          </div>
                          <div className="flex-1 prose prose-slate prose-sm max-w-none prose-headings:text-black prose-headings:font-black prose-strong:text-black prose-p:text-gray-900 prose-li:text-gray-900 prose-hr:border-gray-300">
                             {markdownResume ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownResume}</ReactMarkdown>
                             ) : (
                                 <div className="h-full flex flex-col items-center justify-center text-center space-y-10 py-40">
                                    {/* Spinner */}
                                    <div className="relative h-28 w-28">
                                       <div className="absolute inset-0 rounded-full border-[6px] border-indigo-100" />
                                       <div className="absolute inset-0 rounded-full border-[6px] border-indigo-500 border-t-transparent animate-spin" />
                                       <Sparkles className="absolute inset-0 m-auto h-9 w-9 text-indigo-600" />
                                    </div>
                                    {/* Phase text — dark on white */}
                                    <div className="space-y-4">
                                       <p className="text-3xl font-black text-indigo-800 tracking-tight uppercase">
                                          {PHASES_MAP[bulkProgress.phase] || 'Drafting Career Narrative...'}
                                       </p>
                                       {/* Sync badge */}
                                       <div className="flex items-center justify-center gap-2">
                                          <div className={cn("h-2 w-2 rounded-full", sseConnected ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-red-400 animate-pulse")} />
                                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{sseConnected ? 'Live Sync Active' : 'Offline'}</span>
                                       </div>
                                       {/* Progress bar */}
                                       <div className="h-2 w-64 bg-indigo-100 rounded-full overflow-hidden mx-auto">
                                          <motion.div
                                             className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                             initial={{ width: 0 }}
                                             animate={{ width: `${Math.min((bulkProgress.current / (bulkProgress.total || 8)) * 100, 100)}%` }}
                                             transition={{ ease: 'easeOut', duration: 0.4 }}
                                          />
                                       </div>
                                    </div>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}


import { useState, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScaleLoader } from 'react-spinners'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { 
  FileText, GraduationCap, Briefcase, User, 
  Zap, Loader2, Sparkles, Send, Award, Shield, Save, Edit3,
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Link2, SeparatorHorizontal, Table
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { cn } from '../utils/cn'
import { toast } from 'react-hot-toast'
import { useStore, type EduEntry, type ExpEntry, type CertEntry } from '../store'

const PHASES_MAP: Record<string, string> = {
  'UNDERSTANDING_REPOS': 'Analyzing Repository Graph...',
  'SELECTING_PROJECTS': 'Orchestrating Portfolio...',
  'SUMMARIZING_CONTENT': 'Synthesizing Tech Data...',
  'GENERATING_NARRATIVE': 'Drafting Narrative...',
  'CONSOLIDATING': 'Strategizing Content...',
  'idle': 'Initializing Engine...'
};

export function ResumeMaker() {
  const staticInfo = useStore(s => s.staticInfo)
  const setStaticInfo = useStore(s => s.setStaticInfo)
  const jobProfile = useStore(s => s.jobProfile)
  const setJobProfile = useStore(s => s.setJobProfile)
  const eduList = useStore(s => s.eduList)
  const setEduList = useStore(s => s.setEduList)
  const certList = useStore(s => s.certList)
  const setCertList = useStore(s => s.setCertList)
  const expList = useStore(s => s.expList)
  const setExpList = useStore(s => s.setExpList)
  const saveProfile = useStore(s => s.saveProfile)
  const startResumeJob = useStore(s => s.startResumeJob)
  const stopResumeJob = useStore(s => s.stopResumeJob)
  const availableModels = useStore(s => s.availableModels)
  const isResumeRunning = useStore(s => s.isResumeRunning)
  const currentMarkdown = useStore(s => s.currentMarkdown)
  const setCurrentMarkdown = useStore(s => s.setCurrentMarkdown)
  const sseConnected = useStore(s => s.sseConnected)
  const bulkProgress = useStore(s => s.bulkProgress)
  const BACKEND_URL = useStore(s => s.BACKEND_URL)
  const resumeModel = useStore(s => s.resumeModel)
  const setResumeModel = useStore(s => s.setResumeModel)
  const humanize = useStore(s => s.humanize)
  const setHumanize = useStore(s => s.setHumanize)

  const [latexCode, setLatexCode] = useState('');
  const [isLatexModalOpen, setIsLatexModalOpen] = useState(false);
  const [isGeneratingLatex, setIsGeneratingLatex] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [islandLeft, setIslandLeft] = useState<number>(0)
  const cardRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect()
        setIslandLeft(rect.left - 80)
      }
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    const observer = new MutationObserver(updatePosition)
    observer.observe(document.body, { attributes: true, childList: true, subtree: true })
    return () => {
      window.removeEventListener('resize', updatePosition)
      observer.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    if (isEditing && currentMarkdown) {
      const el = document.getElementById('architect-editor') as HTMLTextAreaElement;
      if (el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      }
    }
  }, [isEditing, currentMarkdown]);

  const handleExportPDF = async () => {
    if (!currentMarkdown) return;
    setIsExportingPDF(true);
    const toastId = toast.loading('Architecting PDF...');
    try {
      const resp = await fetch(`${BACKEND_URL}/api/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ markdown: currentMarkdown })
      });
      if (!resp.ok) throw new Error('PDF Export failed');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('PDF Downloaded!', { id: toastId });
    } catch (e) {
      toast.error('PDF synthesis failed', { id: toastId });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleGenerateLatex = async () => {
    if (!currentMarkdown) return;
    setIsGeneratingLatex(true);
    const toastId = toast.loading('Synthesizing LaTeX...', { position: 'top-center' });
    try {
      const { data } = await (await import('axios')).default.post(`${BACKEND_URL}/api/generate-latex`, { markdown: currentMarkdown });
      setLatexCode(data.latex);
      setIsLatexModalOpen(true);
      toast.success('LaTeX Source Ready!', { id: toastId });
    } catch (e) {
      toast.error('LaTeX synthesis failed', { id: toastId });
    } finally {
      setIsGeneratingLatex(false);
    }
  };

  const resumeSidebar = (
    <div className="w-80 h-screen p-4 shrink-0 transition-all duration-500 overflow-hidden bg-bg-color border-r border-border-color/10">
      <div className="flex flex-col h-full bg-bg-color border border-border-color rounded-3xl overflow-hidden shadow-xl relative">
        <div className="h-14 px-6 border-b border-border-color/30 flex items-center justify-between shrink-0 bg-surface-color">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                <Sparkles size={14} className="text-white" />
             </div>
             <div className="flex flex-col">
                <span className="font-black text-xs text-primary leading-none uppercase italic">Architect</span>
                <span className="text-[7px] font-bold text-indigo-400 uppercase tracking-widest">{sseConnected ? 'Engine Online' : 'Connecting...'}</span>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-thin">
          {/* THE SESSION LAYER: Specific to this run */}
          <div className="space-y-3">
            <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-fuchsia-400 flex items-center gap-1.5 px-1">
              <Zap size={10} className="fill-fuchsia-400/20" /> Session Context
            </h3>
            <div className="space-y-2 p-3 bg-bg-color border border-border-color rounded-xl hover:border-fuchsia-500/30 transition-all shadow-sm">
              <input placeholder="Target Role Name (e.g. Senior Backend Engineer)"
                className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary placeholder:text-secondary/30 focus:outline-none focus:border-fuchsia-500/40 transition-colors"
                value={jobProfile.title} onChange={e => setJobProfile({ title: e.target.value })} />
              <textarea placeholder="Paste Job Description for Contextual Tailoring..."
                className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary placeholder:text-secondary/30 focus:outline-none focus:border-fuchsia-500/40 transition-colors h-32 resize-none scrollbar-thin"
                value={jobProfile.description} onChange={e => setJobProfile({ description: e.target.value })} />
              
              <div className="flex items-center justify-between pt-2 border-t border-border-color/20 mt-2">
                <div className="flex flex-col">
                  <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">AI Humanizer</label>
                  <p className="text-[6px] text-secondary/40 uppercase font-bold tracking-widest leading-none">Naturalize tone</p>
                </div>
                <label className="cl-switch">
                  <input 
                    type="checkbox" 
                    checked={humanize} 
                    onChange={e => setHumanize(e.target.checked)} 
                  />
                  <span />
                </label>
              </div>
            </div>
            <p className="text-[7px] font-bold text-secondary/40 uppercase tracking-widest px-1 italic">Context & setting are session-only and never saved.</p>
          </div>

          <div className="h-[1px] bg-border-color/10 mx-2" />

          {/* THE PERMANENT CORE: Profile Identity & Intelligence */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-1.5">
                <Shield size={10} className="fill-indigo-400/20" /> Permanent Profile
              </h3>
              <button 
                onClick={saveProfile} 
                className="text-[8px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                title="Commit changes to database"
              >
                <Save size={10} /> Save Changes
              </button>
            </div>

            <div className="space-y-8">
              {/* Seniority & Synthesis Config */}
              <div className="space-y-3">
                <div className="space-y-3 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl hover:border-indigo-500/30 transition-all shadow-sm">
                  <div className="space-y-1">
                    <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Narrative Seniority</label>
                    <select 
                      className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-indigo-500/40"
                      value={jobProfile.seniority} onChange={e => setJobProfile({ seniority: e.target.value })}
                    >
                      <option value="Fresher">Fresher</option>
                      <option value="Intern">Intern</option>
                      <option value="Junior">Junior</option>
                      <option value="Associate">Associate</option>
                      <option value="Mid">Mid-Level</option>
                      <option value="Senior">Senior</option>
                      <option value="Staff">Staff / Lead</option>
                      <option value="Principal">Principal</option>
                      <option value="Distinguished">Distinguished</option>
                      <option value="Fellow">Fellow</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">LLM Strategy</label>
                    <select 
                      className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-indigo-500/40"
                      value={resumeModel} onChange={e => setResumeModel(e.target.value)}
                    >
                      {availableModels.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Personal Identity */}
              <div className="space-y-3">
                <h4 className="text-[7px] font-black uppercase text-secondary/60 tracking-[0.2em] px-1 flex items-center gap-1">
                  <User size={8} /> Identity & Channels
                </h4>
                <div className="space-y-2 p-3 bg-bg-color border border-border-color rounded-xl hover:border-indigo-500/20 transition-all">
                    <input placeholder="Full Name" 
                      className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-indigo-500/40"
                      value={staticInfo.name} onChange={e => setStaticInfo({ name: e.target.value })} />
                    <input placeholder="Email Address" 
                      className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-indigo-500/40"
                      value={staticInfo.email} onChange={e => setStaticInfo({ email: e.target.value })} />
                    <input placeholder="Links (LinkedIn, Site, etc)" 
                      className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-indigo-500/40"
                      value={staticInfo.links} onChange={e => setStaticInfo({ links: e.target.value })} />
                    <textarea placeholder="Soft Skills (e.g. Strategic Planning, Communication)..." 
                      className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary h-16 resize-none scrollbar-thin focus:outline-none focus:border-indigo-500/40"
                      value={staticInfo.softSkills} onChange={e => setStaticInfo({ softSkills: e.target.value })} />
                </div>
              </div>

              {/* Education */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[7px] font-black uppercase text-secondary/60 tracking-[0.2em] flex items-center gap-1">
                    <GraduationCap size={8} /> Education
                  </h4>
                  <button onClick={() => setEduList([...eduList, { degree: '', institution: '', period: '' }])}
                    className="text-[7px] font-black uppercase text-indigo-400/60 hover:text-indigo-400">+ Add</button>
                </div>
                <div className="space-y-2">
                  {eduList.map((edu: EduEntry, i: number) => (
                    <div key={i} className="relative bg-bg-color border border-border-color rounded-xl p-3 space-y-2 group transition-all hover:border-indigo-500/30">
                      <button onClick={() => setEduList(eduList.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-secondary/20 hover:text-red-400 transition-colors">✕</button>
                      <input placeholder="Degree" className="w-full bg-transparent border-b border-border-color py-0.5 text-[11px] text-primary" value={edu.degree} onChange={e => setEduList(eduList.map((x, j) => j === i ? { ...x, degree: e.target.value } : x))} />
                      <input placeholder="Institution" className="w-full bg-transparent border-b border-border-color py-0.5 text-[11px] text-primary" value={edu.institution} onChange={e => setEduList(eduList.map((x, j) => j === i ? { ...x, institution: e.target.value } : x))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Work History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[7px] font-black uppercase text-secondary/60 tracking-[0.2em] flex items-center gap-1">
                    <Briefcase size={8} /> Experience
                  </h4>
                  <button onClick={() => setExpList([...expList, { role: '', company: '', period: '', description: '' }])}
                    className="text-[7px] font-black uppercase text-indigo-400/60 hover:text-indigo-400">+ Add</button>
                </div>
                <div className="space-y-2">
                  {expList.map((exp: ExpEntry, i: number) => (
                    <div key={i} className="relative bg-bg-color border border-border-color rounded-xl p-3 space-y-2 group transition-all hover:border-indigo-500/30">
                      <button onClick={() => setExpList(expList.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-secondary/20 hover:text-red-400 transition-colors">✕</button>
                      <input placeholder="Role" className="w-full bg-transparent border-b border-border-color py-0.5 text-[11px] text-primary" value={exp.role} onChange={e => setExpList(expList.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} />
                      <input placeholder="Company & Period" className="w-full bg-transparent border-b border-border-color py-0.5 text-[11px] text-primary" value={exp.company} onChange={e => setExpList(expList.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} />
                      <textarea placeholder="What did you do there? (Projects, results, etc.)" className="w-full bg-transparent py-1 text-[10px] text-primary placeholder:text-secondary/30 h-16 resize-none scrollbar-thin outline-none" value={exp.description} onChange={e => setExpList(expList.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[7px] font-black uppercase text-secondary/60 tracking-[0.2em] flex items-center gap-1">
                    <Award size={8} /> Certifications
                  </h4>
                  <button onClick={() => setCertList([...certList, { name: '', issuer: '', date: '' }])}
                    className="text-[7px] font-black uppercase text-indigo-400/60 hover:text-indigo-400">+ Add</button>
                </div>
                <div className="space-y-2 pb-10">
                  {certList.map((cert: CertEntry, i: number) => (
                    <div key={i} className="relative bg-bg-color border border-border-color rounded-xl p-3 space-y-2 group transition-all hover:border-indigo-500/30">
                      <button onClick={() => setCertList(certList.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-secondary/20 hover:text-red-400 transition-colors">✕</button>
                      <input placeholder="Name & Issuer" className="w-full bg-transparent border-b border-border-color py-0.5 text-[11px] text-primary" value={cert.name} onChange={e => setCertList(certList.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-bg-color border-t border-border-color shrink-0">
          <button onClick={() => startResumeJob('resume')} disabled={isResumeRunning}
            className="w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/10"
          >
            {isResumeRunning ? <><Loader2 className="h-4 w-4 animate-spin" /> Working...</> : <><Send className="h-4 w-4" /> Synthesize Resume</>}
          </button>
        </div>
      </div>
    </div>
  );

  const emptyState = (
    <div className="h-full flex-1 flex flex-col items-center justify-center text-center space-y-6 pt-20 pb-40">
       <div className="relative flex justify-center">
          {isResumeRunning ? (
            <ScaleLoader color="#6366f1" height={24} width={3} radius={2} margin={2} />
          ) : (
            <div className="p-8 bg-indigo-500/5 rounded-full">
              <FileText size={50} className="text-indigo-500/10" />
            </div>
          )}
       </div>
       <div className="space-y-1">
          <p className="text-lg font-black text-[#09090b] tracking-tight uppercase italic drop-shadow-sm transition-colors">
             {isResumeRunning ? (PHASES_MAP[bulkProgress.phase] || 'Synthesizing Narrative...') : 'Structural Genesis'}
          </p>
          {!isResumeRunning && <p className="text-[8px] font-bold text-[#3f3f46]/50 uppercase tracking-[0.3em]">Define identity to build narrative.</p>}
          <div className="flex items-center justify-center gap-2 pt-2">
             <div className={cn("h-1 w-1 rounded-full", sseConnected ? "bg-emerald-500" : "bg-red-400 animate-pulse")} />
             <span className="text-[8px] font-bold uppercase tracking-widest text-[#3f3f46]/60">{sseConnected ? 'Engine Sync Active' : 'Offline'}</span>
          </div>
          {isResumeRunning && (
            <div className="space-y-4">
              <div className="h-1 w-40 bg-indigo-500/10 rounded-full overflow-hidden mx-auto mt-4">
                <motion.div className="h-full bg-indigo-500" initial={{ width: 0 }} animate={{ width: `${Math.min((bulkProgress.current / (bulkProgress.total || 8)) * 100, 100)}%` }} />
              </div>
              <button 
                onClick={() => stopResumeJob('resume')}
                className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors flex items-center gap-1 mx-auto"
              >
                ✕ Stop Synthesis
              </button>
            </div>
          )}
       </div>
    </div>
  );

  return (
    <>
      {resumeSidebar}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-color">
        <PageHeader />
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8 scrollbar-thin">
          <div ref={cardRef} className="max-w-4xl mx-auto min-h-full flex flex-col relative group pt-8">
             {/* THE TACTICAL ISLAND - Synced to card horizontally, Fixed vertically */}
             {isEditing && (
               <div 
                 className="fixed z-40 hidden xl:block"
                 style={{ left: islandLeft, top: '50%', transform: 'translateY(-50%)' }}
               >
                  <div className="flex flex-col gap-2 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/10 dark:shadow-black/40 rounded-2xl">
                    {[
                      { icon: <Bold size={14} />, syntax: '****', offset: 2, title: 'Bold' },
                      { icon: <Italic size={14} />, syntax: '**', offset: 1, title: 'Italic' },
                      { icon: <Heading1 size={14} />, syntax: '# ', offset: 2, title: 'H1' },
                      { icon: <Heading2 size={14} />, syntax: '## ', offset: 3, title: 'H2' },
                      { icon: <Heading3 size={14} />, syntax: '### ', offset: 4, title: 'H3' },
                      { icon: <List size={14} />, syntax: '- ', offset: 2, title: 'List' },
                      { icon: <ListOrdered size={14} />, syntax: '1. ', offset: 3, title: 'Ordered List' },
                      { icon: <Link2 size={14} />, syntax: '[]()', offset: 1, title: 'Link (Title)' },
                      { icon: <SeparatorHorizontal size={14} />, syntax: '\n---\n', offset: 5, title: 'Horizontal Rule' },
                      { icon: <Table size={14} />, syntax: '\n| Col 1 | Col 2 |\n|-------|-------|\n| Val 1 | Val 2 |\n', offset: 47, title: 'Table' },
                    ].map((btn, idx) => (
                      <button
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const el = document.getElementById('architect-editor') as HTMLTextAreaElement;
                          if (!el) return;
                          const start = el.selectionStart;
                          const end = el.selectionEnd;
                          const text = el.value;
                          const before = text.substring(0, start);
                          const after = text.substring(end);
                          const mid = text.substring(start, end) || (btn.title === 'Table' ? "" : "text");
                          const newText = before + btn.syntax.substring(0, btn.offset) + mid + btn.syntax.substring(btn.offset) + after;
                          setCurrentMarkdown(newText);
                          
                          // Sync height immediately after content change
                          requestAnimationFrame(() => {
                            // Only grow height to match new content; do NOT collapse first
                            if (parseInt(el.style.height) < el.scrollHeight) {
                              el.style.height = el.scrollHeight + 'px';
                            }
                            el.setSelectionRange(start + btn.offset, start + btn.offset + mid.length);
                          });
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/30 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
                        title={btn.title}
                      >
                        {btn.icon}
                      </button>
                    ))}
                  </div>
               </div>
             )}

             {/* Action Layer - Sticky above the card content area */}
             <div className="sticky top-8 z-30 pointer-events-none self-end mr-6 mb-[-3.5rem]">
                <div className="flex gap-2 pointer-events-auto">
                      <button onClick={() => setIsEditing(!isEditing)} className={`p-3 border border-border-color rounded-xl shadow-lg transition-all hover:scale-110 active:scale-90 ${isEditing ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-500'}`} title={isEditing ? "Save & Preview" : "Edit Markdown"}>
                         <Edit3 size={16} />
                      </button>
                      <button onClick={handleGenerateLatex} disabled={isGeneratingLatex} className="p-3 bg-white border border-border-color rounded-xl text-slate-600 hover:text-orange-400 shadow-lg transition-all hover:scale-110 active:scale-90" title="LaTeX Code">
                         {isGeneratingLatex ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                      </button>
                      <button onClick={handleExportPDF} disabled={isExportingPDF} className="p-3 bg-indigo-600 border border-indigo-500 rounded-xl text-white shadow-lg transition-all hover:scale-110 active:scale-90" title="PDF Download">
                         {isExportingPDF ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                      </button>
                </div>
             </div>

             <div className="bg-white border border-border-color rounded-[1.5rem] p-6 md:p-14 shadow-2xl shadow-black/5 min-h-screen w-full transition-all duration-500 text-slate-900 selection:bg-indigo-100 mb-20">
                <div className="transition-all duration-500 relative z-10 text-slate-900">
                  {currentMarkdown ? (
                    isEditing ? (
                      <textarea 
                        id="architect-editor"
                        className="w-full bg-transparent outline-none resize-none font-mono text-sm p-0 scrollbar-none text-slate-900 placeholder:text-slate-300 min-h-[500px] overflow-hidden leading-relaxed"
                        value={currentMarkdown}
                        onChange={(e) => {
                           setCurrentMarkdown(e.target.value);
                           // Instant growth without collapse
                           if (e.target.style.height !== e.target.scrollHeight + 'px') {
                             e.target.style.height = e.target.scrollHeight + 'px';
                           }
                        }}
                        onFocus={(e) => {
                           // Ensure initial height is correct without collapse
                           if (e.target.style.height !== e.target.scrollHeight + 'px') {
                             e.target.style.height = e.target.scrollHeight + 'px';
                           }
                        }}
                        placeholder="Edit your resume content here..."
                      />
                    ) : (
                      <div className="prose prose-sm md:prose-base max-w-none text-slate-900 prose-headings:text-slate-900 prose-p:text-slate-900 prose-li:text-slate-900 prose-strong:text-slate-900 prose-headings:font-black">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentMarkdown}</ReactMarkdown>
                      </div>
                    )
                  ) : emptyState}
                </div>
             </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isLatexModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-3xl h-[80vh] bg-surface-color border border-border-color rounded-[3rem] flex flex-col overflow-hidden shadow-2xl">
               <div className="h-14 px-10 border-b border-border-color flex items-center justify-between shrink-0 bg-bg-color/50">
                  <div className="flex items-center gap-3">
                    <Zap size={18} className="text-orange-500" />
                    <h3 className="text-base font-black text-primary tracking-tight uppercase italic">LaTeX Rendering</h3>
                  </div>
                  <button onClick={() => setIsLatexModalOpen(false)} className="p-2 text-secondary hover:text-red-400 transition-all font-bold">✕</button>
               </div>
               <textarea readOnly className="flex-1 bg-bg-color/30 p-10 font-mono text-[10px] text-secondary outline-none resize-none scrollbar-thin" value={latexCode} />
               <div className="p-8 border-t border-border-color bg-bg-color/50">
                  <button onClick={() => { navigator.clipboard.writeText(latexCode); toast.success('Copied!'); }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all active:scale-[0.98]">Copy Source Code</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

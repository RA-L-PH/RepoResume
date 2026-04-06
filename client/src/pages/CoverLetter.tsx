import { useState, useRef, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { ScaleLoader } from 'react-spinners'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { 
  FileText, User, 
  Zap, Loader2, Send, Shield, Save, Edit3, 
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Link2, SeparatorHorizontal, Table, Mail
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { cn } from '../utils/cn'
import { toast } from 'react-hot-toast'
import { useStore } from '../store'

const PHASES_MAP: Record<string, string> = {
  'ANALYZING_TARGET': 'Dissecting Job Description...',
  'DRAFTING_HOOK': 'Crafting Compelling Opening...',
  'GROUNDING_EVIDENCE': 'Mapping Repository Success...',
  'DRAFTING_BODY': 'Synthesizing Professional Narrative...',
  'FINALIZING': 'Final Formatting & Polish...',
  'idle': 'Engine Warming Up...'
};

export function CoverLetter() {
  const staticInfo = useStore(s => s.staticInfo)
  const setStaticInfo = useStore(s => s.setStaticInfo)
  const jobProfile = useStore(s => s.jobProfile)
  const setJobProfile = useStore(s => s.setJobProfile)
  const saveProfile = useStore(s => s.saveProfile)
  const startCoverLetterJob = useStore(s => s.startCoverLetterJob)
  const stopResumeJob = useStore(s => s.stopResumeJob)
  const availableModels = useStore(s => s.availableModels)
  const isCoverLetterRunning = useStore(s => s.isCoverLetterRunning)
  const currentCoverLetter = useStore(s => s.currentCoverLetter)
  const setCurrentCoverLetter = useStore(s => s.setCurrentCoverLetter)
  const sseConnected = useStore(s => s.sseConnected)
  const bulkProgress = useStore(s => s.bulkProgress)
  const BACKEND_URL = useStore(s => s.BACKEND_URL)
  const resumeModel = useStore(s => s.resumeModel)
  const setResumeModel = useStore(s => s.setResumeModel)
  const humanize = useStore(s => s.humanize)
  const setHumanize = useStore(s => s.setHumanize)

  const [isResearching, setIsResearching] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [islandLeft, setIslandLeft] = useState<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setIslandLeft(rect.left - 80);
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    const observer = new MutationObserver(updatePosition);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', updatePosition);
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (isEditing && currentCoverLetter) {
      const el = document.getElementById('narrative-editor') as HTMLTextAreaElement;
      if (el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      }
    }
  }, [isEditing, currentCoverLetter]);

  const handleResearchLinks = async () => {
    if (!jobProfile.researchContext) {
      toast.error("Paste a link first!");
      return;
    }
    setIsResearching(true);
    const toastId = toast.loading('Executing Autonomous Research...');
    try {
      const response = await fetch(`${BACKEND_URL}/api/research-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ researchContext: jobProfile.researchContext, resumeModel })
      });
      if (!response.ok) throw new Error('Research failed');
      const { summary } = await response.json();
      setJobProfile({ researchContext: summary });
      toast.success('Venture Intelligence Synchronized!', { id: toastId });
    } catch (e) {
      toast.error('Intelligence gathering failed', { id: toastId });
    } finally {
      setIsResearching(false);
    }
  };

  const handleExportPDF = async () => {
    if (!currentCoverLetter) return;
    setIsExportingPDF(true);
    const toastId = toast.loading('Architecting PDF...');
    try {
      const resp = await fetch(`${BACKEND_URL}/api/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ markdown: currentCoverLetter })
      });
      if (!resp.ok) throw new Error('PDF Export failed');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cover_letter.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Cover Letter Downloaded!', { id: toastId });
    } catch (e) {
      toast.error('PDF synthesis failed', { id: toastId });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const coverLetterSidebar = (
    <div className="w-80 h-screen p-4 shrink-0 transition-all duration-500 overflow-hidden bg-bg-color border-r border-border-color/10">
      <div className="flex flex-col h-full bg-bg-color border border-border-color rounded-3xl overflow-hidden shadow-xl relative">
        <div className="h-14 px-6 border-b border-border-color/30 flex items-center justify-between shrink-0 bg-surface-color">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                <Mail size={14} className="text-white" />
             </div>
             <div className="flex flex-col">
                <span className="font-black text-xs text-primary leading-none uppercase italic">Narrative</span>
                <span className="text-[7px] font-bold text-indigo-400 uppercase tracking-widest">{sseConnected ? 'Engine Online' : 'Connecting...'}</span>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-thin">
          <div className="space-y-3">
            <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-fuchsia-400 flex items-center gap-1.5 px-1">
              <Zap size={10} className="fill-fuchsia-400/20" /> Submission Context
            </h3>
            <div className="space-y-3 p-3 bg-bg-color border border-border-color rounded-xl hover:border-fuchsia-500/30 transition-all shadow-sm">
              <div className="space-y-1">
                <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Venture / Company</label>
                <input placeholder="Organization Name ..."
                  className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-fuchsia-500/40"
                  value={jobProfile.companyName} onChange={e => setJobProfile({ companyName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Whom to Address</label>
                <input placeholder="Hiring Lead or Team Head Name..."
                  className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-fuchsia-500/40"
                  value={jobProfile.hiringManager} onChange={e => setJobProfile({ hiringManager: e.target.value })} />
              </div>
              <div className="space-y-1 pt-1">
                <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">The Role</label>
                <input placeholder="Target Role Name (e.g. Senior Backend Engineer)"
                  className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-fuchsia-500/40"
                  value={jobProfile.title} onChange={e => setJobProfile({ title: e.target.value })} />
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Venture Intelligence (News/Link)</label>
                  <button 
                    onClick={handleResearchLinks} 
                    disabled={isResearching}
                    className="p-1.5 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg text-fuchsia-400 hover:bg-fuchsia-500/20 disabled:opacity-30 transition-all flex items-center justify-center"
                    title="Autonomous Research (Scrape Links)"
                  >
                    {isResearching ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                  </button>
                </div>
                <textarea placeholder="Paste links (LinkedIn, Blogs, News) or raw company context here..."
                  className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary h-16 resize-none focus:outline-none focus:border-fuchsia-500/40 scrollbar-thin"
                  value={jobProfile.researchContext} onChange={e => setJobProfile({ researchContext: e.target.value })} />
                <p className="text-[6px] text-secondary/40 font-bold uppercase tracking-widest leading-none">Scrapes links & summarizes into momentum-context</p>
              </div>
              <div className="space-y-1 pt-1">
                <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Opportunity Context (JD)</label>
                <textarea placeholder="Paste Job Description for Mirroring..."
                  className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary h-32 resize-none focus:outline-none focus:border-fuchsia-500/40 scrollbar-thin"
                  value={jobProfile.description} onChange={e => setJobProfile({ description: e.target.value })} />
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-border-color/20 mt-2">
                <div className="flex flex-col">
                  <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">AI Humanizer</label>
                  <p className="text-[6px] text-secondary/40 uppercase font-bold tracking-widest leading-none">Narrative tone</p>
                </div>
                <label className="cl-switch">
                  <input type="checkbox" checked={humanize} onChange={e => setHumanize(e.target.checked)} />
                  <span />
                </label>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-border-color/10 mx-2" />

          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-1.5">
                <Shield size={10} className="fill-indigo-400/20" /> Global Persona
              </h3>
              <button 
                onClick={saveProfile} 
                className="text-[8px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                <Save size={10} /> Sync Profile
              </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">
                  <div className="space-y-1">
                    <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Seniority</label>
                    <select className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-indigo-500/40"
                      value={jobProfile.seniority} onChange={e => setJobProfile({ seniority: e.target.value })}>
                       <option value="Junior">Junior</option>
                       <option value="Associate">Associate</option>
                       <option value="Mid">Mid-Level</option>
                       <option value="Senior">Senior</option>
                       <option value="Staff">Staff / Lead</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Model</label>
                    <select className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-indigo-500/40"
                      value={resumeModel} onChange={e => setResumeModel(e.target.value)}>
                       {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[7px] font-black uppercase text-secondary/60 tracking-[0.2em] px-1 flex items-center gap-1">
                  <User size={8} /> Basic Info
                </h4>
                <div className="space-y-2 p-3 bg-bg-color border border-border-color rounded-xl">
                    <input placeholder="Name" className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none" value={staticInfo.name} onChange={e => setStaticInfo({ name: e.target.value })} />
                    <input placeholder="Email" className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none" value={staticInfo.email} onChange={e => setStaticInfo({ email: e.target.value })} />
                    <textarea placeholder="Soft Skills..." className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary h-16 resize-none focus:outline-none" value={staticInfo.softSkills} onChange={e => setStaticInfo({ softSkills: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-bg-color border-t border-border-color shrink-0">
          <button onClick={startCoverLetterJob} disabled={isCoverLetterRunning}
            className="w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-3 shadow-xl"
          >
            {isCoverLetterRunning ? <><Loader2 className="h-4 w-4 animate-spin" /> Engraving...</> : <><Send className="h-4 w-4" /> Generate Letter</>}
          </button>
        </div>
      </div>
    </div>
  );

  const emptyState = (
    <div className="h-full flex-1 flex flex-col items-center justify-center text-center space-y-6 pt-20 pb-40">
       <div className="relative flex justify-center">
          {isCoverLetterRunning ? (
            <ScaleLoader color="#6366f1" height={24} width={3} radius={2} margin={2} />
          ) : (
            <div className="p-8 bg-indigo-500/5 rounded-full">
              <Mail size={50} className="text-indigo-500/10" />
            </div>
          )}
       </div>
       <div className="space-y-1">
          <p className="text-lg font-black text-[#09090b] tracking-tight uppercase italic transition-colors">
             {isCoverLetterRunning ? (PHASES_MAP[bulkProgress.phase] || 'Engraved Narrative...') : 'Epistolary Genesis'}
          </p>
          {!isCoverLetterRunning && <p className="text-[8px] font-bold text-[#3f3f46]/50 uppercase tracking-[0.3em]">Craft a custom letter grounded in your code.</p>}
          <div className="flex items-center justify-center gap-2 pt-2">
             <div className={cn("h-1 w-1 rounded-full", sseConnected ? "bg-emerald-500" : "bg-red-400 animate-pulse")} />
             <span className="text-[8px] font-bold uppercase tracking-widest text-[#3f3f46]/60">{sseConnected ? 'Engine Sync Active' : 'Offline'}</span>
          </div>
          {isCoverLetterRunning && (
            <div className="space-y-4">
              <div className="h-1 w-40 bg-indigo-500/10 rounded-full overflow-hidden mx-auto mt-4">
                <motion.div className="h-full bg-indigo-500" initial={{ width: 0 }} animate={{ width: `${Math.min((bulkProgress.current / (bulkProgress.total || 8)) * 100, 100)}%` }} />
              </div>
              <button onClick={() => stopResumeJob()} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors flex items-center gap-1 mx-auto">✕ Terminate Engine</button>
            </div>
          )}
       </div>
    </div>
  );

  return (
    <>
      {coverLetterSidebar}
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
                  <div className="flex flex-col gap-2 p-2 bg-white dark:bg-slate-900 backdrop-blur-3xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/10 dark:shadow-black/40 rounded-2xl">
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
                          const el = document.getElementById('narrative-editor') as HTMLTextAreaElement;
                          if (!el) return;
                          const start = el.selectionStart;
                          const end = el.selectionEnd;
                          const text = el.value;
                          const before = text.substring(0, start);
                          const after = text.substring(end);
                          const mid = text.substring(start, end) || (btn.title === 'Table' ? "" : "text");
                          const newText = before + btn.syntax.substring(0, btn.offset) + mid + btn.syntax.substring(btn.offset) + after;
                          setCurrentCoverLetter(newText);
                          
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
                      <button onClick={handleExportPDF} disabled={isExportingPDF} className="p-3 bg-indigo-600 border border-indigo-500 rounded-xl text-white shadow-lg transition-all hover:scale-110 active:scale-90" title="PDF Download">
                         {isExportingPDF ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                      </button>
                </div>
             </div>

             <div className="bg-white border border-border-color rounded-[1.5rem] p-6 md:p-14 shadow-2xl shadow-black/5 min-h-screen w-full transition-all duration-500 text-slate-900 selection:bg-indigo-100 mb-20">
                <div className="transition-all duration-500 relative z-10 text-slate-900">
                  {currentCoverLetter ? (
                    isEditing ? (
                      <textarea 
                        id="narrative-editor"
                        className="w-full bg-transparent outline-none resize-none font-mono text-sm p-0 scrollbar-none text-slate-900 placeholder:text-slate-300 min-h-[500px] overflow-hidden leading-relaxed"
                        value={currentCoverLetter}
                        onChange={(e) => {
                           setCurrentCoverLetter(e.target.value);
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
                        placeholder="Refine your professional narrative here..."
                      />
                    ) : (
                      <div className="prose prose-sm md:prose-base max-w-none text-slate-900 prose-headings:text-slate-900 prose-p:text-slate-900 prose-li:text-slate-900 prose-strong:text-slate-900 prose-headings:font-black">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentCoverLetter}</ReactMarkdown>
                      </div>
                    )
                  ) : emptyState}
               </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

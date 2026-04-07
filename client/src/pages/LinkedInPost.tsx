import { useState, useRef, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { ScaleLoader } from 'react-spinners'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { 
  User, 
  Zap, Loader2, Send, Shield, Edit3, 
  Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Link2, SeparatorHorizontal, Table, Share2, Linkedin,
  Search, RefreshCw, Check
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { cn } from '../utils/cn'
import { toast } from 'react-hot-toast'
import { useStore } from '../store'

const PHASES_MAP: Record<string, string> = {
  'IDENTIFYING_HOOKS': 'Analyzing Repositories for Engagement...',
  'DRAFTING_POST': 'Architecting Viral Narrative...',
  'FINALIZING': 'Polishing Content...',
  'idle': 'Engine Warming Up...'
};

export function LinkedInPost() {
  const staticInfo = useStore(s => s.staticInfo)
  const setStaticInfo = useStore(s => s.setStaticInfo)
  const jobProfile = useStore(s => s.jobProfile)
  const setJobProfile = useStore(s => s.setJobProfile)
  const startLinkedInPostJob = useStore(s => s.startLinkedInPostJob)
  const stopResumeJob = useStore(s => s.stopResumeJob)
  const availableModels = useStore(s => s.availableModels)
  const isLinkedInRunning = useStore(s => s.isLinkedInRunning)
  const currentLinkedInPost = useStore(s => s.currentLinkedInPost)
  const setCurrentLinkedInPost = useStore(s => s.setCurrentLinkedInPost)
  const sseConnected = useStore(s => s.sseConnected)
  const bulkProgress = useStore(s => s.bulkProgress)
  const resumeModel = useStore(s => s.resumeModel)
  const setResumeModel = useStore(s => s.setResumeModel)
  const humanize = useStore(s => s.humanize)
  const setHumanize = useStore(s => s.setHumanize)

  const repos = useStore(s => s.repos)
  const selectedRepoIds = useStore(s => s.selectedRepoIds)
  const toggleRepoSelection = useStore(s => s.toggleRepoSelection)
  const setSelectedRepoIds = useStore(s => s.setSelectedRepoIds)
  const fetchRepos = useStore(s => s.fetchRepos)
  const search = useStore(s => s.search)
  const setSearch = useStore(s => s.setSearch)

  const [isEditing, setIsEditing] = useState(false);
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
    if (isEditing && currentLinkedInPost) {
      const el = document.getElementById('narrative-editor') as HTMLTextAreaElement;
      if (el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      }
    }
  }, [isEditing, currentLinkedInPost]);

  const handleCopyToClipboard = () => {
    if (!currentLinkedInPost) return;
    navigator.clipboard.writeText(currentLinkedInPost);
    toast.success('Post copied to clipboard!');
  };

  const linkedinSidebar = (
    <div className="w-80 h-screen p-4 shrink-0 transition-all duration-500 overflow-hidden bg-bg-color border-r border-border-color/10">
      <div className="flex flex-col h-full bg-bg-color border border-border-color rounded-3xl overflow-hidden shadow-xl relative">
        <div className="h-14 px-6 border-b border-border-color/30 flex items-center justify-between shrink-0 bg-surface-color">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
                <Linkedin size={14} className="text-white" />
             </div>
             <div className="flex flex-col">
                <span className="font-black text-xs text-primary leading-none uppercase italic">Social Engr</span>
                <span className="text-[7px] font-bold text-blue-400 uppercase tracking-widest">{sseConnected ? 'Engine Online' : 'Connecting...'}</span>
             </div>
          </div>
          <button onClick={() => fetchRepos(true)} className="p-2 hover:bg-bg-color rounded-lg text-blue-400 hover:text-blue-500 transition-all active:rotate-180 duration-500">
             <RefreshCw size={14} /> 
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          <div className="space-y-3">
            <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-1.5 px-1">
              <Zap size={10} className="fill-blue-400/20" /> Repositories
            </h3>
            <div className="space-y-3">
               <div className="relative">
                 <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-blue-400" />
                 <input 
                   placeholder="Search repositories..." value={search} onChange={e => setSearch(e.target.value)}
                   className="w-full bg-bg-color border border-border-color rounded-xl pl-9 pr-3 py-1.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-500 transition-all text-primary"
                 />
               </div>
               <div className="flex gap-2">
                 <button onClick={() => setSelectedRepoIds(new Set(repos.map((r: any) => r.id)))} className="flex-1 py-1 text-[7px] bg-bg-color border border-border-color/40 rounded-lg font-black uppercase tracking-widest text-secondary hover:text-primary transition-all">All</button>
                 <button onClick={() => setSelectedRepoIds(new Set())} className="flex-1 py-1 text-[7px] bg-bg-color border border-border-color/40 rounded-lg font-black uppercase tracking-widest text-secondary hover:text-primary transition-all">None</button>
               </div>
               <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1 pr-1">
                  {repos.filter((r: any) => r.name.toLowerCase().includes(search.toLowerCase())).map((repo: any) => {
                    const isSelected = selectedRepoIds.has(repo.id);
                    return (
                      <button 
                        key={repo.id} 
                        onClick={() => toggleRepoSelection(repo.id)}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-lg transition-all duration-300 group border text-left",
                          isSelected 
                            ? "bg-blue-600/10 border-blue-500/30 shadow-sm" 
                            : "bg-bg-color/50 border-border-color/30 hover:border-blue-500/20"
                        )}
                      >
                         <div className={cn(
                           "h-3 w-3 rounded border flex items-center justify-center transition-all shrink-0",
                           isSelected ? "bg-blue-500 border-blue-500" : "border-border-color bg-bg-color group-hover:border-blue-500/50"
                         )}>
                            {isSelected && <Check size={8} className="text-white fill-white" />}
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                               <div className={cn("font-bold text-[10px] truncate transition-colors", isSelected ? "text-primary" : "text-primary/60 group-hover:text-primary")}>
                                 {repo.name}
                               </div>
                               <span className={cn(
                                 "text-[6px] px-1 rounded font-black uppercase tracking-widest",
                                 repo.private ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                               )}>
                                 {repo.private ? 'Private' : 'Public'}
                               </span>
                            </div>
                         </div>
                      </button>
                    );
                  })}
               </div>
            </div>
          </div>

          <div className="h-[1px] bg-border-color/10 mx-2" />

          <div className="space-y-3">
            <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-400 flex items-center gap-1.5 px-1">
              <Zap size={10} className="fill-blue-400/20" /> Engagement Context
            </h3>
            <div className="space-y-3 p-3 bg-bg-color border border-border-color rounded-xl hover:border-blue-500/30 transition-all shadow-sm">
              <div className="space-y-1">
                <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Your Current Role</label>
                <input placeholder="e.g. Full Stack Developer"
                  className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none focus:border-blue-500/40"
                  value={jobProfile.title} onChange={e => setJobProfile({ title: e.target.value })} />
              </div>
              <div className="space-y-1 pt-1">
                <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Vibe / Persona</label>
                <div className="flex items-center justify-between p-2 bg-bg-color border border-border-color rounded-lg">
                   <span className="text-[9px] font-bold text-primary uppercase tracking-tight">{humanize ? 'Personal & Inspiring' : 'Professional & Technical'}</span>
                   <label className="cl-switch">
                      <input type="checkbox" checked={humanize} onChange={e => setHumanize(e.target.checked)} />
                      <span />
                   </label>
                </div>
              </div>
              <div className="space-y-1 pt-1">
                <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Target Audience</label>
                <textarea placeholder="e.g. Recruiters, EM, Fellow Devs..."
                  className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary h-12 resize-none focus:outline-none focus:border-blue-500/40 scrollbar-thin"
                  value={jobProfile.description} onChange={e => setJobProfile({ description: e.target.value })} />
              </div>
            </div>
          </div>


          <div className="h-[1px] bg-border-color/10 mx-2" />

          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-1.5">
                <Shield size={10} className="fill-indigo-400/20" /> Engine Config
              </h3>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">
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
                  <User size={8} /> Signature
                </h4>
                <div className="space-y-2 p-3 bg-bg-color border border-border-color rounded-xl">
                    <input placeholder="Name" className="w-full bg-transparent border-b border-border-color py-1 text-[11px] text-primary focus:outline-none" value={staticInfo.name} onChange={e => setStaticInfo({ name: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-bg-color border-t border-border-color shrink-0">
          <button onClick={startLinkedInPostJob} disabled={isLinkedInRunning || selectedRepoIds.size === 0}
            className="w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-3 shadow-xl shadow-blue-600/10"
          >
            {isLinkedInRunning ? <><Loader2 className="h-4 w-4 animate-spin" /> Drafting...</> : <><Send className="h-4 w-4" /> Generate LinkedIn Post</>}
          </button>
        </div>
      </div>
    </div>
  );

  const emptyState = (
    <div className="h-full flex-1 flex flex-col items-center justify-center text-center space-y-6 pt-20 pb-40">
       <div className="relative flex justify-center">
          {isLinkedInRunning ? (
            <ScaleLoader color="#2563eb" height={24} width={3} radius={2} margin={2} />
          ) : (
            <div className="p-8 bg-blue-500/5 rounded-full">
              <Linkedin size={50} className="text-blue-500/10" />
            </div>
          )}
       </div>
       <div className="space-y-1">
          <p className="text-lg font-black text-[#09090b] tracking-tight uppercase italic transition-colors">
             {isLinkedInRunning ? (PHASES_MAP[bulkProgress.phase] || 'Engaging Network...') : 'Viral Synthesis'}
          </p>
          {!isLinkedInRunning && <p className="text-[8px] font-bold text-[#3f3f46]/50 uppercase tracking-[0.3em]">Convert your code into a high-engagement LinkedIn post.</p>}
          <div className="flex items-center justify-center gap-2 pt-2">
             <div className={cn("h-1 w-1 rounded-full", sseConnected ? "bg-emerald-500" : "bg-red-400 animate-pulse")} />
             <span className="text-[8px] font-bold uppercase tracking-widest text-[#3f3f46]/60">{sseConnected ? 'Engine Sync Active' : 'Offline'}</span>
          </div>
          {isLinkedInRunning && (
            <div className="space-y-4">
              <div className="h-1 w-40 bg-blue-500/10 rounded-full overflow-hidden mx-auto mt-4">
                <motion.div className="h-full bg-blue-600" initial={{ width: 0 }} animate={{ width: `${Math.min((bulkProgress.current / (bulkProgress.total || 8)) * 100, 100)}%` }} />
              </div>
              <button onClick={() => stopResumeJob()} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors flex items-center gap-1 mx-auto">✕ Terminate Engine</button>
            </div>
          )}
       </div>
    </div>
  );

  return (
    <>
      {linkedinSidebar}
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
                          setCurrentLinkedInPost(newText);
                          
                          requestAnimationFrame(() => {
                            if (parseInt(el.style.height) < el.scrollHeight) {
                              el.style.height = el.scrollHeight + 'px';
                            }
                            el.setSelectionRange(start + btn.offset, start + btn.offset + mid.length);
                          });
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm"
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
                      <button onClick={() => setIsEditing(!isEditing)} className={`p-3 border border-border-color rounded-xl shadow-lg transition-all hover:scale-110 active:scale-90 ${isEditing ? 'bg-blue-600 text-white border-blue-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-500'}`} title={isEditing ? "Save & Preview" : "Edit Markdown"}>
                         <Edit3 size={16} />
                      </button>
                      <button onClick={handleCopyToClipboard} className="p-3 bg-blue-600 border border-blue-500 rounded-xl text-white shadow-lg transition-all hover:scale-110 active:scale-90" title="Copy to Clipboard">
                         <Share2 size={16} />
                      </button>
                </div>
             </div>

             <div className="bg-white border border-border-color rounded-[1.5rem] p-6 md:p-14 shadow-2xl shadow-black/5 min-h-[600px] w-full transition-all duration-500 text-slate-900 selection:bg-blue-100 mb-20">
                <div className="transition-all duration-500 relative z-10 text-slate-900">
                  {currentLinkedInPost ? (
                    isEditing ? (
                      <textarea 
                        id="narrative-editor"
                        className="w-full bg-transparent outline-none resize-none font-mono text-sm p-0 scrollbar-none text-slate-900 placeholder:text-slate-300 min-h-[500px] overflow-hidden leading-relaxed"
                        value={currentLinkedInPost}
                        onChange={(e) => {
                           setCurrentLinkedInPost(e.target.value);
                           if (e.target.style.height !== e.target.scrollHeight + 'px') {
                             e.target.style.height = e.target.scrollHeight + 'px';
                           }
                        }}
                        onFocus={(e) => {
                           if (e.target.style.height !== e.target.scrollHeight + 'px') {
                             e.target.style.height = e.target.scrollHeight + 'px';
                           }
                        }}
                        placeholder="Refine your LinkedIn post here..."
                      />
                    ) : (
                      <div className="prose prose-sm md:prose-base max-w-none text-slate-900 prose-headings:text-slate-900 prose-p:text-slate-900 prose-li:text-slate-900 prose-strong:text-slate-900 prose-headings:font-black">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentLinkedInPost}</ReactMarkdown>
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

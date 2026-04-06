import { motion } from 'framer-motion'
import { ScaleLoader } from 'react-spinners'
import { FileText, RefreshCw, Search, Loader2, Terminal, Copy, Layout as LayoutIcon, Check } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { cn } from '../utils/cn'
import { toast } from 'react-hot-toast'
import { useStore } from '../store'

const PHASES_MAP: any = {
  'UNDERSTANDING_REPOS': 'Analyzing Repo Architecture...',
  'SUMMARIZING_CONTENT': 'Synthesizing Tech Data...',
  'REFRAMING_CONTENT': 'Reframing Technical Identity...',
  'CONSOLIDATING': 'Optimizing Skill Matrix...',
  'idle': 'Initializing Engine...'
};

export function Explorer() {
  const repos = useStore(s => s.repos)
  const selectedRepoIds = useStore(s => s.selectedRepoIds)
  const toggleRepoSelection = useStore(s => s.toggleRepoSelection)
  const isIntelligenceRunning = useStore(s => s.isIntelligenceRunning)
  const intelligenceResults = useStore(s => s.intelligenceResults)
  const bulkProgress = useStore(s => s.bulkProgress)
  const fetchRepos = useStore(s => s.fetchRepos)
  const startResumeJob = useStore(s => s.startResumeJob)
  const search = useStore(s => s.search)
  const setSearch = useStore(s => s.setSearch)
  const setSelectedRepoIds = useStore(s => s.setSelectedRepoIds)
  const intelModel = useStore(s => s.intelModel)
  const setIntelModel = useStore(s => s.setIntelModel)
  const availableModels = useStore(s => s.availableModels)

  const copyStructuredToClipboard = () => {
    let text = `GLOBAL CAREER INTELLIGENCE:\n"${intelligenceResults?.unifiedSummary || ''}"\n\n`;
    text += `PROJECT HIGHLIGHTS:\n${'='.repeat(20)}\n\n`;
    const projects = Array.isArray(intelligenceResults) ? intelligenceResults : (intelligenceResults?.refinedProjects || intelligenceResults?.projects || []);
    projects.forEach((r: any) => {
      text += `${r.projectName || r.name}\n`;
      text += `Summary: ${r.oneLineSummary || ''}\n`;
      text += `Technologies: ${(r.techStack || []).join(', ')}\n\n`;
      const features = r.formattedFeatures || r.bullets || [];
      if (features.length > 0) {
        text += `Key Features & Implementation:\n`;
        features.forEach((f: string) => text += `  · ${f}\n`);
      }
      text += `\n\n`;
    });
    navigator.clipboard.writeText(text);
    toast.success('Career History Copied to Clipboard!');
  }

  const explorerSidebar = (
    <div className="w-80 h-screen p-4 shrink-0 transition-all duration-500 overflow-hidden bg-bg-color border-r border-border-color/10">
      <div className="flex flex-col h-full bg-bg-color border border-border-color rounded-3xl overflow-hidden shadow-xl relative">
        <div className="h-14 px-5 border-b border-border-color/30 flex items-center justify-between shrink-0 bg-surface-color">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                <FileText size={14} className="text-white" />
             </div>
             <div className="flex flex-col">
                <span className="font-black text-xs text-primary leading-none uppercase italic">Explorer</span>
                <span className="text-[7px] font-bold text-indigo-400 uppercase tracking-widest">{isIntelligenceRunning ? 'Engine Active' : 'Ready'}</span>
             </div>
          </div>
          <button onClick={() => fetchRepos(true)} className="p-2 hover:bg-bg-color rounded-lg text-indigo-400 hover:text-indigo-500 transition-all active:rotate-180 duration-500">
             <RefreshCw size={14} /> 
          </button>
        </div>

        <div className="p-4 space-y-4 border-b border-border-color bg-surface-color shrink-0">
           <div className="relative">
             <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-indigo-400" />
             <input 
               placeholder="Search repositories..." value={search} onChange={e => setSearch(e.target.value)}
               className="w-full bg-bg-color border border-border-color rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-primary"
             />
           </div>
           <div className="flex gap-2">
             <button onClick={() => setSelectedRepoIds(new Set(repos.map((r: any) => r.id)))} className="flex-1 py-1.5 text-[8px] bg-bg-color border border-border-color/40 rounded-lg font-black uppercase tracking-widest text-secondary hover:text-primary transition-all">Select All</button>
             <button onClick={() => setSelectedRepoIds(new Set())} className="flex-1 py-1.5 text-[8px] bg-bg-color border border-border-color/40 rounded-lg font-black uppercase tracking-widest text-secondary hover:text-primary transition-all">Deselect</button>
           </div>
           <div className="pt-2 border-t border-border-color/20">
              <div className="space-y-1">
                 <label className="text-[7px] font-bold text-secondary uppercase tracking-tight">Intelligence Model</label>
                 <select 
                   className="w-full bg-transparent border-b border-border-color pb-1 text-[10px] text-primary focus:outline-none focus:border-indigo-500/40"
                   value={intelModel || ''} onChange={e => setIntelModel(e.target.value)}
                 >
                   {availableModels.map(m => (
                     <option key={m.id} value={m.id}>{m.name}</option>
                   ))}
                 </select>
              </div>
           </div>
           <button 
              onClick={() => startResumeJob('intelligence')}
              disabled={isIntelligenceRunning || selectedRepoIds.size === 0}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-30 shadow-lg shadow-indigo-600/10 group text-white"
           >
              {isIntelligenceRunning ? <Loader2 className="h-4 w-4 animate-spin"/> : <Terminal className="h-4 w-4 group-hover:translate-x-0.5 transition-transform"/>}
              {isIntelligenceRunning ? (PHASES_MAP[bulkProgress.phase] || 'Working...') : 'Extract Technical Identity'}
           </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 bg-surface-color/30">
           <nav className="space-y-1.5">
              {repos.filter((r: any) => r.name.toLowerCase().includes(search.toLowerCase())).map((repo: any) => {
                const isSelected = selectedRepoIds.has(repo.id);
                return (
                  <button 
                    key={repo.id} 
                    onClick={() => toggleRepoSelection(repo.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group border text-left",
                      isSelected 
                        ? "bg-indigo-600/10 border-indigo-500/30 shadow-sm" 
                        : "bg-bg-color/50 border-border-color/30 hover:border-indigo-500/20"
                    )}
                  >
                     <div className={cn(
                       "h-4 w-4 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                       isSelected ? "bg-indigo-500 border-indigo-500" : "border-border-color bg-bg-color group-hover:border-indigo-500/50"
                     )}>
                        {isSelected && <Check size={10} className="text-white fill-white" />}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className={cn("font-bold text-xs truncate transition-colors", isSelected ? "text-primary" : "text-primary/60 group-hover:text-primary")}>
                          {repo.name}
                        </div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-secondary/40 mt-0.5">
                          {repo.full_name.split('/')[0]}
                        </div>
                     </div>
                  </button>
                );
              })}
           </nav>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {explorerSidebar}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-color">
        <PageHeader />
        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8 scrollbar-thin">
           <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between mb-4 mt-2">
                <h1 className="text-xl font-black italic tracking-tighter text-primary uppercase">Identity Extraction</h1>
                {(() => {
                  const list = Array.isArray(intelligenceResults) ? intelligenceResults : (intelligenceResults?.refinedProjects || intelligenceResults?.projects || []);
                  return list.length > 0 && (
                    <button onClick={copyStructuredToClipboard} className="px-5 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-[10px] font-bold text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                       <Copy size={14} /> Copy Results
                    </button>
                  );
                })()}
              </div>
              
               { isIntelligenceRunning ? (
                 <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-700">
                    <div className="relative">
                       <ScaleLoader color="#6366f1" height={30} width={3} radius={2} margin={2} />
                    </div>
                    <div className="space-y-2">
                       <h1 className="text-2xl font-black text-primary tracking-tight uppercase italic drop-shadow-sm">{PHASES_MAP[bulkProgress.phase] || 'Synthesizing...'}</h1>
                       <p className="text-[8px] font-bold text-secondary/60 uppercase tracking-[0.4em] animate-pulse">Building Technical Graph</p>
                    </div>
                 </div>
               ) : (() => {
                  const projects = Array.isArray(intelligenceResults) ? intelligenceResults : (intelligenceResults?.refinedProjects || intelligenceResults?.projects || []);
                  if (projects.length === 0) return (
                     <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-6 py-20">
                        <div className="p-8 bg-indigo-500/5 rounded-full">
                          <LayoutIcon size={60} className="text-indigo-500/20" />
                        </div>
                        <p className="text-sm font-black text-primary italic uppercase tracking-widest">Select repos to extract technical identities.</p>
                     </div>
                   );
                   return (
                     <div className="space-y-8 pb-10">
                        {projects.map((r: any, i: number) => {
                          const details = r.formattedFeatures || r.bullets || (r.technicalSummary ? [r.technicalSummary] : []);
                          return (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4 }}
                              key={i} 
                              className="p-10 rounded-[3rem] bg-surface-color border border-border-color space-y-6 relative group transition-all duration-500 overflow-hidden shadow-xl hover:border-indigo-500/20"
                            >
                               <div className="flex items-center justify-between relative z-10">
                                  <div>
                                     <h4 className="font-black text-2xl tracking-tighter text-primary mb-1 uppercase italic">{r.projectName || r.name}</h4>
                                     <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest opacity-80">{r.oneLineSummary}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 justify-end max-w-[200px]">
                                     {(Array.isArray(r.techStack) ? r.techStack : []).map((t: string) => <span key={t} className="px-2 py-0.5 bg-bg-color border border-border-color/30 rounded text-[8px] text-indigo-400 font-bold uppercase tracking-tight">{t}</span>)}
                                  </div>
                               </div>

                               <div className="space-y-4 pt-2 relative z-10 text-primary">
                                  <div className="relative">
                                     <h5 className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400 pb-1">Technical Architecture</h5>
                                     <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-indigo-500/10" />
                                  </div>
                                  <ul className="space-y-4">
                                     {details.map((f: string, idx: number) => {
                                       const hasColon = f.includes(':');
                                        const title = hasColon ? f.split(':')[0].trim() : '';
                                        const description = hasColon ? f.split(':').slice(1).join(':').trim() : f;
                                       return (
                                          <li key={idx} className="space-y-1">
                                             <div className="flex items-start gap-2">
                                                <div className="h-4 flex items-center"><div className="h-1 w-2 rounded-full bg-indigo-500/40" /></div>
                                                 {title && <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-indigo-500/5 px-1.5 py-0.5 rounded border border-indigo-500/10 mb-1">{title}</span>}
                                             </div>
                                             <p className="text-xs text-secondary leading-relaxed flex-1">{description}</p>
                                          </li>
                                       );
                                     })}
                                  </ul>
                                </div>
                            </motion.div>
                          );
                        })}
                     </div>
                   );
                })()}
            </div>
         </div>
      </div>

    </>
  )
}

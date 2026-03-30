import { motion } from 'framer-motion'
import { ScaleLoader } from 'react-spinners'
import { FileText, RefreshCw, Search, Loader2, Terminal, Copy, Layout as LayoutIcon, Check } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { cn } from '../utils/cn'
import { toast } from 'react-hot-toast'

export function Explorer({ 
  user, repos, selectedRepoIds, toggleRepoSelection, isIntelligenceRunning, 
  intelligenceResults, bulkProgress, PHASES_MAP, handleLogout, fetchRepos, 
  startResumeJob, search, setSearch, setSelectedRepoIds, copyStructuredToClipboard,
  theme, toggleTheme
}: any) {
  
  const explorerSidebar = (
    <div className="w-80 h-full p-4 shrink-0 transition-all duration-500 overflow-hidden">
      <div className="flex flex-col h-full bg-bg-color border border-border-color rounded-[2rem] overflow-hidden shadow-lg relative">
        <div className="h-16 px-6 border-b border-border-color/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <FileText size={18} className="text-indigo-500" />
             <span className="font-bold text-lg text-primary tracking-tight">Explorer</span>
          </div>
          <button onClick={() => fetchRepos(true)} className="p-2 hover:bg-surface-color rounded-lg text-indigo-400 hover:text-indigo-500 transition-all active:rotate-180 duration-500">
             <RefreshCw size={16} /> 
          </button>
        </div>

        <div className="p-4 space-y-4 border-b border-border-color bg-surface-color shrink-0">
           <div className="relative">
             <Search className="absolute left-3 top-3 h-4 w-4 text-indigo-400" />
             <input 
               placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
               className="w-full bg-bg-color border border-border-color rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-primary"
             />
           </div>
           <div className="flex gap-2">
             <button onClick={() => setSelectedRepoIds(new Set(repos.map((r: any) => r.id)))} className="flex-1 py-2 text-[10px] bg-surface-color border border-border-color/40 rounded-xl font-black uppercase tracking-widest text-secondary hover:text-primary transition-all">Select All</button>
             <button onClick={() => setSelectedRepoIds(new Set())} className="flex-1 py-2 text-[10px] bg-surface-color border border-border-color/40 rounded-xl font-black uppercase tracking-widest text-secondary hover:text-primary transition-all">Select None</button>
           </div>
           <button 
              onClick={() => startResumeJob('intelligence')}
              disabled={isIntelligenceRunning || selectedRepoIds.size === 0}
              className="w-full py-4 bg-indigo-500/90 hover:bg-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] flex items-center justify-center gap-2.5 active:scale-95 transition-all disabled:opacity-30 shadow-lg shadow-indigo-600/10 group text-white"
           >
              {isIntelligenceRunning ? <Loader2 className="h-4 w-4 animate-spin"/> : <Terminal className="h-4 w-4 group-hover:translate-x-0.5 transition-transform"/>}
              {isIntelligenceRunning ? (PHASES_MAP[bulkProgress.phase] || 'Analyzing...') : 'Extract Intelligence'}
           </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
           <nav className="space-y-2">
              {repos.filter((r: any) => r.name.toLowerCase().includes(search.toLowerCase())).map((repo: any) => {
                const isSelected = selectedRepoIds.has(repo.id);
                return (
                  <button 
                    key={repo.id} 
                    onClick={() => toggleRepoSelection(repo.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group border text-left",
                      isSelected 
                        ? "bg-indigo-600/10 border-indigo-500/30 whitespace-nowrap shadow-sm" 
                        : "bg-surface-color border-border-color/30 hover:bg-white/[0.02] hover:border-white/10"
                    )}
                  >
                     <div className={cn(
                       "h-5 w-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                       isSelected ? "bg-indigo-500 border-indigo-500" : "border-border-color bg-bg-color group-hover:border-indigo-500/50"
                     )}>
                        {isSelected && <Check size={12} className="text-white fill-white" />}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className={cn("font-bold text-sm truncate transition-colors", isSelected ? "text-primary" : "text-primary/60 group-hover:text-primary")}>
                          {repo.name}
                        </div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-secondary/40 mt-0.5">
                          {repo.full_name.split('/')[0]}
                        </div>
                     </div>
                     {isSelected && (
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,1)]" />
                     )}
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
         <PageHeader user={user} handleLogout={handleLogout} activeView="explorer" theme={theme} toggleTheme={toggleTheme} />
        <div className="flex-1 overflow-y-auto p-10 scrollbar-thin scroll-smooth">
           <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-black italic tracking-tighter text-primary transition-colors">Project Intelligence Creator</h1>
                {(() => {
                  const list = Array.isArray(intelligenceResults) ? intelligenceResults : (intelligenceResults?.refinedProjects || intelligenceResults?.projects || []);
                  return list.length > 0 && (
                    <button onClick={copyStructuredToClipboard} className="px-6 py-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-xs font-bold text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                       <Copy size={16} /> Copy All as Plain Text
                    </button>
                  );
                })()}
              </div>
              
               { isIntelligenceRunning ? (
                 <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-12 py-20">
                    <div className="relative">
                       <ScaleLoader color="#6366f1" height={40} width={4} radius={2} margin={3} />
                    </div>
                    <div className="space-y-4">
                       <h1 className="text-4xl font-black text-primary tracking-tight uppercase italic drop-shadow-sm">{PHASES_MAP[bulkProgress.phase] || 'Synthesizing...'}</h1>
                       <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.4em] animate-pulse">Processing Technical Matrix</p>
                    </div>
                 </div>
               ) : (() => {
                  const projects = Array.isArray(intelligenceResults) ? intelligenceResults : (intelligenceResults?.refinedProjects || intelligenceResults?.projects || []);
                  if (projects.length === 0) return (
                     <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-10 py-20">
                        <LayoutIcon size={80} className="opacity-10 text-primary" />
                        <p className="text-lg font-bold opacity-20 text-primary">Select repositories to begin technical extraction.</p>
                     </div>
                   );
                   return (
                     <div className="space-y-12 pb-20">
                        {projects.map((r: any, i: number) => {
                          const details = r.formattedFeatures || r.bullets || (r.technicalSummary ? [r.technicalSummary] : []);
                          return (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.1 }}
                              key={i} 
                              className="p-10 rounded-3xl bg-bg-color border border-border-color space-y-6 relative group transition-all duration-500 overflow-hidden shadow-lg hover:border-indigo-500/20"
                            >
                               <div className="flex items-center justify-between relative z-10">
                                  <div>
                                     <h4 className="font-black text-3xl tracking-tight text-primary mb-2">{r.projectName || r.name}</h4>
                                     <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest opacity-80">{r.oneLineSummary}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2 justify-end max-w-xs">
                                     {(Array.isArray(r.techStack) ? r.techStack : []).map((t: string) => <span key={t} className="px-3 py-1 bg-bg-color border border-border-color/40 rounded text-[10px] text-indigo-400 font-bold uppercase tracking-tight">{t}</span>)}
                                  </div>
                               </div>

                               <div className="space-y-6 pt-4 relative z-10 text-primary">
                                  <div className="relative">
                                     <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 pb-2">Core Features & Architecture</h5>
                                     <div className="absolute bottom-0 left-0 right-0 premium-divider opacity-20" />
                                  </div>
                                  <ul className="space-y-6">
                                     {details.map((f: string, idx: number) => {
                                       const hasColon = f.includes(':');
                                        const title = hasColon ? f.split(':')[0].trim() : '';
                                        const description = hasColon ? f.split(':').slice(1).join(':').trim() : f;
                                       return (
                                         <li key={idx} className="space-y-2">
                                            <div className="flex items-start gap-3">
                                               <div className="h-5 flex items-center"><div className="h-1 w-2.5 rounded-full bg-indigo-500/60 shadow-[0_0_8px_rgba(99,102,241,0.6)]" /></div>
                                                {title && <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 mb-1">{title}</span>}
                                               
                                            </div>
                                            <p className="text-sm text-secondary leading-relaxed flex-1">
                                               {description}
                                            </p>
                                         </li>
                                       );
                                     })}
                                  </ul>
                               </div>
                               
                               <button 
                                 onClick={() => {
                                    let text = `${r.projectName || r.name}\nSummary: ${r.oneLineSummary}\nTechnologies: ${(r.techStack || []).join(', ')}\n\nKey Features:\n`;
                                    details.forEach((f: string) => text += `· ${f}\n`);
                                    navigator.clipboard.writeText(text);
                                    toast.success('Structured Project Block copied!');
                                 }}
                                 className="absolute bottom-6 right-6 p-4 bg-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-500/10 hover:scale-110"
                               >
                                  <Copy size={20} className="text-indigo-400" />
                               </button>
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

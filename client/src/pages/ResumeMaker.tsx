import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScaleLoader } from 'react-spinners'
import { Save, GraduationCap, Award, Briefcase, Zap, Loader2, Copy, User, Target, FileText } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../utils/cn'
import { toast } from 'react-hot-toast'

export function ResumeMaker({ 
  user, handleLogout, staticInfo, setStaticInfo, jobProfile, setJobProfile, 
  eduList, setEduList, certList, setCertList, expList, setExpList, 
  saveProfile, startResumeJob, isResumeRunning, markdownResume, 
  sseConnected, bulkProgress, PHASES_MAP, theme, toggleTheme, BACKEND_URL
}: any) {
  const [latexCode, setLatexCode] = useState('');
  const [isLatexModalOpen, setIsLatexModalOpen] = useState(false);
  const [isGeneratingLatex, setIsGeneratingLatex] = useState(false);

  const handleGenerateLatex = async () => {
    if (!markdownResume) return;
    setIsGeneratingLatex(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/generate-latex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: markdownResume })
      });
      const data = await resp.json();
      if (data.latex) {
        setLatexCode(data.latex);
        setIsLatexModalOpen(true);
      }
    } catch (e) {
      toast.error('LaTeX synthesis failed');
    } finally {
      setIsGeneratingLatex(false);
    }
  };
  
  const resumeSidebar = (
    <div className="w-80 h-full p-4 shrink-0 transition-all duration-500 overflow-hidden">
      <div className="flex flex-col h-full bg-bg-color border border-border-color rounded-[2rem] overflow-hidden shadow-lg relative">
        <div className="h-16 px-6 border-b border-border-color/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <FileText size={18} className="text-indigo-500" />
             <span className="font-bold text-lg text-primary tracking-tight">Resume Maker</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
          <button
            onClick={saveProfile}
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-bg-color/50 hover:bg-indigo-600 hover:text-white border border-border-color/50 rounded-lg text-[9px] font-black uppercase tracking-widest text-secondary transition-all"
          >
            <Save size={10} /> Save
          </button>

        <div className="flex-1 overflow-y-auto p-5 pt-10 space-y-8 scrollbar-thin">
          <div className="space-y-4">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 flex items-center gap-1.5 px-2">
              <User size={10} className="fill-indigo-500/20" /> Personal Info
            </h3>
            <div className="space-y-3 p-4 bg-bg-color border border-border-color rounded-xl hover:border-indigo-500/30 transition-all shadow-sm">
              <input
                placeholder="Full Name"
                className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-indigo-500/40 transition-colors"
                value={staticInfo.name} onChange={e => setStaticInfo({...staticInfo, name: e.target.value})}
              />
              <input
                placeholder="Email address"
                className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-indigo-500/40 transition-colors"
                value={staticInfo.email} onChange={e => setStaticInfo({...staticInfo, email: e.target.value})}
              />
              <textarea
                placeholder="Portfolio, GitHub, LinkedIn (one per line)"
                className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-indigo-500/40 transition-colors h-16 resize-none"
                value={staticInfo.links} onChange={e => setStaticInfo({...staticInfo, links: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-500 flex items-center gap-1.5 px-2">
              <Target size={10} className="fill-fuchsia-500/20" /> Target Role
            </h3>
            <div className="space-y-3 p-4 bg-bg-color border border-border-color rounded-xl hover:border-fuchsia-500/30 transition-all shadow-sm">
              <input
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-fuchsia-500/40 transition-colors"
                value={jobProfile.title} onChange={e => setJobProfile({...jobProfile, title: e.target.value})}
              />
              <textarea
                placeholder="Paste the full Job Description here..."
                className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-fuchsia-500/40 transition-colors h-28 resize-none"
                value={jobProfile.description} onChange={e => setJobProfile({...jobProfile, description: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1.5">
                <GraduationCap size={10} /> Education
              </h3>
              <button onClick={() => setEduList((p: any) => [...p, { degree: '', institution: '', period: '' }])}
                className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60 hover:text-emerald-400 transition-colors flex items-center gap-1">
                + Add
              </button>
            </div>
            <div className="space-y-4">
              {eduList.map((edu: any, i: number) => (
                <div key={i} className="relative bg-bg-color border border-border-color rounded-xl p-4 space-y-3 group transition-all hover:border-emerald-500/30 shadow-sm">
                  <button onClick={() => setEduList((p: any) => p.filter((_:any, j:number) => j !== i))}
                    className="absolute top-3 right-3 text-secondary/20 hover:text-red-400 transition-colors text-xs font-black">✕</button>
                  <input placeholder="Degree / Course"
                    className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    value={edu.degree} onChange={e => setEduList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, degree: e.target.value } : x))} />
                  <input placeholder="Institution"
                    className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    value={edu.institution} onChange={e => setEduList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, institution: e.target.value } : x))} />
                  <input placeholder="Period (e.g. 2020–2024)"
                    className="w-full bg-transparent text-xs text-primary/60 placeholder:text-secondary/30 focus:outline-none transition-colors"
                    value={edu.period} onChange={e => setEduList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, period: e.target.value } : x))} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1.5">
                <Award size={10} /> Certifications
              </h3>
              <button onClick={() => setCertList((p: any) => [...p, { name: '', issuer: '', date: '' }])}
                className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60 hover:text-emerald-400 transition-colors flex items-center gap-1">
                + Add
              </button>
            </div>
            <div className="space-y-4">
              {certList.map((cert: any, i: number) => (
                <div key={i} className="relative bg-bg-color border border-border-color rounded-xl p-4 space-y-3 group transition-all hover:border-emerald-500/30 shadow-sm">
                  <button onClick={() => setCertList((p: any) => p.filter((_:any, j:number) => j !== i))}
                    className="absolute top-3 right-3 text-secondary/20 hover:text-red-400 transition-colors text-xs font-black">✕</button>
                  <input placeholder="Certification Name"
                    className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    value={cert.name} onChange={e => setCertList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input placeholder="Issuing Body"
                    className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-emerald-500/40 transition-colors"
                    value={cert.issuer} onChange={e => setCertList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, issuer: e.target.value } : x))} />
                  <input placeholder="Date (e.g. Oct 2023)"
                    className="w-full bg-transparent text-xs text-primary/60 placeholder:text-secondary/30 focus:outline-none transition-colors"
                    value={cert.date} onChange={e => setCertList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, date: e.target.value } : x))} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-400 flex items-center gap-1.5">
                <Briefcase size={10} /> Work Experience
              </h3>
              <button onClick={() => setExpList((p: any) => [...p, { role: '', company: '', period: '', description: '' }])}
                className="text-[9px] font-black uppercase tracking-widest text-sky-400/60 hover:text-sky-400 transition-colors flex items-center gap-1">
                + Add
              </button>
            </div>
            <div className="space-y-4">
              {expList.map((exp: any, i: number) => (
                <div key={i} className="relative bg-bg-color border border-border-color rounded-xl p-4 space-y-3 group transition-all hover:border-sky-500/30 shadow-sm">
                  <button onClick={() => setExpList((p: any) => p.filter((_:any, j:number) => j !== i))}
                    className="absolute top-3 right-3 text-secondary/20 hover:text-red-400 transition-colors text-xs font-black">✕</button>
                  <input placeholder="Job Title / Role"
                    className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-sky-500/40 transition-colors"
                    value={exp.role} onChange={e => setExpList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, role: e.target.value } : x))} />
                  <input placeholder="Company"
                    className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-sky-500/40 transition-colors"
                    value={exp.company} onChange={e => setExpList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, company: e.target.value } : x))} />
                  <input placeholder="Period (e.g. June 2022 – Present)"
                    className="w-full bg-transparent border-b border-border-color pb-1 text-xs text-primary placeholder:text-secondary/30 focus:outline-none focus:border-sky-500/40 transition-colors"
                    value={exp.period} onChange={e => setExpList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, period: e.target.value } : x))} />
                  <textarea placeholder="What you did — key responsibilities & achievements..."
                    className="w-full bg-transparent text-xs text-primary/60 placeholder:text-secondary/30 focus:outline-none resize-none h-20 transition-colors"
                    value={exp.description} onChange={e => setExpList((p: any) => p.map((x:any, j:number) => j === i ? { ...x, description: e.target.value } : x))} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => startResumeJob('resume')}
          disabled={isResumeRunning}
          className="w-full py-6 rounded-none font-black text-sm uppercase tracking-widest text-white bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-2xl active:scale-95 transition-all disabled:opacity-40 disabled:grayscale flex items-center justify-center gap-2.5 shrink-0"
        >
          {isResumeRunning 
            ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> 
                Generating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 fill-white" /> 
                Generate Resume
              </span>
            )
          }
        </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {resumeSidebar}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-color">
         <PageHeader user={user} handleLogout={handleLogout} activeView="resume" theme={theme} toggleTheme={toggleTheme} />
         <div className="flex-1 overflow-y-auto p-10 scrollbar-thin">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-[2.5rem] min-h-[1100px] flex flex-col shadow-2xl relative overflow-hidden ring-1 ring-black/5 p-16 transition-colors duration-500 text-gray-900 border border-gray-100">
                  <div className="flex items-center justify-between mb-12 border-b border-gray-100 pb-6">
                     <div className="flex items-center gap-6">
                        <h2 className="font-bold text-xl text-gray-900 flex items-center gap-3"><Briefcase size={22} className="text-indigo-600" /> Professional Document Preview</h2>
                        <div className="flex items-center gap-2.5 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full select-none">
                           <div className={cn("h-1.5 w-1.5 rounded-full transition-all duration-500", sseConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-400 animate-pulse")} />
                           <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">
                             {sseConnected ? "LIVE SYNC ACTIVE" : "OFFLINE"}
                           </span>
                        </div>
                      </div>
                      {markdownResume && (
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={handleGenerateLatex}
                             disabled={isGeneratingLatex}
                             className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 text-gray-400 transition-all flex items-center gap-2 group shadow-sm hover:scale-105"
                             title="Generate LaTeX Snippet"
                           >
                             {isGeneratingLatex ? <Loader2 size={16} className="animate-spin text-indigo-500" /> : <Zap size={16} className="group-hover:fill-indigo-500" />}
                             <span className="text-[10px] font-black uppercase tracking-widest">Generate LaTeX</span>
                           </button>
                           <button 
                             onClick={() => {
                               navigator.clipboard.writeText(markdownResume);
                               toast.success('Markdown Resume Copied!');
                             }} 
                             className="p-3 bg-gray-50 border border-gray-100 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 text-gray-400 transition-all shadow-sm hover:scale-105"
                             title="Copy Markdown"
                           >
                             <Copy size={16}/>
                           </button>
                        </div>
                      )}
                  </div>
                  <div className="flex-1 prose prose-slate prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-black prose-strong:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-hr:border-gray-100">
                     {markdownResume ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownResume}</ReactMarkdown>
                     ) : (
                          <div className="h-full flex-1 flex flex-col items-center justify-center text-center space-y-10 py-40">
                             <div className="relative py-10 flex justify-center">
                                <ScaleLoader color="#6366f1" height={40} width={4} radius={2} margin={3} />
                             </div>
                             <div className="space-y-4">
                                <p className="text-3xl font-black text-indigo-800 tracking-tight uppercase">
                                   {PHASES_MAP[bulkProgress.phase] || 'Drafting Career Narrative...'}
                                </p>
                                <div className="flex items-center justify-center gap-2">
                                   <div className={cn("h-2 w-2 rounded-full", sseConnected ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-red-400 animate-pulse")} />
                                   <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{sseConnected ? 'Live Sync Active' : 'Offline'}</span>
                                </div>
                                <div className="h-2 w-64 bg-indigo-100 rounded-full overflow-hidden mx-auto mt-6">
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

      <AnimatePresence>
        {isLatexModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="w-full max-w-4xl h-[90vh] bg-[#1a1a1c] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="h-20 px-10 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#1e1e20]">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl">
                       <FileText className="text-indigo-400" size={24} />
                    </div>
                    <div className="text-left">
                       <h3 className="text-xl font-black text-white tracking-tight">LaTeX Source Code</h3>
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mt-1">Llama-3.3-70B • High-Fidelity Synthesis</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setIsLatexModalOpen(false)}
                   className="p-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
                 >
                   <Zap size={20} />
                 </button>
              </div>
              
              <div className="flex-1 overflow-hidden p-8 relative group bg-[#0c0c0e]">
                 <textarea 
                   readOnly
                   className="w-full h-full bg-transparent border-none p-8 font-mono text-xs text-indigo-300 leading-relaxed focus:outline-none resize-none scrollbar-thin scrollbar-thumb-white/10 shadow-inner"
                   value={latexCode}
                 />
                 <button 
                   onClick={() => {
                     navigator.clipboard.writeText(latexCode);
                     toast.success('LaTeX Code Copied!');
                   }}
                   className="absolute bottom-12 right-12 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white/10"
                 >
                   <Copy size={14} /> Copy Source
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

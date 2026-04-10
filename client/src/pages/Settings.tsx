import { useState, useEffect } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PointerBackground } from '../components/PointerBackground'
import { useStore } from '../store'
import { Shield, Cpu, Save, Check, Plus, Trash2, Key, Settings as SettingsIcon, User, Palette, ExternalLink } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn } from '../utils/cn'
import { motion, AnimatePresence } from 'framer-motion'

type Category = 'providers' | 'appearance' | 'account'

export function Settings() {
  const { user, nvidiaApiKey, selectedModels, availableModels, setNvidiaSettings, theme, setTheme } = useStore()
  const [activeCategory, setActiveCategory] = useState<Category>('providers')
  const [key, setKey] = useState(nvidiaApiKey)
  const [modelSearch, setModelSearch] = useState('')
  const [localModels, setLocalModels] = useState<string[]>(selectedModels)

  useEffect(() => {
    setKey(nvidiaApiKey)
    setLocalModels(selectedModels)
  }, [nvidiaApiKey, selectedModels])

  const handleSave = () => {
    setNvidiaSettings(key, localModels)
    toast.success("Settings synchronized successfully")
  }

  const toggleModel = (id: string) => {
    setLocalModels(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const filteredModels = availableModels.filter(m => 
    m.name.toLowerCase().includes(modelSearch.toLowerCase()) || 
    m.id.toLowerCase().includes(modelSearch.toLowerCase())
  )

  if (!user) return null

  const categories = [
    { id: 'providers', label: 'AI Providers', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'account', label: 'Account', icon: User },
  ] as const

  return (
    <div className="flex-1 flex overflow-hidden bg-bg-color relative">
      <PointerBackground theme={theme} />
      
      {/* GLASSMORPHIC SIDEBAR */}
      <aside className="w-80 h-full p-6 shrink-0 z-10 hidden md:block border-r border-white/5 bg-black/20 backdrop-blur-3xl">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 mb-10 px-2 mt-4">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
              <SettingsIcon size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black italic tracking-tighter text-primary uppercase">Control <span className="text-indigo-500">Center</span></h2>
              <p className="text-[9px] font-bold text-secondary uppercase tracking-[0.2em]">Engine Configuration</p>
            </div>
          </div>

          <nav className="space-y-2 flex-1">
            {categories.map((cat) => {
              const Icon = cat.icon
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group border text-left",
                    isActive 
                      ? "bg-indigo-500/10 border-indigo-500/30 text-primary shadow-lg shadow-indigo-500/5" 
                      : "bg-transparent border-transparent text-secondary hover:bg-white/5 hover:text-primary"
                  )}
                >
                  <Icon size={18} className={cn("transition-transform", isActive ? "scale-110 text-indigo-400" : "group-hover:scale-110")} />
                  <span className="text-[11px] font-black uppercase tracking-widest">{cat.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="active-pill" 
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" 
                    />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto px-2 pb-6">
            <div className="p-5 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 relative overflow-hidden group">
               <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Shield size={80} className="text-indigo-500" />
               </div>
               <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Status</h4>
               <p className="text-[11px] text-primary/80 leading-relaxed font-medium">Your configuration is encrypted locally.</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden">
        <PageHeader />
        
        <div className="flex-1 overflow-y-auto px-8 pt-10 pb-32 no-scrollbar scroll-smooth">
          <div className="max-w-3xl mx-auto">
            
            <motion.div 
              key={activeCategory}
              initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.4 }}
              className="space-y-12"
            >
              <header className="mb-2">
                <h1 className="text-5xl font-black italic tracking-tighter text-primary uppercase">
                  {categories.find(c => c.id === activeCategory)?.label}
                </h1>
                <p className="text-secondary text-[11px] font-black uppercase tracking-[0.3em] mt-2 opacity-60">
                  {activeCategory === 'providers' && "Configure enterprise-grade AI infrastructure"}
                  {activeCategory === 'appearance' && "Customize your visual environment"}
                  {activeCategory === 'account' && "Manage your workspace and data privacy"}
                </p>
              </header>

              {activeCategory === 'providers' && (
                <div className="space-y-8">
                  <section className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:border-indigo-500/20 transition-all duration-500">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                      <Cpu size={140} className="text-indigo-500 rotate-12" />
                    </div>

                    <div className="flex items-center gap-6 mb-12">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-inner">
                        <Key size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black italic tracking-tighter text-primary uppercase">NVIDIA NIM Integration</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Enterprise Acceleration Enabled</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8 relative z-10">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400">API Key</label>
                          <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest text-secondary hover:text-primary transition-colors flex items-center gap-1">
                             Get Key <ExternalLink size={10} />
                          </a>
                        </div>
                        <div className="relative group/input">
                          <input 
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="nvapi-..."
                            className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-sm font-medium text-primary placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all group-hover/input:border-white/10 shadow-inner"
                          />
                          <div className="absolute right-6 top-1/2 -translate-y-1/2">
                            <Key size={18} className="text-white/10 group-focus-within/input:text-indigo-400 transition-colors" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 ml-1">Preferred Computing Models</label>
                          <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-widest">
                            {localModels.length} Units Active
                          </span>
                        </div>
                        
                        <div className="relative group/search">
                           <input 
                             type="text"
                             placeholder="Search model registry..."
                             value={modelSearch}
                             onChange={(e) => setModelSearch(e.target.value)}
                             className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-[11px] font-bold text-primary placeholder:text-white/10 focus:outline-none focus:border-indigo-500/30 transition-all uppercase tracking-wider"
                           />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-1">
                          {filteredModels.map(model => {
                            const isSelected = localModels.includes(model.id)
                            return (
                              <button
                                key={model.id}
                                onClick={() => toggleModel(model.id)}
                                className={cn(
                                  "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 group/btn relative overflow-hidden",
                                  isSelected 
                                    ? "bg-indigo-500/10 border-indigo-500/40 text-primary shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20" 
                                    : "bg-white/[0.03] border-white/5 text-secondary hover:border-white/20 hover:bg-white/[0.05]"
                                )}
                              >
                                {isSelected && <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full" />}
                                <div className="flex flex-col gap-1 relative z-10">
                                  <span className="text-[11px] font-black uppercase tracking-tight">{model.name}</span>
                                  <span className="text-[8px] font-mono text-secondary/40 truncate max-w-[140px] uppercase tracking-widest">{model.id}</span>
                                </div>
                                <div className={cn(
                                   "h-6 w-6 rounded-lg flex items-center justify-center transition-all relative z-10 border",
                                   isSelected ? "bg-indigo-500 border-indigo-400 text-white" : "bg-black/20 border-white/5 text-white/10 group-hover/btn:border-white/20"
                                )}>
                                   {isSelected ? <Check size={12} strokeWidth={4} /> : <Plus size={12} />}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeCategory === 'appearance' && (
                <div className="space-y-8">
                  <section className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-xl">
                    <div className="flex items-center gap-6 mb-12">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                        <Palette size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black italic tracking-tighter text-primary uppercase">Environmental Styling</h3>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mt-1">Configure UI visual engine</p>
                      </div>
                    </div>

                    <div className="space-y-10">
                      <div className="flex items-center justify-between p-8 bg-black/30 rounded-3xl border border-white/5 group transition-all hover:border-white/10">
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-primary uppercase tracking-widest">Dark Protocol</h4>
                          <p className="text-[9px] text-secondary font-bold uppercase tracking-[0.2em]">OLED Optimized Interface</p>
                        </div>
                        <button 
                          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                          className={cn(
                            "relative w-16 h-8 rounded-full transition-all duration-500 p-1 flex items-center",
                            theme === 'dark' ? "bg-indigo-600 justify-end" : "bg-zinc-800 justify-start"
                          )}
                        >
                          <motion.div 
                            layout
                            className="h-6 w-6 rounded-full bg-white shadow-xl"
                          />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 rounded-3xl bg-black/20 border border-white/5 border-dashed flex flex-col items-center justify-center gap-3 opacity-40 hover:opacity-60 transition-opacity cursor-not-allowed group">
                           <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-secondary">
                              <SettingsIcon size={16} />
                           </div>
                           <span className="text-[8px] font-black uppercase tracking-[0.3em]">Module Customization</span>
                        </div>
                        <div className="p-6 rounded-3xl bg-black/20 border border-white/5 border-dashed flex flex-col items-center justify-center gap-3 opacity-40 hover:opacity-60 transition-opacity cursor-not-allowed group">
                           <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-secondary">
                              <Palette size={16} />
                           </div>
                           <span className="text-[8px] font-black uppercase tracking-[0.3em]">Color Palette</span>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeCategory === 'account' && (
                <div className="space-y-8">
                  <section className="bg-red-500/[0.02] border border-red-500/10 rounded-[2.5rem] p-10 backdrop-blur-xl group hover:border-red-500/20 transition-all duration-500">
                    <div className="flex items-center gap-6 mb-12">
                      <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                        <Trash2 size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black italic tracking-tighter text-red-500 uppercase">Destruction Zone</h3>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mt-1">Critical account management</p>
                      </div>
                    </div>

                    <div className="p-8 bg-red-500/5 rounded-3xl border border-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-primary uppercase tracking-widest">Wipe AI Metadata</h4>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-relaxed">
                          This action will flush your API keys from secure memory.<br/>
                          <span className="text-red-500/60 text-[8px]">Operation cannot be reversed.</span>
                        </p>
                      </div>
                      <button 
                         onClick={() => { setKey(''); setLocalModels([]); }}
                         className="px-8 py-4 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all border border-red-500/20 active:scale-95 whitespace-nowrap"
                      >
                        FLUSH DATABASE
                      </button>
                    </div>
                  </section>

                  <section className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-xl">
                    <div className="flex items-center gap-6 mb-8">
                      <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center text-secondary border border-white/5">
                        <User size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black italic tracking-tighter text-primary uppercase">Identity Credentials</h3>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mt-1">Authenticated via GitHub Cloud</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                       <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Active Session</span>
                       <span className="text-sm font-bold text-primary opacity-60 px-6 py-4 bg-black/40 rounded-2xl border border-white/5">{user.username || user.email}</span>
                    </div>
                  </section>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* FLOATING ACTION BAR - GLASSMORPHIC */}
        <AnimatePresence>
          {(key !== nvidiaApiKey || JSON.stringify(localModels) !== JSON.stringify(selectedModels)) && (
            <motion.div 
              initial={{ y: 100, x: '-50%', opacity: 0 }}
              animate={{ y: 0, x: '-50%', opacity: 1 }}
              exit={{ y: 100, x: '-50%', opacity: 0 }}
              className="fixed bottom-12 left-1/2 z-50 pointer-events-auto"
            >
              <button 
                onClick={handleSave}
                className="flex items-center gap-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black italic tracking-tighter px-12 py-6 rounded-3xl shadow-[0_20px_50px_rgba(99,102,241,0.3)] transition-all hover:scale-105 active:scale-95 group border border-indigo-400/20"
              >
                <div className="p-1 bg-white/10 rounded-lg group-hover:rotate-12 transition-transform">
                  <Save size={18} />
                </div>
                <span className="text-sm uppercase tracking-widest">SYNCHRONIZE CHANGES</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

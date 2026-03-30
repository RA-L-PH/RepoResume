import { motion } from 'framer-motion'
import { Github, Sun, Moon } from 'lucide-react'
import { PointerBackground } from '../components/PointerBackground'

export function Login({ BACKEND_URL, theme, toggleTheme }: { BACKEND_URL: string, theme: 'light' | 'dark', toggleTheme: () => void }) {
  return (
    <div className="h-screen w-full flex items-center justify-center text-primary p-10 relative overflow-hidden transition-colors duration-500">
      <PointerBackground theme={theme} />
      
      {/* Floating Theme Toggle */}
      <button 
        onClick={toggleTheme}
        className="fixed top-8 right-8 p-3 rounded-full glass hover:bg-white/10 transition-all z-50 text-primary"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-12 max-w-lg z-10">
        <div className="space-y-4">
           <div className="h-40 w-40 mx-auto flex items-center justify-center transition-transform duration-500 hover:scale-105">
              <img src="/logo.png" alt="RepoResume Logo" className="h-full w-full object-contain" />
           </div>
           <h1 className="text-8xl font-black tracking-tighter italic leading-[0.85]">Repo<br/><span className="text-indigo-500">Resume</span></h1>
           <p className="text-secondary font-bold tracking-[0.3em] uppercase text-[10px] pl-1">The Source-To-Synopsis Architectural Resume Engine</p>
        </div>
        
        <div className="p-1 px-1.5 glass rounded-[2.5rem] shadow-2xl w-full">
          <button 
            onClick={() => window.location.href = `${BACKEND_URL}/auth/github`} 
            className="w-full py-5 dark:bg-white dark:text-black bg-[#0c0c0e] text-white rounded-[1.8rem] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:opacity-90 group shadow-xl"
          >
            <Github className="h-5 w-5 fill-current" /> Login with GitHub
          </button>
        </div>

        <p className="text-[9px] font-black text-secondary uppercase tracking-[0.4em] pt-10">RAG-Driven Intelligence by Llama-3.3-70B via NVIDIA NIM</p>
      </motion.div>
    </div>
  )
}

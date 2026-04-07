import { User, LogOut, Sun, Moon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../utils/cn'
import { useStore } from '../store'
import axios from 'axios'
import { toast } from 'react-hot-toast'

export function PageHeader() {
  const { user, setUser, theme, setTheme, BACKEND_URL } = useStore()
  const location = useLocation()
  const activeView = location.pathname.split('/')[1]

  const handleLogout = async () => {
    try {
      await axios.post(`${BACKEND_URL}/auth/logout`)
      setUser(null)
      window.location.reload()
    } catch (e) {
      toast.error("Logout failed")
    }
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    toast.success(`Mode: ${next.toUpperCase()}`)
  }

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 w-full h-20 flex items-center px-4 pointer-events-none group">
        {/* ATMOSPHERIC FOG - Compact Gradient Blur that merges document into header background */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg-color via-bg-color/90 to-transparent backdrop-blur-xl -z-10 transition-opacity" />
        
        <div className="flex-1 max-w-7xl mx-auto h-12 bg-white/5 dark:bg-black/20 border border-white/10 dark:border-white/5 rounded-2xl px-8 flex items-center justify-between shadow-2xl shadow-black/10 transition-all pointer-events-auto">
        <div className="flex items-center gap-12">
           <Link to="/explorer" className="flex items-center gap-3 group px-4">
              <span className="text-sm font-black italic tracking-tighter text-primary group-hover:text-indigo-400 transition-colors">Repo<span className="text-indigo-500">Resume</span></span>
           </Link>

           <div className="flex items-center gap-8 pl-6 h-6 border-l border-border-color/30">
              <Link to="/explorer" className={cn("text-[8px] font-black italic tracking-widest uppercase transition-all", activeView === 'explorer' ? "text-indigo-400" : "text-secondary hover:text-primary")}>Intelligence</Link>
              <Link to="/resume" className={cn("text-[8px] font-black italic tracking-widest uppercase transition-all", activeView === 'resume' ? "text-indigo-400" : "text-secondary hover:text-primary")}>Architect</Link>
              <Link to="/cover-letter" className={cn("text-[8px] font-black italic tracking-widest uppercase transition-all", activeView === 'cover-letter' ? "text-indigo-400" : "text-secondary hover:text-primary")}>Narrative</Link>
              <Link to="/linkedin-post" className={cn("text-[8px] font-black italic tracking-widest uppercase transition-all", activeView === 'linkedin-post' ? "text-blue-400" : "text-secondary hover:text-primary")}>Social</Link>
           </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3 group cursor-default">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-fuchsia-500 p-[1px] overflow-hidden">
                 <div className="h-full w-full rounded-full bg-bg-color flex items-center justify-center overflow-hidden">
                   {user.photos?.[0]?.value ? (
                      <img src={user.photos[0].value} alt={user.username} className="h-full w-full object-cover scale-110" />
                   ) : (
                      <User size={14} className="text-primary" />
                   )}
                 </div>
              </div>
              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{user.username}</span>
           </div>
           
           <div className="flex items-center gap-2 border-l border-border-color pl-6">
             <button 
               onClick={toggleTheme}
               className="p-2 hover:bg-indigo-500/10 rounded-lg text-secondary hover:text-indigo-500 transition-all"
               title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
             >
               {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
             </button>
             <button 
               onClick={handleLogout} 
               className="p-2 hover:bg-red-500/10 rounded-lg text-secondary hover:text-red-400 transition-all"
               title="Logout"
             >
               <LogOut size={15} />
             </button>
           </div>
         </div>
       </div>
    </header>
  )
}

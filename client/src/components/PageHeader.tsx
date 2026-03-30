import { User, LogOut, Sun, Moon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../utils/cn'

export function PageHeader({ user, handleLogout, activeView, theme, toggleTheme }: any) {
  if (!user) return null;
  return (
    <header className="h-20 bg-transparent flex items-center px-6 transition-all duration-500 relative z-50">
       <div className="flex-1 max-w-7xl mx-auto h-16 bg-bg-color border border-border-color rounded-2xl px-8 flex items-center justify-between shadow-sm transition-colors">
       <div className="flex items-center gap-12">
          <Link to="/explorer" className="flex items-center gap-3 group">
             <div className="h-8 w-8 hover:scale-110 transition-transform">
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
             </div>
             <span className="text-sm font-black italic tracking-tighter text-primary group-hover:text-indigo-400 transition-colors">Repo<span className="text-indigo-500">Resume</span></span>
          </Link>

          <div className="flex items-center gap-8 pl-6 h-6 border-l border-border-color">
             <Link to="/explorer" className={cn("text-xs font-black italic tracking-widest uppercase transition-all", activeView === 'explorer' ? "text-indigo-400" : "text-secondary hover:text-primary")}>Project Intelligence</Link>
             <Link to="/resume" className={cn("text-xs font-black italic tracking-widest uppercase transition-all", activeView === 'resume' ? "text-indigo-400" : "text-secondary hover:text-primary")}>Resume Maker</Link>
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
             <span className="text-xs font-bold text-secondary">{user.username}</span>
          </div>
          
          <div className="flex items-center gap-2 border-l border-border-color pl-6">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-indigo-500/10 rounded-lg text-secondary hover:text-indigo-500 transition-all"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button 
              onClick={handleLogout} 
              className="p-2 hover:bg-red-500/10 rounded-lg text-secondary hover:text-red-400 transition-all"
              title="Logout"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
       </div>
    </header>
  )
}

import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'


// Pages
import { Login } from './pages/Login'
import { Explorer } from './pages/Explorer'
import { ResumeMaker } from './pages/ResumeMaker'
import { CoverLetter } from './pages/CoverLetter'
import { LinkedInPost } from './pages/LinkedInPost'
import { Settings } from './pages/Settings'

// Components
import { ApiKeyModal } from './components/ApiKeyModal'

// Store
import { useStore } from './store'

export default function App() {
  const user = useStore(s => s.user)
  const checkAuth = useStore(s => s.checkAuth)
  const setSseConnected = useStore(s => s.setSseConnected)
  const setIsIntelligenceRunning = useStore(s => s.setIsIntelligenceRunning)
  const setIsResumeRunning = useStore(s => s.setIsResumeRunning)
  const setIsCoverLetterRunning = useStore(s => s.setIsCoverLetterRunning)
  const setIsLinkedInRunning = useStore(s => s.setIsLinkedInRunning)
  const setCurrentMarkdown = useStore(s => s.setCurrentMarkdown)
  const setCurrentCoverLetter = useStore(s => s.setCurrentCoverLetter)
  const setCurrentLinkedInPost = useStore(s => s.setCurrentLinkedInPost)
  const setBulkProgress = useStore(s => s.setBulkProgress)
  const setIntelligenceResults = useStore(s => s.setIntelligenceResults)
  const theme = useStore(s => s.theme)
  const BACKEND_URL = useStore(s => s.BACKEND_URL)
  const setTheme = useStore(s => s.setTheme)

  useEffect(() => { 
    checkAuth() 
  }, [checkAuth])

  useEffect(() => {
    if (user) {
      const eventSource = new EventSource(`${BACKEND_URL}/api/stream`, { withCredentials: true })
      
      eventSource.onopen = () => { 
        console.log("SSE Connection Established")
        setSseConnected(true) 
      }
      
      eventSource.onerror = (err) => { 
        console.error("SSE Connection Error", err)
        setSseConnected(false) 
        eventSource.close()
        setTimeout(() => checkAuth(), 3000) 
      }
      
      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data)
        switch(data.type) {
            case 'RECOVERY':
              const s = data.state
              console.log(`\x1b[35m[SSE RECOVERY]\x1b[0m Job: ${s.id} | Status: ${s.status} | Progress: ${s.currentChunk}/${s.totalChunks}`);
              if (s.mode === 'intelligence') {
                setIsIntelligenceRunning(s.status === 'RUNNING')
                if (s.consolidated) setIntelligenceResults(s.consolidated)
              } else if (s.mode === 'cover-letter') {
                setIsCoverLetterRunning(s.status === 'RUNNING')
                if (s.markdown) setCurrentCoverLetter(s.markdown)
                else setCurrentCoverLetter('')
              } else if (s.mode === 'linkedin-post') {
                setIsLinkedInRunning(s.status === 'RUNNING')
                if (s.markdown) setCurrentLinkedInPost(s.markdown)
                else setCurrentLinkedInPost('')
              } else {
                setIsResumeRunning(s.status === 'RUNNING')
                if (s.markdown) setCurrentMarkdown(s.markdown)
                else setCurrentMarkdown('')
                if (s.totalChunks) setBulkProgress({ ...useStore.getState().bulkProgress, current: s.currentChunk || 0, total: s.totalChunks, phase: s.phase || 'Recovering...' })
              }
              break
           case 'START':
             if (data.job.mode === 'intelligence') {
                setIsIntelligenceRunning(true)
                setIntelligenceResults(null)
              } else if (data.job.mode === 'cover-letter') {
                 setIsCoverLetterRunning(true)
                 setCurrentCoverLetter('')
              } else if (data.job.mode === 'linkedin-post') {
                 setIsLinkedInRunning(true)
                 setCurrentLinkedInPost('')
              } else {
                 setIsResumeRunning(true)
                setCurrentMarkdown('')
             }
             setBulkProgress({ current: 0, total: data.job.totalChunks, phase: 'idle' })
             break
           case 'RECOVERY':
              if (data.state.status === 'RUNNING') {
                if (data.state.id.includes(':intelligence')) setIsIntelligenceRunning(true)
                 else if (data.state.id.includes(':cover-letter')) setIsCoverLetterRunning(true)
                 else if (data.state.id.includes(':linkedin-post')) setIsLinkedInRunning(true)
                 else setIsResumeRunning(true)
                setBulkProgress({ 
                   current: data.state.currentChunk || 0, 
                   total: data.state.totalChunks || 0, 
                   phase: data.state.phase || 'idle' 
                })
              }
              break
           case 'PHASE_CHANGE':
             setBulkProgress({ ...useStore.getState().bulkProgress, phase: data.phase })
             break
           case 'MD_CHUNK':
              if (data.mode === 'cover-letter') {
                 setCurrentCoverLetter((prev: string) => prev + data.chunk)
              } else if (data.mode === 'linkedin-post') {
                 setCurrentLinkedInPost((prev: string) => prev + data.chunk)
              } else {
                 setCurrentMarkdown((prev: string) => prev + data.chunk)
              }
             break
           case 'CHUNK_COMPLETE':
             setBulkProgress({ ...useStore.getState().bulkProgress, current: data.index, total: data.total })
             break
            case 'CONSOLIDATED':
              if (data.mode === 'intelligence' && (data.data.refinedProjects || data.data.projects)) {
                 setIntelligenceResults(data.data)
              }
              break
            case 'COMPLETE':
                if (data.markdown) {
                   if (data.mode === 'cover-letter') setCurrentCoverLetter(data.markdown)
                   else if (data.mode === 'linkedin-post') setCurrentLinkedInPost(data.markdown)
                   else setCurrentMarkdown(data.markdown)
                }
               if (data.mode === 'intelligence' && data.data) {
                  setIntelligenceResults(data.data)
               }
                setIsResumeRunning(false)
                setIsIntelligenceRunning(false)
                setIsCoverLetterRunning(false)
                setIsLinkedInRunning(false)
               toast.success("Job Synchronized Successfully")
               break
           case 'ERROR':
              setIsIntelligenceRunning(false)
              setIsResumeRunning(false)
              setIsCoverLetterRunning(false)
              setIsLinkedInRunning(false)
             toast.error(data.error)
             break
        }
      }
      return () => eventSource.close()
    }
  }, [user, BACKEND_URL, checkAuth, setSseConnected, setIsIntelligenceRunning, setIsResumeRunning, setIsCoverLetterRunning, setIsLinkedInRunning, setCurrentMarkdown, setCurrentCoverLetter, setCurrentLinkedInPost, setBulkProgress, setIntelligenceResults])

  useEffect(() => {
    const root = window.document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    }
  }, [theme])

  return (
    <div className="relative min-h-screen text-primary overflow-hidden transition-colors duration-300 bg-bg-color">
      <Toaster 
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: theme === 'dark' ? 'rgba(12, 12, 14, 0.95)' : '#ffffff',
            color: theme === 'dark' ? '#ffffff' : '#0c0c0e',
            borderRadius: '1rem',
            fontSize: '0.75rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            padding: '12px 24px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
          }
        }}
      />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="h-screen w-full flex">
          <Routes>
            <Route path="/" element={<Navigate to="/explorer" />} />
            <Route 
              path="/login" 
              element={user ? <Navigate to="/explorer" /> : <Login BACKEND_URL={BACKEND_URL} theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />} 
            />
            <Route 
              path="/explorer" 
              element={!user ? <Navigate to="/login" /> : <Explorer />} 
            />
            <Route 
              path="/resume" 
              element={!user ? <Navigate to="/login" /> : <ResumeMaker />} 
            />
            <Route 
              path="/cover-letter" 
              element={!user ? <Navigate to="/login" /> : <CoverLetter />} 
            />
            <Route 
              path="/linkedin-post" 
              element={!user ? <Navigate to="/login" /> : <LinkedInPost />} 
            />
            <Route 
              path="/settings" 
              element={!user ? <Navigate to="/login" /> : <Settings />} 
            />
          </Routes>
          {user && <ApiKeyModal />}
        </div>
      </BrowserRouter>
    </div>
  )
}

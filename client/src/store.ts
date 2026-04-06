import { create } from 'zustand'
import axios from 'axios'
import { toast } from 'react-hot-toast'

axios.defaults.withCredentials = true;

export interface Repository {
  id: number
  name: string
  description: string
  full_name: string
  updated_at: string
}

export interface EduEntry { degree: string; institution: string; period: string }
export interface ExpEntry { role: string; company: string; period: string; description: string }
export interface CertEntry { name: string; issuer: string; date: string }

interface AppState {
  user: any
  repos: Repository[]
  search: string
  jobProfile: { title: string; description: string; seniority: string; companyName: string; hiringManager: string; researchContext: string }
  staticInfo: { name: string; email: string; links: string; softSkills: string }
  eduList: EduEntry[]
  expList: ExpEntry[]
  certList: CertEntry[]
  selectedRepoIds: Set<number>
  bulkProgress: { current: number; total: number; phase: string }
  markdownResume: { [jobId: string]: string } // Store resume by job ID if needed, but for now simple
  isCoverLetterRunning: boolean
  currentMarkdown: string
  currentCoverLetter: string
  sseConnected: boolean
  isIntelligenceRunning: boolean
  isResumeRunning: boolean
  intelligenceResults: any
  theme: 'light' | 'dark'
  intelModel: string
  resumeModel: string
  humanize: boolean
  availableModels: { id: string, name: string }[]
  BACKEND_URL: string

  setUser: (user: any) => void
  setRepos: (repos: Repository[]) => void
  setSearch: (search: string) => void
  setJobProfile: (profile: Partial<AppState['jobProfile']>) => void
  setStaticInfo: (info: Partial<AppState['staticInfo']>) => void
  setEduList: (list: EduEntry[]) => void
  setExpList: (list: ExpEntry[]) => void
  setCertList: (list: CertEntry[]) => void
  toggleRepoSelection: (id: number) => void
  setSelectedRepoIds: (ids: Set<number>) => void
  setBulkProgress: (progress: any) => void
  setCurrentMarkdown: (md: string | ((prev: string) => string)) => void
  setCurrentCoverLetter: (md: string | ((prev: string) => string)) => void
  setSseConnected: (status: boolean) => void
  setIsIntelligenceRunning: (status: boolean) => void
  setIsResumeRunning: (status: boolean) => void
  setIsCoverLetterRunning: (status: boolean) => void
  setIntelligenceResults: (res: any) => void
  setTheme: (theme: 'light' | 'dark') => void
  setIntelModel: (model: string) => void
  setResumeModel: (model: string) => void
  setHumanize: (v: boolean) => void

  checkAuth: () => Promise<void>
  fetchRepos: (force?: boolean) => Promise<void>
  saveProfile: () => Promise<void>
  startResumeJob: (mode?: 'resume' | 'intelligence') => Promise<void>
  startCoverLetterJob: () => Promise<void>
  stopResumeJob: (mode?: string) => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  repos: [],
  search: '',
  jobProfile: { title: '', description: '', seniority: 'Senior', companyName: '', hiringManager: '', researchContext: '' },
  staticInfo: { name: '', email: '', links: '', softSkills: '' },
  eduList: [{ degree: '', institution: '', period: '' }],
  expList: [{ role: '', company: '', period: '', description: '' }],
  certList: [{ name: '', issuer: '', date: '' }],
  selectedRepoIds: new Set(),
  bulkProgress: { current: 0, total: 0, phase: 'idle' },
  currentMarkdown: '',
  currentCoverLetter: '',
  markdownResume: {},
  sseConnected: false,
  isIntelligenceRunning: false,
  isResumeRunning: false,
  isCoverLetterRunning: false,
  intelligenceResults: null,
  theme: (localStorage.getItem('repo-resume-theme') as 'light' | 'dark') || 'dark',
  intelModel: 'meta/llama-3.3-70b-instruct',
  resumeModel: 'meta/llama-3.3-70b-instruct',
  humanize: false,
  availableModels: [
    { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (Balanced)' },
    { id: 'deepseek-ai/deepseek-v3.1', name: 'DeepSeek v3.1 (Reasoning)' },
    { id: 'qwen/qwen3.5-122b-a10b', name: 'Qwen 3.5 120B (Thinking)' },
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Logic)' },
    { id: 'minimaxai/minimax-m2.5', name: 'MiniMax M2.5 (Fast)' },
    { id: 'qwen/qwen2.5-7b-instruct', name: 'Qwen 2.5 7B' },
    { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
    { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B v0.3' },
    { id: 'rakuten/rakutenai-7b-chat', name: 'Rakuten 7B' }
  ],
  BACKEND_URL: (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001',

  setUser: (user) => set({ user }),
  setRepos: (repos) => set({ repos }),
  setSearch: (search) => set({ search }),
  setJobProfile: (jobProfile) => set({ jobProfile: { ...get().jobProfile, ...jobProfile } }),
  setStaticInfo: (staticInfo) => set({ staticInfo: { ...get().staticInfo, ...staticInfo } }),
  setEduList: (eduList) => set({ eduList }),
  setExpList: (expList) => set({ expList }),
  setCertList: (certList) => set({ certList }),
  setSelectedRepoIds: (selectedRepoIds) => set({ selectedRepoIds }),
  toggleRepoSelection: (id) => {
    const next = new Set(get().selectedRepoIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    set({ selectedRepoIds: next })
  },
  setBulkProgress: (bulkProgress) => set({ bulkProgress }),
  setCurrentMarkdown: (md) => {
    if (typeof md === 'function') {
      set({ currentMarkdown: md(get().currentMarkdown) })
    } else {
      set({ currentMarkdown: md })
    }
  },
  setCurrentCoverLetter: (md) => {
    if (typeof md === 'function') {
      set({ currentCoverLetter: md(get().currentCoverLetter) })
    } else {
      set({ currentCoverLetter: md })
    }
  },
  setIsIntelligenceRunning: (isIntelligenceRunning) => set({ isIntelligenceRunning }),
  setIsResumeRunning: (isResumeRunning) => set({ isResumeRunning }),
  setIsCoverLetterRunning: (isCoverLetterRunning) => set({ isCoverLetterRunning }),
  setIntelligenceResults: (intelligenceResults) => set({ intelligenceResults }),
  setTheme: (theme) => set({ theme }),
  setIntelModel: (intelModel) => set({ intelModel }),
  setResumeModel: (model) => set({ resumeModel: model }),
  setHumanize: (v: boolean) => set({ humanize: v }),
  setSseConnected: (v) => set({ sseConnected: v }),

  checkAuth: async () => {
    try {
      const { BACKEND_URL } = get()
      const { data } = await axios.get(`${BACKEND_URL}/auth/me`)
      set({ user: data })
      if (data.profile) {
        const { eduList, expList, certList, seniority, ...staticInfo } = data.profile
        if (eduList) set({ eduList })
        if (expList) set({ expList })
        if (certList) set({ certList })
        if (seniority) set({ jobProfile: { ...get().jobProfile, seniority } })
        set({ staticInfo: { ...get().staticInfo, ...staticInfo } })
      }
      get().fetchRepos()
    } catch (err) { set({ user: null }) }
  },

  fetchRepos: async (force = false) => {
    const { BACKEND_URL } = get()
    if (!force) {
      const cached = localStorage.getItem('repo_cache')
      if (cached) {
        set({ repos: JSON.parse(cached) })
        return
      }
    }
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/repos${force ? '?refresh=true' : ''}`)
      set({ repos: data })
      localStorage.setItem('repo_cache', JSON.stringify(data))
    } catch (err) { console.error("Fetch repos failed") }
  },

  saveProfile: async () => {
    const { BACKEND_URL, staticInfo, eduList, expList, certList, jobProfile } = get()
    try {
      await axios.post(`${BACKEND_URL}/api/profile`, {
        ...staticInfo,
        eduList,
        expList,
        certList,
        seniority: jobProfile.seniority
      })
      toast.success("Career Intelligence Saved Permanently!")
    } catch (err) { toast.error("Failed to save profile") }
  },

  startResumeJob: async (mode = 'resume') => {
    const { repos, selectedRepoIds, jobProfile, staticInfo, BACKEND_URL, intelModel, resumeModel, humanize, eduList, expList, certList } = get()
    const reposToAnalyze = selectedRepoIds.size === 0 ? [] : repos.filter(r => selectedRepoIds.has(r.id))
    const enrichedStaticInfo = {
      ...staticInfo,
      softSkills: staticInfo.softSkills || 'Not specified',
      education: eduList.filter(e => e.degree || e.institution).map(e => `${e.degree} | ${e.institution} | ${e.period}`).join('\n'),
      certifications: certList.filter(c => c.name).map(c => `${c.name} | ${c.issuer} | ${c.date}`).join('\n'),
      jobHistory: expList.filter(e => e.role || e.company).map(e => `${e.role} | ${e.company} | ${e.period}${e.description ? ' | ' + e.description : ''}`).join('\n'),
    }
    try {
      const endpoint = mode === 'intelligence' ? '/api/analyze-intelligence' : '/api/generate-resume'
      const payload = mode === 'intelligence'
        ? { repos: reposToAnalyze, mode, intelModel }
        : { repos: reposToAnalyze, jobProfile, staticInfo: enrichedStaticInfo, mode, resumeModel, humanize }
      await axios.post(`${BACKEND_URL}${endpoint}`, payload)
    } catch (err: any) { toast.error("Failed to start job") }
  },

  startCoverLetterJob: async () => {
    const { repos, selectedRepoIds, jobProfile, staticInfo, BACKEND_URL, resumeModel, humanize, eduList, expList, certList } = get()
    const reposToAnalyze = selectedRepoIds.size === 0 ? [] : repos.filter(r => selectedRepoIds.has(r.id))
    const enrichedStaticInfo = {
      ...staticInfo,
      softSkills: staticInfo.softSkills || 'Not specified',
      education: eduList.filter(e => e.degree || e.institution).map(e => `${e.degree} | ${e.institution} | ${e.period}`).join('\n'),
      certifications: certList.filter(c => c.name).map(c => `${c.name} | ${c.issuer} | ${c.date}`).join('\n'),
      jobHistory: expList.filter(e => e.role || e.company).map(e => `${e.role} | ${e.company} | ${e.period}${e.description ? ' | ' + e.description : ''}`).join('\n'),
    }
    try {
      set({ isCoverLetterRunning: true, currentCoverLetter: '' })
      await axios.post(`${BACKEND_URL}/api/generate-cover-letter`, { 
        repos: reposToAnalyze, 
        jobProfile, 
        staticInfo: enrichedStaticInfo, 
        resumeModel, 
        humanize 
      })
    } catch (err: any) { 
      set({ isCoverLetterRunning: false })
      toast.error("Failed to start cover letter job") 
    }
  },

  stopResumeJob: async (mode = 'resume') => {
    const { BACKEND_URL } = get()
    try {
      await axios.post(`${BACKEND_URL}/api/stop-resume`)
      set({ isResumeRunning: false, isIntelligenceRunning: false, isCoverLetterRunning: false })
      toast.success("Synthesis Termination Sent")
    } catch (err) {
      toast.error("Stop Command Failed")
    }
  }
}))

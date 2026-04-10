import { useState } from 'react'
import { useStore } from '../store'
import { Key, Shield, ArrowRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function ApiKeyModal() {
  const { nvidiaApiKey, setNvidiaSettings } = useStore()
  const [key, setKey] = useState('')
  const [isOpen, setIsOpen] = useState(!nvidiaApiKey)

  const handleSave = () => {
    if (!key.startsWith('nvapi-')) {
       // Optional: add validation
    }
    setNvidiaSettings(key, [])
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-lg bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] p-10 shadow-[0_32px_128px_rgba(0,0,0,0.8)] relative overflow-hidden"
        >
          {/* Background Glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-fuchsia-500/10 blur-[100px] rounded-full" />

          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center text-center mb-10">
            <div className="h-20 w-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-6 border border-indigo-500/20 shadow-xl">
              <Shield size={40} />
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter text-white mb-3">NVIDIA <span className="text-indigo-500">Gateway</span></h2>
            <p className="text-sm text-secondary font-medium leading-relaxed max-w-[300px]">
              To begin your career synthesis, please enter your NVIDIA NIM API key. 
              <span className="block mt-1 opacity-50 underline cursor-pointer">Where do I find this?</span>
            </p>
          </div>

          <div className="space-y-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-indigo-500 transition-colors">
                <Key size={18} />
              </div>
              <input 
                type="password"
                placeholder="nvapi-...................................."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-16 pr-6 py-5 text-sm font-medium text-white placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            <button 
              onClick={handleSave}
              disabled={!key}
              className="w-full flex items-center justify-between bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black italic tracking-tighter px-8 py-5 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 group"
            >
              <span>INITIALIZE IDENTITY</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            
            <p className="text-center text-[10px] text-white/20 font-bold uppercase tracking-[0.2em]">
              Encrypted with AES-256 for your security
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

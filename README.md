# 🚀 RepoResume — AI-Driven Portfolio & Resume Architect

RepoResume is a powerful, ATS-optimized resume generation platform that transforms your raw GitHub repository data into high-impact, professional engineering resumes. It uses advanced RAG (Retrieval-Augmented Generation) and AI consolidation to distill your code into quantifiable results.

![RepoResume Banner](https://img.shields.io/badge/RepoResume-v1.0.0-blue?style=for-the-badge&logo=github)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20AI-green?style=for-the-badge)

---

## ✨ Key Features

- **🧠 Deep Repository Context Extraction**: Automatically crawls your public/private GitHub repositories to understand technical implementation details.
- **🎯 Intelligent Selection & Consolidation**: Uses AI to filter and pick the top 3-4 most relevant projects for each specific job application.
- **📊 ATS (Applicant Tracking System) Optimization**: Mandates keywords, mirrors job titles, and uses professional, parseable formatting.
- **⚡ Real-Time Streaming UI**: Built with Server-Sent Events (SSE) for live-streaming resume generation with progress indicators.
- **🛠️ Dynamic Structured Entry Builders**: Infinite list builders for Education, Work Experience (with "What you did" descriptions), and Certifications.
- **🔒 Persistent Profile Security**: Secure GitHub OAuth authentication with permanent profile storage.

---

## 🛠️ Technology Stack

- **Frontend**: React (Vite), Tailwind CSS, Framer Motion (Animations), Lucide (Icons).
- **Backend**: Node.js, Express, Passport.js (GitHub Strategy).
- **AI Engine**: NVIDIA AI-Inference (Llama-3.3-70b-instruct) for RAG and narrative generation.
- **Storage**: `profiles.json` (Structured User Profiles), `repo-cache.json` (Optimized Repository Knowledge).

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- GitHub OAuth App (Client ID & Secret)
- NVIDIA AI API Key (or OpenAI-compatible endpoint)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/RA-L-PH/RepoResume.git

# Install root dependencies
npm install

# Setup Client
cd client && npm install

# Setup Server
cd ../server && npm install
```

### 3. Environment Configuration
Create a `.env` file in the `/server` directory:
```env
GITHUB_CLIENT_ID=your_id
GITHUB_CLIENT_SECRET=your_secret
NVIDIA_API_KEY=your_key
SESSION_SECRET=your_random_secret
CALLBACK_URL=http://localhost:3001/auth/github/callback
FRONTEND_URL=http://localhost:5173
```

### 4. Running the App
In the root directory, run:
```bash
npm run dev
```
- **Client**: `http://localhost:5173`
- **Server**: `http://localhost:3001`

---

## 📐 How it Works (The Pipeline)

1. **Authentication**: Sign in via GitHub to grant repository access.
2. **Analysis**: You select repos; the engine fetches codebases and creates a "technical summary".
3. **Consolidation**: The AI analyzes the summaries against your target JD and selects the **Top 4 heavy-hitters**.
4. **Generation**: A final executive audit creates the Markdown resume with quantified bullets and ATS-aligned headings.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

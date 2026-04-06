const axios = require('axios');

async function runIntelligenceEngine(ctx) {
  const { userId, accessToken, repos, mode, broadcast, nvidia, cache, saveCache, job, callAI, intelModel, staticInfo } = ctx;
  const authHeaders = { Authorization: `token ${accessToken}` };
  
  // Helper to determine extra body based on model
  const getExtra = (m) => {
    if (m.includes('deepseek-v3')) return { extra_body: { chat_template_kwargs: { thinking: true } } };
    if (m.includes('qwen3.5')) return { extra_body: { chat_template_kwargs: { enable_thinking: true } } };
    return {};
  };

  const modelToUse = intelModel || "meta/llama-3.3-70b-instruct";
  const extraParams = getExtra(modelToUse);
  
  try {
    job.phase = 'UNDERSTANDING_REPOS';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'UNDERSTANDING_REPOS' });

    job.totalChunks = Math.ceil(repos.length / 8);
    job.phase = 'SUMMARIZING_CONTENT';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'SUMMARIZING_CONTENT' });

    // Stage 1: Knowledge Acquisition (Process chunks in parallel)
    const newReposToExtract = repos.filter(r => !cache[r.full_name]);
    if (newReposToExtract.length > 0) {
      console.log(`\x1b[34m[KNOWLEDGE ACQUISITION]\x1b[0m Extracting basic context for ${newReposToExtract.length} new repos in parallel...`);
      const chunks = [];
      for (let i = 0; i < newReposToExtract.length; i += 8) {
        chunks.push(newReposToExtract.slice(i, i + 8));
      }

      await Promise.all(chunks.map(async (chunk, idx) => {
        const chunkDocs = await Promise.all(chunk.map(async (repo) => {
          const [owner, name] = repo.full_name.split('/');
          try {
            const { data: repoInfo } = await axios.get(`https://api.github.com/repos/${owner}/${name}`, { headers: authHeaders });
            const { data: langData } = await axios.get(`https://api.github.com/repos/${owner}/${name}/languages`, { headers: authHeaders }).catch(() => ({ data: {} }));
            const languages = Object.keys(langData).join(', ');
            
            const { data: treeData } = await axios.get(`https://api.github.com/repos/${owner}/${name}/git/trees/${repoInfo.default_branch}?recursive=1`, { headers: authHeaders });
            
            // Summarize file structure (top levels + key directories)
            const treeSummary = treeData.tree
              .filter(f => f.path.split('/').length <= 2)
              .map(f => `${f.type === 'tree' ? '[DIR] ' : '[FILE] '}${f.path}`)
              .slice(0, 50)
              .join('\n');

            const docFiles = treeData.tree.filter(f => {
              const p = f.path.toLowerCase();
              const isDoc = p.endsWith('.md') || p.endsWith('.txt') || p.endsWith('.text') || p.endsWith('.markdown');
              const isConfig = ['package.json', 'requirements.txt', 'go.mod', 'cargo.toml', 'pom.xml', 'gemfile', 'composer.json', 'dockerfile'].includes(p);
              const isCode = (p.startsWith('src/') || p.startsWith('lib/') || p.startsWith('app/')) && 
                             (p.endsWith('.js') || p.endsWith('.ts') || p.endsWith('.py') || p.endsWith('.go') || p.endsWith('.java')) &&
                             !p.includes('test') && !p.includes('spec');
              return f.type === 'blob' && (isDoc || isConfig || isCode);
            }).slice(0, 20); // Scale up slightly to 20 files
            
            let combined = `### REPO: ${repo.name}\n- GitHub Description: ${repoInfo.description || 'No description provided'}\n- Primary Language: ${repoInfo.language || 'Unknown'}\n- Languages Used: ${languages}\n- Topics: ${(repoInfo.topics || []).join(', ')}\n\nFILE STRUCTURE:\n${treeSummary}\n`;
            
            if (docFiles.length > 0) {
              combined += "\nDOCUMENTATION CONTENT:\n";
              for (const file of docFiles) {
                try {
                  const { data: content } = await axios.get(`https://api.github.com/repos/${owner}/${name}/contents/${file.path}`, { 
                    headers: { ...authHeaders, Accept: 'application/vnd.github.raw' } 
                  });
                  combined += `\n- ${file.path}:\n${content.slice(0, 1500)}\n`;
                } catch (e) { }
              }
            } else {
              combined += "\n[NOTE: No documentation files found. Summary based on GitHub metadata.]\n";
            }
            return combined;
          } catch (err) { return null; }
        }));

        const docString = chunkDocs.filter(d => d).join("\n\n---\n\n");
        if (docString) {
          const basicPrompt = `You are a Senior Technical Architect and Open Source Researcher.
          Extract comprehensive technical summaries from these repositories based on documentation, languages, and FILE STRUCTURE.
          
          Focus on:
          1. Architectural Design & Patterns (e.g., DDD, Microservices, Hexagonal Architecture, Design Patterns).
          2. Engineering Implementation (e.g., Performance optimizations, Security hardening, specialized algorithms, TDD).
          3. Technical Scope & Impact (e.g., Automated delivery, Cloud infrastructure, Developer tools, Library utilities).
          4. UX/UI & Frontend Excellence (e.g., Accessibility, Responsive Design, State Management, Animation frameworks).
          
          Analyze the 'FILE STRUCTURE' and 'Languages Used' to infer practical project requirements and developer skill level.
          
          FORMAT each 'bullets' item as "Technical Context: Clear Achievement/Implementation". 
          Example: "SCALABLE ARCHITECTURE: Optimized database queries for a distributed ledger system, reducing latency by 40%."
          
          CRITICAL: Use the EXACT 'repo.name' provided for 'projectName'. DO NOT rename. 
          Respond ONLY with JSON array 'projects': [{ projectName, oneLineSummary, technicalSummary, techStack: string[], bullets: string[] }].`;
          if (job.status === 'STOPPED') return;
          const basicCompletion = await callAI([{ role: "system", content: basicPrompt }, { role: "user", content: docString }], {
            model: modelToUse,
            response_format: { type: "json_object" },
            ...extraParams
          });
          if (job.status === 'STOPPED') return;
          const parsed = JSON.parse(basicCompletion.choices[0].message.content);
          const summaries = (parsed.projects || parsed.summaries || parsed || []);
          (Array.isArray(summaries) ? summaries : [summaries]).forEach(s => {
             const repoMatch = chunk.find(r => r.name.toLowerCase() === (s.projectName || s.name || "").toLowerCase());
             if (repoMatch) cache[repoMatch.full_name] = s;
          });
          await saveCache(cache);
        }
      }));
    }

    // Stage 2: Intelligence Engine (UPSCALING & REFRAMING - Concurrent Chunks)
    job.phase = 'REFRAMING_CONTENT';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'REFRAMING_CONTENT' });
    job.totalChunks = Math.ceil(repos.length / 8);

    const intelChunks = [];
    for (let i = 0; i < repos.length; i += 8) {
      intelChunks.push(repos.slice(i, i + 8));
    }

    await Promise.all(intelChunks.map(async (chunk, idx) => {
      const chunkIndex = idx + 1;
      const docString = chunk.map(repo => {
        const cachedData = cache[repo.full_name] || {};
        const points = Array.isArray(cachedData.bullets) ? cachedData.bullets.join('; ') : (cachedData.bullets || '');
        return `### REPO: ${repo.name}\n- Summary: ${cachedData.oneLineSummary || ''}\n- Technical: ${cachedData.technicalSummary || ''}\n- Points: ${points}`;
      }).join("\n\n---\n\n");

      if (docString) {
        console.log(`\x1b[32m[INTELLIGENCE REFINER]\x1b[0m Professionalizing chunk ${chunkIndex} concurrently...`);
        const sysPrompt = `You are a Senior Technical Recruiter and Career Strategist. 
        Professionalize these project descriptions into high-impact, industry-standard technical narratives.
        - Target Seniority: ${staticInfo.seniority || 'Senior'}.
        - Soft Skill Context (Integrate where relevant): ${staticInfo.softSkills || 'Collaboration, Problem Solving'}.
        
        ### STRATEGIC GUIDELINES:
        1. SENIORITY ALIGNMENT: 
           - If Junior/Intern: Focus on feature delivery, codebase navigation, and tool usage.
           - If Senior: Focus on ownership, architectural trade-offs, and mentoring signals in the code.
           - If Staff/Principal: Focus on cross-team impact, system design, and legacy refactoring.
        2. SOFT SKILL INJECTION: If a repo shows evidence of collaboration (e.g., complex PR history, large README teams) or leadership, highlight it.
        3. VERB USAGE: Use high-impact verbs: "Orchestrated", "Engineered", "Optimized", "Spearheaded".
        
        FORMAT each 'formattedFeatures' item as "TECHNICAL DOMAIN: Key Implementation Detail".
        CRITICAL: MUST KEEP the exact same 'projectName' as provided. DO NOT rename repos. 
        Respond ONLY with JSON 'projects': [{ projectName, oneLineSummary, techStack: string[], formattedFeatures: string[] }].`;

        if (job.status === 'STOPPED') return;
        const completion = await callAI([{ role: "system", content: sysPrompt }, { role: "user", content: docString }], {
          model: modelToUse,
          response_format: { type: "json_object" },
          ...extraParams
        });
        if (job.status === 'STOPPED') return;
        
        const parsed = JSON.parse(completion.choices[0].message.content);
        const summaries = (parsed.projects || parsed.summaries || parsed || []);
        job.results.push(...(Array.isArray(summaries) ? summaries : [summaries]));
        job.currentChunk++; 
        broadcast(userId, { type: 'CHUNK_COMPLETE', index: job.currentChunk, total: job.totalChunks });
      }
    }));

    // Phase: Global Portfolio Synthesis
    job.phase = 'CONSOLIDATING';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'CONSOLIDATING' });
    
    console.log(`\x1b[32m[PORTFOLIO CONSOLIDATOR]\x1b[0m Reframing entire career identity for ${staticInfo.seniority || 'Senior'} level...`);
    const consSysPrompt = `You are an AI Portfolio Strategist specializing in ${staticInfo.seniority || 'Senior'} Engineering careers. 
    Consolidate these technical projects into a unified technical profile. 
    - Integration Goal: Combine the raw technical evidence with the candidate's reported Soft Skills: [${staticInfo.softSkills || ''}].
    - Seniority Focus: ${staticInfo.seniority || 'Senior'}.
    
    ### FORMAT RULES:
    1. 'unifiedSummary': A powerful, executive-style summary (3-4 sentences) that bridges the technical breadth of the repos with the candidate's professional seniority.
    2. 'refinedProjects': The top 3-5 projects reframed to show architectural maturity.
    
    Respond ONLY with JSON: { unifiedSummary: string, refinedProjects: [{projectName, oneLineSummary, techStack: string[], formattedFeatures: string[] }] }.`;

    if (job.status === 'STOPPED') return;
    const consCompletion = await callAI([{ role: "system", content: consSysPrompt }, { role: "user", content: JSON.stringify(job.results) }], {
      model: modelToUse,
      response_format: { type: "json_object" },
      ...extraParams
    });
    if (job.status === 'STOPPED') return;
    
    job.consolidated = JSON.parse(consCompletion.choices[0].message.content);
    broadcast(userId, { type: 'CONSOLIDATED', mode: 'intelligence', data: job.consolidated });
    
    job.status = 'COMPLETED';
    broadcast(userId, { type: 'COMPLETE', mode: 'intelligence', data: job.consolidated.refinedProjects || job.results });

  } catch (error) {
    console.error(`\x1b[31m[INTEL ERROR]\x1b[0m`, error);
    job.status = 'FAILED';
    broadcast(userId, { type: 'ERROR', error: 'Intelligence analysis failed' });
  }
}

module.exports = { runIntelligenceEngine };

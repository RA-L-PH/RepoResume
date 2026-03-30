const axios = require('axios');

async function runIntelligenceEngine(ctx) {
  const { userId, accessToken, repos, mode, broadcast, nvidia, cache, saveCache, job } = ctx;
  const authHeaders = { Authorization: `token ${accessToken}` };
  
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
              const isConfig = p === 'package.json' || p === 'requirements.txt' || p === 'go.mod' || p === 'cargo.toml' || p === 'pom.xml' || p === 'gemfile' || p === 'composer.json';
              return f.type === 'blob' && (isDoc || isConfig);
            }).slice(0, 15);
            
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
          const basicPrompt = `You are a Senior Technical Architect and Librarian. 
          Extract DEEP technical summaries from these repositories based on documentation, languages, and FILE STRUCTURE.
          
          Focus on:
          1. Architectural Complexity (e.g., Microservices clusters, Event-driven pipes, Distributed ledger).
          2. Engineering Patterns (e.g., DDD, hexagonal architecture, Specialized algorithms, TDD/CI-CD setup).
          3. Technical Impact (e.g., Latency optimization, Security hardening, Infrastructure-as-Code).
          
          Analyze the 'FILE STRUCTURE' and 'Languages Used' to infer project requirements and codebase depth.
          
          FORMAT each 'bullets' item as "Short Technical Label: Full Descriptive Achievement". 
          Example: "SECURE ARCHITECTURE: Optimized system reliability and eliminated critical technical debt via micro-segmentation."
          
          CRITICAL: Use the EXACT 'repo.name' provided for 'projectName'. DO NOT rename. 
          Respond ONLY with JSON array 'projects': [{ projectName, oneLineSummary, technicalSummary, techStack: string[], bullets: string[] }].`;
          const basicCompletion = await nvidia.chat.completions.create({
            model: "meta/llama-3.3-70b-instruct",
            messages: [{ role: "system", content: basicPrompt }, { role: "user", content: docString }],
            response_format: { type: "json_object" }
          });
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
        const sysPrompt = `You are a Principal Engineering Resume Strategist. 
        RE-FRAME these project descriptions into high-impact, "Senior/Principal" level narratives.
        - Emphasize "Lead", "Architected", "Orchestrated", and "Engineered".
        
        FORMAT each 'formattedFeatures' item as "CATCHY TECHNICAL TITLE: High-impact Description".
        Example: "CLOUD-NATIVE DELIVERY: Orchestrated a multi-region deployment pipeline for 2.4k developers."
        
        CRITICAL: MUST KEEP the exact same 'projectName' as provided. DO NOT rename repos. 
        Respond ONLY with JSON 'projects': [{ projectName, oneLineSummary, techStack: string[], formattedFeatures: string[] }].`;

        const completion = await nvidia.chat.completions.create({
          model: "meta/llama-3.3-70b-instruct",
          messages: [{ role: "system", content: sysPrompt }, { role: "user", content: docString }],
          response_format: { type: "json_object" }
        });
        
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

    const consSysPrompt = `You are an AI Portfolio Strategist. Consolidate these technical projects into a unified technical profile. Focus on core architectural strengths and technical diversity. Respond ONLY with JSON: { unifiedSummary: string, refinedProjects: [{projectName, oneLineSummary, techStack: string[], formattedFeatures: string[] }] }.`;

    const consCompletion = await nvidia.chat.completions.create({
      model: "meta/llama-3.3-70b-instruct",
      messages: [{ role: "system", content: consSysPrompt }, { role: "user", content: JSON.stringify(job.results) }],
      response_format: { type: "json_object" }
    });
    
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

const axios = require('axios');

async function runResumeEngine(ctx) {
  const { userId, accessToken, repos, mode, broadcast, nvidia, cache, saveCache, job, jobProfile, staticInfo, loadProfiles } = ctx;
  const authHeaders = { Authorization: `token ${accessToken}` };

  try {
    const profiles = await loadProfiles();
    const savedProfile = profiles[userId] || Object.values(profiles).find(p => p.email === staticInfo.email) || {};

    // Build the high-quality blocks from structured profile data if available
    const eduList = savedProfile.eduList || [];
    const expList = savedProfile.expList || [];
    const certList = savedProfile.certList || [];

    const educationBlock = eduList.length
      ? eduList.map(e => `#### ${e.degree}\n${e.institution}${e.period ? ' | ' + e.period : ''}`).join('\n\n')
      : (staticInfo.education || '').trim();

    const experienceBlock = expList.length
      ? expList.map(e => {
          const header = `**${e.role}** | ${e.company} | ${e.period}`;
          const formattedDesc = (e.description || '')
            .split('\n')
            .map(line => line.trim().startsWith('•') || line.trim().startsWith('-') ? `  ${line.trim()}` : `  • ${line.trim()}`)
            .join('\n');
          return `${header}\n${formattedDesc}`;
        }).join('\n\n')
      : (staticInfo.jobHistory || '').trim();

    const certBlock = certList.length
      ? certList.map(c => `- **${c.name}** | ${c.issuer} | ${c.date}`).join('\n')
      : (staticInfo.certifications || '').trim();

    let finalRepos = repos;

    // AI Auto-Selection Logic
    if (ctx.autoSelect) {
      job.phase = 'SELECTING_PROJECTS';
      broadcast(userId, { type: 'PHASE_CHANGE', phase: 'SELECTING_PROJECTS' });
      
      const repoMeta = repos.map(r => {
        const cached = cache[r.full_name] || {};
        return { 
          id: r.id, 
          name: r.name, 
          description: r.description,
          primaryLanguage: r.language || 'Unknown',
          topics: (r.topics || []).join(', '),
          oneLineSummary: cached.oneLineSummary || '',
          techStack: cached.techStack || [],
          technicalSummary: cached.technicalSummary || ''
        };
      });

      const selectionCompletion = await nvidia.chat.completions.create({
        model: "meta/llama-3.3-70b-instruct",
        messages: [{
          role: "system",
          content: `You are a technical recruiter. Select the TOP 12 MOST RELEVANT repositories from this JSON.
          Job Profile: ${jobProfile.title}
          JD: ${jobProfile.description}
          
          Use the 'oneLineSummary', 'techStack', 'technicalSummary', 'primaryLanguage', and 'topics' to judge technical depth and relevance.
          
          Respond ONLY with a JSON array of repository IDs.`
        }, { role: "user", content: JSON.stringify(repoMeta) }],
        response_format: { type: "json_object" }
      });
      
      const parsedSelection = JSON.parse(selectionCompletion.choices[0].message.content);
      const selectedIds = Array.isArray(parsedSelection) ? parsedSelection : (parsedSelection.selectedIds || parsedSelection.ids || Object.values(parsedSelection)[0]);
      finalRepos = repos.filter(r => selectedIds.includes(r.id));
      console.log(`\x1b[34m[AUTO-SELECT]\x1b[0m Selected ${finalRepos.length} repos for mirroring.`);
    }

    job.totalChunks = Math.ceil(finalRepos.length / 8);
    job.phase = 'SUMMARIZING_CONTENT';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'SUMMARIZING_CONTENT' });

    const chunks = [];
    for (let i = 0; i < finalRepos.length; i += 8) {
      chunks.push(finalRepos.slice(i, i + 8));
    }

    await Promise.all(chunks.map(async (chunk, idx) => {
      const chunkIndex = idx + 1;
      const chunkDocs = await Promise.all(chunk.map(async (repo) => {
        const cachedData = cache[repo.full_name] || {};
        const points = Array.isArray(cachedData.bullets) ? cachedData.bullets.join('; ') : (cachedData.bullets || '');
        if (cache[repo.full_name]) {
           return { 
             type: 'CACHED_SOURCE', 
             combined: `### REPO: ${repo.name} (Source: CACHE)\n- Summary: ${cachedData.oneLineSummary || ''}\n- Technical: ${cachedData.technicalSummary || ''}\n- Points: ${points}\n`
           };
        }
        
        const [owner, name] = repo.full_name.split('/');
        try {
          const repoRes = await axios.get(`https://api.github.com/repos/${owner}/${name}`, { headers: authHeaders });
          const repoInfo = repoRes.data;
          const treeRes = await axios.get(`https://api.github.com/repos/${owner}/${name}/git/trees/${repoInfo.default_branch}?recursive=1`, { headers: authHeaders });
          const treeData = treeRes.data;
          
          const treeSummary = treeData.tree
            .filter(f => f.path.split('/').length <= 2)
            .map(f => `${f.type === 'tree' ? '[DIR] ' : '[FILE] '}${f.path}`)
            .slice(0, 30)
            .join('\n');

          const docFiles = treeData.tree.filter(f => {
            const p = f.path.toLowerCase();
            const isDoc = p.endsWith('.md') || p.endsWith('.txt') || p.endsWith('.text');
            const isConfig = p === 'package.json' || p === 'requirements.txt' || p === 'go.mod' || p === 'cargo.toml';
            return f.type === 'blob' && (isDoc || isConfig);
          }).slice(0, 10);
          
          const langRes = await axios.get(`https://api.github.com/repos/${owner}/${name}/languages`, { headers: authHeaders }).catch(() => ({ data: {} }));
          const languages = Object.keys(langRes.data).join(', ');

          let combined = `### REPO: ${repo.name} (Source: GITHUB)\n- Languages Used: ${languages}\n- Topics: ${(repoInfo.topics || []).join(', ')}\n\nFILE STRUCTURE:\n${treeSummary}\n`;
          for (const file of docFiles) {
            const { data: content } = await axios.get(`https://api.github.com/repos/${owner}/${name}/contents/${file.path}`, { 
              headers: { ...authHeaders, Accept: 'application/vnd.github.raw' } 
            });
            combined += `\n- ${file.path}:\n${content.slice(0, 1500)}\n`;
          }
          return { type: 'NEW_SOURCE', combined };
        } catch (err) { return null; }
      }));

      const docString = chunkDocs.filter(d => d).map(d => d.combined).join("\n\n---\n\n");

      if (docString) {
        console.log(`\x1b[35m[RESUME AI]\x1b[0m Processing chunk ${chunkIndex} for tailoring concurrently...`);
        // We remove the full JD from this step to prevent the AI from "bleeding" JD requirements into individual projects.
        const sysPrompt = `You are a Technical Scribe and Senior ATS Strategist.
Your task is to professionalize technical data for a ${jobProfile.title} role with MAXIMUM depth and scope.

### RULES:
1. FOCUS ON ARCHITECTURE: Highlight the "How" and "Why" of the technical decisions.
2. ATS OPTIMIZATION: Use high-impact keywords relevant to ${jobProfile.title} while staying strictly truthful to the input.
3. ENGINEERING SCOPE: Frame features as system-wide impacts rather than isolated tasks.
4. CRITICAL: Use the EXACT 'repo.name' for 'projectName'. DO NOT rename repos.

Respond ONLY with JSON array 'projects': [{projectName, oneLineSummary, technicalSummary, techStack, bullets: string[]}].`;

        const completion = await nvidia.chat.completions.create({
          model: "meta/llama-3.3-70b-instruct",
          messages: [{ role: "system", content: sysPrompt }, { role: "user", content: docString }],
          response_format: { type: "json_object" }
        });
        
        const parsed = JSON.parse(completion.choices[0].message.content);
        const summaries = (parsed.projects || parsed.summaries || parsed || []);
        const normalized = Array.isArray(summaries) ? summaries : [summaries];
        
        normalized.forEach(s => {
           const repoKey = chunk.find(r => r.name === (s.projectName || s.name))?.full_name;
           if (repoKey && !cache[repoKey]) {
             cache[repoKey] = {
               projectName: s.projectName,
               oneLineSummary: s.oneLineSummary,
               techStack: s.techStack,
               bullets: s.bullets
             };
           }
        });
        job.results.push(...normalized);
        await saveCache(cache);
      }
      job.currentChunk++;
      broadcast(userId, { type: 'CHUNK_COMPLETE', index: job.currentChunk, total: job.totalChunks });
    }));

    // Phase: Strategic Resume Tailoring
    job.phase = 'CONSOLIDATING';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'CONSOLIDATING' });

    // Get a list of actual project names to prevent naming hallucinations
    const validProjectNames = job.results.map(r => r.projectName || r.name);
    
    const consSysPrompt = `You are a World-Class Career Strategist and Senior Executive Recruiter.
    1. SELECT the 3-5 most technically complex projects from: [${validProjectNames.join(', ')}].
    2. WRITE a hyper-professional, high-impact "Professional Summary" for the candidate. 
       - Focus on architectural leadership, technical depth, and delivery impact.
       - Use action verbs and technical keywords found in the project data.
       - !!! CRITICAL !!!: DO NOT INCLUDE ANY SKILLS that are not present in the input.
    3. EXTRACT a curated "Technical Portfolio" of skills (Languages, Frameworks, Architecture, Tools).
       - !!! MANDATORY !!!: This list MUST be derived ONLY from the 'techStack' of the projects you SELECTED in step 1.
       - Do NOT include skills from projects that were in the input but not selected for the final resume.

    JD Context (FOR TONE ONLY): ${jobProfile.description}

    ### MANDATORY RULES:
    1. SELECT FROM: [${validProjectNames.join(', ')}].
    2. Output 'name' MUST match a name from the list EXACTLY.
    3. If the candidate lacks a skill, DO NOT invent it. 

    Respond ONLY with JSON: { professionalSummary: string, technicalSkills: string, projects: [{name, techStack: string[], resumeBullets: []}] }.`;

    const consCompletion = await nvidia.chat.completions.create({
      model: "meta/llama-3.3-70b-instruct",
      messages: [{ role: "system", content: consSysPrompt }, { role: "user", content: JSON.stringify(job.results) }],
      response_format: { type: "json_object" }
    });
    
    job.consolidated = JSON.parse(consCompletion.choices[0].message.content);
    broadcast(userId, { type: 'CONSOLIDATED', mode, data: job.consolidated });

    // Phase: Final Markdown Generation
    job.phase = 'GENERATING_NARRATIVE';
    job.markdown = "";
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'GENERATING_NARRATIVE' });

    const mdCompletionStream = await nvidia.chat.completions.create({
      model: "meta/llama-3.3-70b-instruct",
      messages: [
        { 
          role: "system",
          content: `You are an Executive Résumé Architect. 
Your goal is to format the provided JSON and blocks into a beautiful, professional Markdown resume.

### CRITICAL FORMATTING RULES:
1. NO HALLUCINATIONS: Do not add skills (like Java) or projects that are not in the [DATA] below.
2. EXPERIENCE SECTION: You MUST maintain the multi-line bullet structure provided in the [EXPERIENCE] block. DO NOT collapse it into a single paragraph.
3. EDUCATION SECTION: You MUST maintain the exact hierarchical structure provided in the [EDUCATION] block, including the #### headers for each degree. DO NOT ALTER.
4. TECHNICAL SKILLS: Use 'technicalSkills' from the JSON for a dedicated ## TECHNICAL SKILLS section.
5. PROJECTS: List each project from the JSON with its own ### Header in ## PROJECTS.
6. PROJECTS TECH STACK: Under each project header, add: **Technologies used:** followed by its 'techStack' array.
7. PROJECTS BULLETS: Use the 'resumeBullets' for each project.
8. HIERARCHY: # NAME -> CONTACT INFO -> ## PROFESSIONAL SUMMARY -> ## TECHNICAL SKILLS -> ## PROJECTS -> ## EXPERIENCE -> ## EDUCATION -> ## CERTIFICATIONS (ONLY IF PRESENT).
9. VERTICAL SPACE: Add empty lines between all ## Sections.
10. OMIT EMPTY SECTIONS/FIELDS: If ANY section (Certifications, Experience, Education, Projects, etc.) is empty or missing data, DO NOT generate the header or section. If 'CONTACT INFO' fields (email, links) are empty, OMIT those lines/items. NO PLACEHOLDERS.

### CANDIDATE DATA (SOURCE OF TRUTH)
[JSON DATA]:
${JSON.stringify(job.consolidated)}

[CONTACT INFO]:
${staticInfo.name || 'Engineer'}
${staticInfo.email || ''}${staticInfo.links ? ' | ' + staticInfo.links : ''}

[EXPERIENCE BLOCK - DO NOT ALTER STRUCTURE]:
${experienceBlock || ''}

[EDUCATION BLOCK - DO NOT ALTER STRUCTURE]:
${educationBlock || ''}

[CERTIFICATIONS] -> Omit if empty:
${certBlock || ''}`
        }
      ],
      stream: true
    });

    console.log(`\x1b[35m[AI STREAMING]\x1b[0m Starting Tailored Resume...`);
    for await (const chunk of mdCompletionStream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        if (job.markdown === "") console.log(`\x1b[35m[AI FIRST CHUNK]\x1b[0m ${content.slice(0, 50)}`);
        job.markdown += content;
        broadcast(userId, { type: 'MD_CHUNK', chunk: content });
      }
    }

    job.status = 'COMPLETED';
    broadcast(userId, { type: 'COMPLETE', markdown: job.markdown });
    console.log(`\x1b[32m[JOB COMPLETE]\x1b[0m Tailored Resume finished for: ${jobProfile.title}`);

  } catch (error) {
    console.error(`\x1b[31m[RESUME ERROR]\x1b[0m`, error);
    job.status = 'FAILED';
    broadcast(userId, { type: 'ERROR', error: 'Resume generation failed' });
  }
}

async function generateLatexSnippet(markdown, nvidia) {
  const sysPrompt = `You are a Principal Engineering Resume Architect and LaTeX Expert. 
  Your goal is to transform the provided Markdown resume into a high-end, premium LaTeX document that rivals executive-level engineering resumes.
  
  MANDATORY STYLISTIC RULES:
  1. Use the 'moderncv' style inspiration but implemented in a standard 'article' class for customizability.
  2. TYPOGRAPHY: Use 'helvet' or 'charter' for a professional look.
  3. COLORS: Define a custom 'Navy' or 'Slate' color for section headers.
  4. LAYOUT:
     - Header: Massive, bold name. Sub-header with contact info using custom symbols/icons (e.g., mail, linkedin, github).
     - Sections: Use horizontal rules (\\titlerule) and vertical spacing.
     - Projects/Experience: Clear hierarchy with Bold Role/Project, Italic Company/Tech, and Right-aligned Dates.
     - Columns: Use the 'multicol' package if it helps the Technical Skills section.
  5. ATOMIZED LISTS: Use 'enumitem' with 'nosep' and custom sub-bullets for technical details.
  
  TECHNICAL CONSTRAINTS:
  - Document Class: [11pt, letterpaper]{article}
  - Packages: [margin=0.6in]{geometry}, xcolor, hyperref, enumitem, titlesec, array.
  - No markdown, no backticks, no preamble text. ONLY valid LaTeX code from \\documentclass to \\end{document}.
  - Max 1 page (unless extensively detailed). Omit empty sections.
  
  Respond ONLY with the complete, compilable LaTeX code.`;

  const completion = await nvidia.chat.completions.create({
    model: "tiiuae/falcon3-7b-instruct",
    messages: [{ role: "system", content: sysPrompt }, { role: "user", content: markdown }],
  });

  return completion.choices[0].message.content.trim();
}

module.exports = { runResumeEngine, generateLatexSnippet };

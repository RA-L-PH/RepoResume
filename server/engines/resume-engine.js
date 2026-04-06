const axios = require('axios');

async function runResumeEngine(ctx) {
  const { userId, accessToken, repos, mode, broadcast, nvidia, cache, saveCache, job, jobProfile, staticInfo, loadProfiles, callAI, resumeModel } = ctx;
  const authHeaders = { Authorization: `token ${accessToken}` };
  
  const getExtra = (m) => {
    if (m.includes('deepseek-v3')) return { extra_body: { chat_template_kwargs: { thinking: true } } };
    if (m.includes('qwen3.5')) return { extra_body: { chat_template_kwargs: { enable_thinking: true } } };
    return {};
  };

  const modelToUse = resumeModel || "meta/llama-3.3-70b-instruct";
  const extraParams = getExtra(modelToUse);

  try {
    const profiles = await loadProfiles ? await loadProfiles() : [staticInfo];
    const savedProfile = Array.isArray(profiles) ? (profiles.find(p => p.email === staticInfo.email) || profiles[0]) : staticInfo;

    // Build the high-quality blocks from structured profile data
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
    if (ctx.autoSelect && repos.length > 12) {
      job.phase = 'SELECTING_PROJECTS';
      broadcast(userId, { type: 'PHASE_CHANGE', phase: 'SELECTING_PROJECTS' });
      
      const repoMeta = repos.map(r => ({ id: r.id, name: r.name, description: r.description, language: r.language }));
      const selectionCompletion = await callAI([{
        role: "system",
        content: `Select the TOP 12 repositories that best align with: ${jobProfile.title}. JD: ${jobProfile.description}. Respond ONLY with a JSON array of IDs.`
      }, { role: "user", content: JSON.stringify(repoMeta) }], {
        model: modelToUse,
        response_format: { type: "json_object" },
        ...extraParams
      });
      
      try {
        const parsedSelection = JSON.parse(selectionCompletion.choices[0].message.content);
        const selectedIds = Array.isArray(parsedSelection) ? parsedSelection : (parsedSelection.selectedIds || parsedSelection.ids || []);
        if (selectedIds.length > 0) finalRepos = repos.filter(r => selectedIds.includes(r.id));
      } catch (e) { console.error("Selection parse failed", e); }
    }

    job.totalChunks = Math.ceil(finalRepos.length / 8);
    job.phase = 'SUMMARIZING_CONTENT';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'SUMMARIZING_CONTENT' });

    const chunks = [];
    for (let i = 0; i < finalRepos.length; i += 8) chunks.push(finalRepos.slice(i, i + 8));

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const chunkIndex = idx + 1;
      const chunkDocs = await Promise.all(chunk.map(async (repo) => {
        if (cache[repo.full_name]) return { combined: `### REPO: ${repo.name}\n${JSON.stringify(cache[repo.full_name])}` };
        const [owner, name] = repo.full_name.split('/');
        try {
          const repoRes = await axios.get(`https://api.github.com/repos/${owner}/${name}`, { headers: authHeaders });
          const treeRes = await axios.get(`https://api.github.com/repos/${owner}/${name}/git/trees/${repoRes.data.default_branch}?recursive=1`, { headers: authHeaders });
          const treeSummary = treeRes.data.tree.filter(f => f.path.split('/').length <= 2).map(f => f.path).slice(0, 30).join('\n');
          const docFiles = treeRes.data.tree.filter(f => f.path.toLowerCase().endsWith('.md') || f.path === 'package.json').slice(0, 5);
          let combined = `### REPO: ${repo.name}\nSTRUCTURE:\n${treeSummary}\n`;
          for (const file of docFiles) {
            const { data } = await axios.get(`https://api.github.com/repos/${owner}/${name}/contents/${file.path}`, { headers: { ...authHeaders, Accept: 'application/vnd.github.raw' } });
            combined += `\nFILE ${file.path}:\n${data.slice(0, 1000)}\n`;
          }
          return { combined };
        } catch (err) { return null; }
      }));

      const docString = chunkDocs.filter(d => d).map(d => d.combined).join("\n\n---\n\n");
      if (docString) {
        const sysPrompt = `Analyze these repositories to extract resume intelligence for the role: "${jobProfile.title}". JD: ${jobProfile.description}.
        Respond ONLY with a JSON object: { "projects": [{ "projectName", "oneLineSummary", "techStack": [], "bullets": [] }] }`;
        const completion = await callAI([{ role: "system", content: sysPrompt }, { role: "user", content: docString }], { model: modelToUse, response_format: { type: "json_object" }, ...extraParams });
        const parsed = JSON.parse(completion.choices[0].message.content);
        const normalized = Array.isArray(parsed.projects) ? parsed.projects : (Array.isArray(parsed) ? parsed : []);
        normalized.forEach(s => {
          const rKey = chunk.find(r => r.name === (s.projectName || s.name))?.full_name;
          if (rKey) cache[rKey] = s;
        });
        job.results.push(...normalized);
        await saveCache(cache);
      }
      job.currentChunk++;
      broadcast(userId, { type: 'CHUNK_COMPLETE', index: job.currentChunk, total: job.totalChunks });
    }

    job.phase = 'CONSOLIDATING';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'CONSOLIDATING' });
    const validNames = job.results.map(r => r.projectName || r.name);
    const consPrompt = `Select the top 3-5 projects from [${validNames.join(', ')}] for role: ${jobProfile.title}. Write a summary highlighting soft skills: ${staticInfo.softSkills || ''}. Respond ONLY with JSON: { professionalSummary, technicalSkills, projects: [{name, techStack: [], resumeBullets: []}] }.`;
    const consComp = await callAI([{ role: "system", content: consPrompt }, { role: "user", content: JSON.stringify(job.results) }], { model: modelToUse, response_format: { type: "json_object" }, ...extraParams });
    
    const raw = JSON.parse(consComp.choices[0].message.content);
    job.consolidated = {
      professionalSummary: raw.professionalSummary || raw.summary || "",
      technicalSkills: Array.isArray(raw.technicalSkills) ? raw.technicalSkills.join(', ') : (raw.technicalSkills || ""),
      projects: Array.isArray(raw.projects) ? raw.projects : []
    };
    broadcast(userId, { type: 'CONSOLIDATED', mode, data: job.consolidated });

    job.phase = 'GENERATING_NARRATIVE';
    job.markdown = "";
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'GENERATING_NARRATIVE' });

    const sourceText = `
    SUMMARY: ${job.consolidated.professionalSummary}
    SKILLS: ${job.consolidated.technicalSkills}
    PROJECTS: ${job.consolidated.projects.map(p => `- ${p.name}: [${p.techStack.join(', ')}] -> ${p.resumeBullets.join('; ')}`).join('\n')}
    `;

    const mdStream = await callAI([{ 
      role: "system", 
      content: `Format this resume for: ${jobProfile.title}. JD: ${jobProfile.description}.
      ${ctx.humanize ? 'HUMANIZE: Use a narrative, personable voice.' : 'PRECISION: Use impact-heavy technical bullets.'}
      MD Structure: # NAME | CONTACT -> ## SUMMARY -> ## SKILLS -> ## PROJECTS -> ## EXPERIENCE -> ## EDUCATION.
      
      [SOURCE]: ${sourceText}
      [EXP]: ${experienceBlock}
      [EDU]: ${educationBlock}
      [ID]: ${staticInfo.name} | ${staticInfo.email} | ${staticInfo.links}
      
      CRITICAL: Use standard Markdown link formatting [link text](url) for ALL URLs (e.g. GitHub, LinkedIn, Portfolio).`
    }], { model: modelToUse, stream: true, ...extraParams });

    for await (const chunk of mdStream) {
      if (job.status === 'STOPPED') break;
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        job.markdown += content;
        broadcast(userId, { type: 'MD_CHUNK', chunk: content });
      }
    }
    if (job.status === 'STOPPED') return;

    job.status = 'COMPLETED';
    broadcast(userId, { type: 'COMPLETE', markdown: job.markdown.trim() });
  } catch (error) {
    console.error(`[RESUME ERROR]`, error);
    job.status = 'FAILED';
    broadcast(userId, { type: 'ERROR', error: 'Generation failed' });
  }
}

async function generateLatexSnippet(markdown, nvidia, callAI) {
  const sysPrompt = `Transform this Markdown resume into a premium LaTeX document. ONLY valid LaTeX code.`;
  const completion = await callAI([{ role: "system", content: sysPrompt }, { role: "user", content: markdown }], { model: "meta/llama-3.3-70b-instruct" });
  return completion.choices[0].message.content.trim();
}

module.exports = { runResumeEngine, generateLatexSnippet };

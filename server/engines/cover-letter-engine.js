const axios = require('axios');

async function runCoverLetterEngine(ctx) {
  const { userId, accessToken, repos, mode, broadcast, nvidia, job, jobProfile, staticInfo, callAI, resumeModel, humanize, apiKey } = ctx;
  const authHeaders = { Authorization: `token ${accessToken}` };
  
  const getExtra = (m) => {
    if (m.includes('deepseek-v3')) return { extra_body: { chat_template_kwargs: { thinking: true } } };
    if (m.includes('qwen3.5')) return { extra_body: { chat_template_kwargs: { enable_thinking: true } } };
    return {};
  };

  const modelToUse = resumeModel || "meta/llama-3.3-70b-instruct";
  const extraParams = getExtra(modelToUse);

  try {
    // Phase 1: Dissecting Target
    job.phase = 'ANALYZING_TARGET';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'ANALYZING_TARGET' });

    const analysisPrompt = `Analyze this Job Description and latest Company News for key technical requirements and cultural signals.
    Company: ${jobProfile.companyName || 'Target Organization'}
    Role: ${jobProfile.title}
    JD: ${jobProfile.description}
    LATEST NEWS/CONTEXT: ${jobProfile.researchContext || 'None provided'}
    
    Identify:
    1. MIRROR WORDS: 3-5 specific industry or cultural terms they use.
    2. THE PAIN POINT: What is the #1 problem they are trying to solve?
    3. THE FUTURE GOAL: What big objective or recent win is mentioned in the JD or News?
    
    Respond in JSON: { mirrorWords: string[], painPoint: string, futureGoal: string, strategicHook: string }`;

    const analysisComp = await callAI([{ role: "system", content: "AI Professional Career Mirror" }, { role: "user", content: analysisPrompt }], {
      model: modelToUse,
      response_format: { type: "json_object" },
      ...extraParams,
      apiKey
    });
    const strategy = JSON.parse(analysisComp.choices[0].message.content);

    // Phase 2: Mapping Repository Success (The PAR Method)
    job.phase = 'GROUNDING_EVIDENCE';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'GROUNDING_EVIDENCE' });
    
    const repoEvidence = repos.map(r => `[REPO] ${r.name}: ${r.description || 'No description'}`).join('\n');
    
    const evidencePrompt = `Find the TOP achievement in these repositories that solves the previously identified Pain Point: "${strategy.painPoint}".
    REPOS: ${repoEvidence}
    
    FORMAT the achievement using the PAR (Problem-Action-Result) method:
    - Problem: What was the challenge?
    - Action: What did you specifically implement?
    - Result: What was the quantifiable outcome?
    
    Respond with JSON: { parAchievement: { problem, action, result }, techUsed: string[] }`;

    const evidenceComp = await callAI([{ role: "system", content: "Senior Technical Interviewer" }, { role: "user", content: evidencePrompt }], {
      model: modelToUse,
      response_format: { type: "json_object" },
      ...extraParams,
      apiKey
    });
    const parsedEvidence = JSON.parse(evidenceComp.choices[0].message.content);

    // Phase 3: Narrative Synthesis (The Future-Value Drafting)
    job.phase = 'DRAFTING_BODY';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'DRAFTING_BODY' });
    
    const greeting = jobProfile.hiringManager 
      ? `Dear ${jobProfile.hiringManager},` 
      : (jobProfile.companyName ? `Dear ${jobProfile.companyName} Hiring Team,` : "Dear Hiring Manager,");

    const narrativePrompt = `Write a custom, high-impact Cover Letter for ${staticInfo.name}.
    Company: ${jobProfile.companyName || 'your company'}
    Role: ${jobProfile.title}
    
    ### RULES:
    1. MIRRORING: Use these terms naturally: [${(strategy.mirrorWords || []).join(', ')}].
    2. THE HOOK: Open with ${strategy.strategicHook}. State why you care about their mission.
    3. PAR METHOD: Detail this achievement: ${JSON.stringify(parsedEvidence.parAchievement)}.
    4. FUTURE VALUE: The closing MUST focus on how you help them achieve: "${strategy.futureGoal}".
    5. THE WHITE SPACE TEST: 
       - Paragraphs MUST be 3-4 sentences long max.
       - Use exactly 3 bullet points in the middle for top technical wins.
       - Total length must be 250-350 words.
    6. TONE: ${humanize ? 'Personable, narrative, and authentic.' : 'Formal, high-tech, and precise.'}
    
    [PROFILE DATA]: ${JSON.stringify(staticInfo)}
    [GREETING]: ${greeting}
    
    Respond in Markdown. Include Header, Greeting, and Sign-off.
    
    CRITICAL: Use standard Markdown link formatting [link text](url) for ALL URLs mentioned (e.g. GitHub profile, LinkedIn, Portfolio).`;

    const stream = await callAI([{ role: "system", content: "AI Cover Letter Architect" }, { role: "user", content: narrativePrompt }], {
      model: modelToUse,
      stream: true,
      ...extraParams,
      apiKey
    });

    job.markdown = "";
    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
            job.markdown += content;
            broadcast(userId, { type: 'MD_CHUNK', mode, chunk: content });
        }
    }

    job.status = 'COMPLETED';
    broadcast(userId, { type: 'COMPLETE', mode, markdown: job.markdown });

  } catch (error) {
    console.error(`[COVER LETTER ERROR]`, error);
    job.status = 'FAILED';
    broadcast(userId, { type: 'ERROR', error: 'Letter generation failed' });
  }
}

module.exports = { runCoverLetterEngine };

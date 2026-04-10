const axios = require('axios');

async function runLinkedInPostEngine(ctx) {
  const { userId, accessToken, repos, mode, broadcast, nvidia, job, jobProfile, staticInfo, callAI, resumeModel, humanize, apiKey } = ctx;
  
  const getExtra = (m) => {
    if (m.includes('deepseek-v3')) return { extra_body: { chat_template_kwargs: { thinking: true } } };
    if (m.includes('qwen3.5')) return { extra_body: { chat_template_kwargs: { enable_thinking: true } } };
    return {};
  };

  const modelToUse = resumeModel || "meta/llama-3.3-70b-instruct";
  const extraParams = getExtra(modelToUse);

  try {
    // Phase 1: Analyzing Repositories for "Hook" Potential
    job.phase = 'IDENTIFYING_HOOKS';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'IDENTIFYING_HOOKS' });

    const repoEvidence = repos.map(r => `[REPO] ${r.name} (${r.html_url}): ${r.description || 'No description'}`).join('\n');
    
    const hookPrompt = `Analyze these GitHub repositories and identify the most "LinkedIn-worthy" engineering achievement.
    REPOS:
    ${repoEvidence}
    
    Identify:
    1. THE PROBLEM: A common industry pain point this repo solves.
    2. THE "AHA" MOMENT: A specific technical hurdle overcome.
    3. THE IMPACT: How this project helps other developers or businesses.
    4. LINKS: Use the html_url provided for each repository to include a direct link to the main repo in the post.
    
    Respond in JSON: { problem: string, ahaMoment: string, impact: string, keywords: string[] }`;

    const hookComp = await callAI([{ role: "system", content: "LinkedIn Personal Branding Expert & Tech Evangelist" }, { role: "user", content: hookPrompt }], {
      model: modelToUse,
      response_format: { type: "json_object" },
      ...extraParams,
      apiKey
    });
    const hooks = JSON.parse(hookComp.choices[0].message.content);

    // Phase 2: Drafting the LinkedIn Post
    job.phase = 'DRAFTING_POST';
    broadcast(userId, { type: 'PHASE_CHANGE', phase: 'DRAFTING_POST' });

    const draftPrompt = `Write a high-engagement LinkedIn post about these technical projects.
    
    ### CONTEXT:
    Name: ${staticInfo.name}
    Role: ${jobProfile.title || 'Engineer'}
    Key Findings: ${JSON.stringify(hooks)}
    Repositories: ${repos.map(r => `${r.name} (${r.html_url})`).join(', ')}
    
    ### FORMATTING RULES (LinkedIn Optimization):
    1. THE HOOK: Start with a bold, controversial, or highly relatable first line (2-3 sentences max).
    2. THE NARRATIVE: Tell a story about the build. "I started building [Repo] because..."
    3. THE VALUE: Use bullet points (with emojis like 🚀, 🛠️, 📈) to explain the tech stack and the "Aha!" moment.
    4. LINKS: Include the GitHub link for the primary repository discussed.
    5. CALL TO ACTION: End with a question to drive comments (e.g., "How are you handling [Problem] in your stack?")
    6. HASHTAGS: Use 3-5 relevant tech hashtags (e.g., #OpenSource #ReactJS #NodeJS).
    7. TONE: ${humanize ? 'Personal, vulnerable, and inspiring.' : 'Professional, authoritative, and data-driven.'}
    8. SPACING: Use whitespace generously. No large blocks of text.
    
    Respond in Markdown.`;

    const stream = await callAI([{ role: "system", content: "Viral Tech Content Creator" }, { role: "user", content: draftPrompt }], {
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
    console.error(`[LINKEDIN POST ERROR]`, error);
    job.status = 'FAILED';
    broadcast(userId, { type: 'ERROR', error: 'LinkedIn post generation failed' });
  }
}

module.exports = { runLinkedInPostEngine };

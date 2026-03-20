import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeProject(readmeContent: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following GitHub README and extract structured information for a resume project description.
    
    README Content:
    ${readmeContent}
    `,
    config: {
      systemInstruction: "You are a technical recruiter and developer advocate. Your goal is to extract the core purpose, tech stack, and key features of a project from its README to help a developer write a high-impact resume summary.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectName: { type: Type.STRING },
          purpose: { type: Type.STRING, description: "One sentence describing why this project exists." },
          techStack: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of core technologies used."
          },
          keyFeatures: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 high-impact features or technical achievements."
          }
        },
        required: ["projectName", "purpose", "techStack", "keyFeatures"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function generateResumeSummary(analysis: any) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this project analysis, generate 3-4 professional resume bullet points. Focus on technical proficiency, architectural decisions, and impact. Use strong action verbs.
    
    Project Analysis:
    ${JSON.stringify(analysis, null, 2)}
    `,
    config: {
      systemInstruction: "You are an expert resume writer for software engineers. Generate concise, high-impact bullet points that highlight technical skills and achievements.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bulletPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["bulletPoints"]
      }
    }
  });

  return JSON.parse(response.text);
}

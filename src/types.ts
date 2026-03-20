export interface Repo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  private: boolean;
  language: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface ProjectAnalysis {
  projectName: string;
  purpose: string;
  techStack: string[];
  keyFeatures: string[];
}

export interface ResumeSummary {
  bulletPoints: string[];
}

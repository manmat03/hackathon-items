export type SkillName =
  | "Next Gen TechOps"
  | "Risk Assessments"
  | "Security / Cybersecurity"
  | "Selection, Design, and Architecture"
  | "System Implementation / SDLC"
  | "Technology Frameworks, Standards and Regulations"
  | "Business Continuity Management"
  | "Cloud"
  | "Data (Governance & Privacy)"
  | "Development"
  | "IT Controls and IPE"
  | "IT Department Governance"
  | "IT Service Management & Delivery"
  | "Networking (Operations)";

export const ALL_SKILLS: SkillName[] = [
  "Next Gen TechOps",
  "Risk Assessments",
  "Security / Cybersecurity",
  "Selection, Design, and Architecture",
  "System Implementation / SDLC",
  "Technology Frameworks, Standards and Regulations",
  "Business Continuity Management",
  "Cloud",
  "Data (Governance & Privacy)",
  "Development",
  "IT Controls and IPE",
  "IT Department Governance",
  "IT Service Management & Delivery",
  "Networking (Operations)",
];

/** Short labels for the horizon chart; order mirrors ALL_SKILLS. */
export const SKILL_SHORT: Record<SkillName, string> = {
  "Next Gen TechOps": "TechOps",
  "Risk Assessments": "Risk",
  "Security / Cybersecurity": "Security",
  "Selection, Design, and Architecture": "Arch.",
  "System Implementation / SDLC": "SDLC",
  "Technology Frameworks, Standards and Regulations": "Frmwks",
  "Business Continuity Management": "Continuity",
  "Cloud": "Cloud",
  "Data (Governance & Privacy)": "Data Gov.",
  "Development": "Devt.",
  "IT Controls and IPE": "Controls",
  "IT Department Governance": "IT Gov.",
  "IT Service Management & Delivery": "Service",
  "Networking (Operations)": "Net Ops",
};

export interface Skill {
  name: SkillName;
  score: number;
}

export interface SkillList {
  skills: Skill[];
}

export interface Turn {
  question: string;
  answer: string;
}

// Indian states list
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

export const EXAM_TYPES = ["Competitive Exam", "Board Exam"];

// Exam mappings based on state and exam type
export const EXAM_MAPPINGS: Record<string, { competitive: string[], board: string[] }> = {
  "Telangana": {
    competitive: ["TS EAMCET", "TS ICET", "TS PGECET"],
    board: ["Telangana Intermediate - 12th"]
  },
  "Andhra Pradesh": {
    competitive: ["AP EAMCET", "AP ICET", "AP PGECET"],
    board: ["AP Intermediate - 12th"]
  },
  "Karnataka": {
    competitive: ["KCET", "COMEDK", "Karnataka PGCET"],
    board: ["Karnataka PUC - 12th"]
  },
  "Tamil Nadu": {
    competitive: ["TNEA", "TANCET"],
    board: ["Tamil Nadu HSC - 12th"]
  },
  "Maharashtra": {
    competitive: ["MHT CET", "MAH CET"],
    board: ["Maharashtra HSC - 12th"]
  },
  "Kerala": {
    competitive: ["KEAM", "Kerala CEE"],
    board: ["Kerala HSE - 12th"]
  },
  "West Bengal": {
    competitive: ["WBJEE", "JECA"],
    board: ["West Bengal HS - 12th"]
  },
  "Uttar Pradesh": {
    competitive: ["UPSEE", "UPTAC"],
    board: ["UP Board - 12th"]
  },
  "Rajasthan": {
    competitive: ["REAP", "Rajasthan CET"],
    board: ["RBSE - 12th"]
  },
  "Gujarat": {
    competitive: ["GUJCET", "GCET"],
    board: ["GSEB - 12th"]
  },
  "Delhi": {
    competitive: ["Delhi CET"],
    board: ["CBSE - 12th"]
  },
  // Default for other states
  "default": {
    competitive: ["JEE Main", "JEE Advanced", "NEET", "BITSAT"],
    board: ["CBSE - 12th", "ICSE - 12th"]
  }
};

export function getExamsForUser(state: string | null, examTypes: string[]): string[] {
  if (!state || examTypes.length === 0) return [];
  
  const stateExams = EXAM_MAPPINGS[state] || EXAM_MAPPINGS["default"];
  const exams: string[] = [];
  
  if (examTypes.includes("Competitive Exam")) {
    exams.push(...stateExams.competitive);
  }
  
  if (examTypes.includes("Board Exam")) {
    exams.push(...stateExams.board);
  }
  
  return exams;
}

export type PresetTopic = {
  title: string;
  estimatedMinutes: number;
};

export type PresetSubject = {
  name: string;
  topics: PresetTopic[];
};

export type PresetCourse = {
  id: string;
  name: string;
  icon: string;
  subjects: PresetSubject[];
};

export const PRESET_COURSES: PresetCourse[] = [
  {
    id: 'cs',
    name: 'Computer Science & IT',
    icon: 'code-slash-outline',
    subjects: [
      {
        name: 'Data Structures & Algorithms',
        topics: [
          { title: 'Arrays & Linked Lists', estimatedMinutes: 45 },
          { title: 'Binary Trees & Graphs', estimatedMinutes: 90 },
          { title: 'Recursion & Dynamic Programming', estimatedMinutes: 120 },
          { title: 'Sorting & Searching Algorithms', estimatedMinutes: 60 }
        ]
      },
      {
        name: 'Database Management Systems',
        topics: [
          { title: 'SQL Queries & Relational Algebra', estimatedMinutes: 60 },
          { title: 'Database Normalization (1NF, 2NF, 3NF)', estimatedMinutes: 90 },
          { title: 'Indexing & Transaction Management', estimatedMinutes: 120 }
        ]
      },
      {
        name: 'Web Development',
        topics: [
          { title: 'HTML5 & CSS3 Flexbox/Grid', estimatedMinutes: 60 },
          { title: 'JavaScript Essentials & DOM API', estimatedMinutes: 90 },
          { title: 'React Components & Hooks State', estimatedMinutes: 120 },
          { title: 'RESTful APIs & Backend Express', estimatedMinutes: 90 }
        ]
      }
    ]
  },
  {
    id: 'med',
    name: 'Medical & Biology',
    icon: 'heart-outline',
    subjects: [
      {
        name: 'Human Anatomy',
        topics: [
          { title: 'Skeletal & Muscular System', estimatedMinutes: 90 },
          { title: 'Cardiovascular & Respiratory System', estimatedMinutes: 120 },
          { title: 'Nervous System & Brain Structures', estimatedMinutes: 180 }
        ]
      },
      {
        name: 'Organic Chemistry',
        topics: [
          { title: 'Hydrocarbons & Alkane Properties', estimatedMinutes: 60 },
          { title: 'Functional Groups & IUPAC Naming', estimatedMinutes: 90 },
          { title: 'Reaction Mechanisms & Synthesis', estimatedMinutes: 120 }
        ]
      }
    ]
  },
  {
    id: 'biz',
    name: 'Business & Finance',
    icon: 'cash-outline',
    subjects: [
      {
        name: 'Financial Accounting',
        topics: [
          { title: 'Balance Sheets & Ledger Entries', estimatedMinutes: 90 },
          { title: 'Income & Retained Earnings Statements', estimatedMinutes: 60 },
          { title: 'Cash Flow Analysis & Statements', estimatedMinutes: 120 }
        ]
      },
      {
        name: 'Microeconomics',
        topics: [
          { title: 'Supply, Demand & Market Equilibrium', estimatedMinutes: 45 },
          { title: 'Market Structures & Monopolies', estimatedMinutes: 90 },
          { title: 'Consumer Utility & Preference Theory', estimatedMinutes: 60 }
        ]
      }
    ]
  },
  {
    id: 'eng',
    name: 'Engineering & Physics',
    icon: 'construct-outline',
    subjects: [
      {
        name: 'Classical Mechanics',
        topics: [
          { title: 'Newtonian Laws of Motion', estimatedMinutes: 60 },
          { title: 'Work, Energy & Power Principles', estimatedMinutes: 90 },
          { title: 'Rotational Dynamics & Angular Momentum', estimatedMinutes: 120 }
        ]
      },
      {
        name: 'Calculus & Analysis',
        topics: [
          { title: 'Limits, Continuity & Sequences', estimatedMinutes: 60 },
          { title: 'Differential Calculus & Derivatives', estimatedMinutes: 90 },
          { title: 'Integral Calculus & Fundamental Theorem', estimatedMinutes: 120 }
        ]
      }
    ]
  },
  {
    id: 'arts',
    name: 'Arts & Humanities',
    icon: 'color-palette-outline',
    subjects: [
      {
        name: 'English Literature',
        topics: [
          { title: 'Shakespeare & Elizabethan Drama', estimatedMinutes: 90 },
          { title: 'Poetry Analysis & Metaphor', estimatedMinutes: 60 },
          { title: 'Modern & Post-Modern Novels', estimatedMinutes: 120 }
        ]
      },
      {
        name: 'World History',
        topics: [
          { title: 'Ancient Civilizations & Empires', estimatedMinutes: 90 },
          { title: 'Industrial Revolution & Modernization', estimatedMinutes: 60 },
          { title: 'World Wars & 20th Century Conflicts', estimatedMinutes: 120 }
        ]
      }
    ]
  },
  {
    id: 'social',
    name: 'Social Sciences & Psychology',
    icon: 'people-outline',
    subjects: [
      {
        name: 'General Psychology',
        topics: [
          { title: 'Introduction to Cognitive Theories', estimatedMinutes: 60 },
          { title: 'Behavioral & Social Psychology', estimatedMinutes: 90 },
          { title: 'Human Development & Lifespan Stages', estimatedMinutes: 120 }
        ]
      },
      {
        name: 'Sociology & Culture',
        topics: [
          { title: 'Social Structures & Institutions', estimatedMinutes: 60 },
          { title: 'Cultural Norms, Values & Identity', estimatedMinutes: 90 },
          { title: 'Social Change & Modern Movements', estimatedMinutes: 120 }
        ]
      }
    ]
  }
];

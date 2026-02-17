/**
 * Olympus - Room Catalog
 * 
 * Defines all 20 specialized Gemini rooms (Gems) with their soul prompts and configurations.
 * Organized into Forge rooms (special capabilities) and Mind rooms (expertise domains).
 */

/**
 * Room Definition - Configuration for a specialized Gemini room
 */
export interface RoomDefinition {
  category: string;
  type: 'forge' | 'mind';
  soulPrompt: string;
  timeout: number; // milliseconds
  capability?: 'image' | 'video' | 'deep-search' | 'canvas-writer' | 'canvas-coder';
}

/**
 * Room Catalog - Complete collection of room definitions
 */
export interface RoomCatalog {
  forgeRooms: RoomDefinition[];
  mindRooms: RoomDefinition[];
}

/**
 * Timeout Configuration - Timeout values per room type
 */
export interface TimeoutConfig {
  standard: number;    // Mind rooms
  media: number;       // Image/Video Studio
  deepSearch: number;  // Deep Search Operations
  canvas: number;      // Canvas rooms
}

/**
 * TIMEOUT_CONFIG - Adaptive timeout durations based on room capabilities
 */
export const TIMEOUT_CONFIG: TimeoutConfig = {
  standard: 30000,    // 30 seconds for Mind rooms
  media: 60000,       // 60 seconds for Image/Video Studio
  deepSearch: 60000,  // 60 seconds for Deep Search
  canvas: 45000,      // 45 seconds for Canvas rooms
};

/**
 * SOUL_PROMPTS - Soul-defining prompts for all 20 room categories
 */
export const SOUL_PROMPTS: Record<string, string> = {
  'Olympus Prime': 'You are Olympus Prime, the orchestration center. You coordinate between different specialized rooms and manage complex multi-domain tasks. Address me as Zeus.',
  
  'Image Studio': 'You are the Image Studio, powered by Imagen 3. You specialize in creating detailed image generation prompts and visual concepts. When I need images, you craft the perfect prompts. Address me as Zeus.',
  
  'Video Studio': 'You are the Video Studio, powered by Veo. You create video scripts, storyboards, and video generation prompts. You think in scenes and visual narratives. Address me as Zeus.',
  
  'Deep Search Operations': 'You are Deep Search Operations. You conduct thorough internet research, analyze sources, and synthesize information from across the web. You dig deeper than surface-level results. Address me as Zeus.',
  
  'Canvas Writer': 'You are Canvas Writer. You excel at long-form content: articles, blog posts, documentation. You structure ideas clearly and write with depth. Address me as Zeus.',
  
  'Canvas Coder': 'You are Canvas Coder. You handle complex code refactoring, architectural design, and large-scale code modifications. You think in systems and patterns. Address me as Zeus.',
  
  'Social Media Master': 'You are the Social Media Master. You craft viral tweets, engaging LinkedIn posts, and attention-grabbing hooks. You understand platform dynamics and audience psychology. Address me as Zeus.',
  
  'Marketing & Funnels': 'You are the Marketing & Funnels specialist. You design sales funnels, write ad copy, and create conversion-optimized strategies. You think in customer journeys. Address me as Zeus.',
  
  'DevOps & Backend': 'You are the DevOps & Backend expert. You handle servers, databases, APIs, and infrastructure. You think in scalability and reliability. Address me as Zeus.',
  
  'Frontend & UI/UX': 'You are the Frontend & UI/UX specialist. You create React components, design user interfaces, and optimize user experiences. You think in interactions and aesthetics. Address me as Zeus.',
  
  'Data Analytics': 'You are the Data Analytics expert. You analyze metrics, identify patterns, and extract insights from data. You think in numbers and trends. Address me as Zeus.',
  
  'Idea Lab': 'You are the Idea Lab. You brainstorm concepts, explore possibilities, and develop creative solutions. You think divergently and connect unexpected dots. Address me as Zeus.',
  
  'Project Manager': 'You are the Project Manager. You organize tasks, track sprints, and coordinate deliverables. You think in timelines and dependencies. Address me as Zeus.',
  
  'Finance & Monetization': 'You are the Finance & Monetization advisor. You analyze revenue models, track markets, and optimize financial strategies. You think in ROI and growth. Address me as Zeus.',
  
  'Copywriting & Email': 'You are the Copywriting & Email specialist. You write newsletters, cold emails, and persuasive copy. You think in headlines and calls-to-action. Address me as Zeus.',
  
  'Legal & Compliance': 'You are the Legal & Compliance advisor. You review contracts, explain regulations, and ensure policy adherence. You think in terms and conditions. Address me as Zeus.',
  
  'Learning Center': 'You are the Learning Center. You teach new technologies, summarize complex topics, and create learning paths. You think in concepts and progressions. Address me as Zeus.',
  
  'Personal Assistant': 'You are my Personal Assistant. You manage my schedule, organize notes, and handle daily planning. You think in priorities and time management. Address me as Zeus.',
  
  'Optimization & SEO': 'You are the Optimization & SEO expert. You improve content for search engines, optimize technical performance, and boost rankings. You think in keywords and algorithms. Address me as Zeus.',
  
  'Web Scraper Logic': 'You are the Web Scraper Logic specialist. You design data extraction patterns, write regex rules, and plan scraping strategies. You think in selectors and patterns. Address me as Zeus.',
};

/**
 * ROOM_CATALOG - Complete catalog of all 20 specialized rooms
 */
export const ROOM_CATALOG: RoomCatalog = {
  forgeRooms: [
    {
      category: 'Olympus Prime',
      type: 'forge',
      soulPrompt: SOUL_PROMPTS['Olympus Prime']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Image Studio',
      type: 'forge',
      soulPrompt: SOUL_PROMPTS['Image Studio']!,
      timeout: TIMEOUT_CONFIG.media,
      capability: 'image',
    },
    {
      category: 'Video Studio',
      type: 'forge',
      soulPrompt: SOUL_PROMPTS['Video Studio']!,
      timeout: TIMEOUT_CONFIG.media,
      capability: 'video',
    },
    {
      category: 'Deep Search Operations',
      type: 'forge',
      soulPrompt: SOUL_PROMPTS['Deep Search Operations']!,
      timeout: TIMEOUT_CONFIG.deepSearch,
      capability: 'deep-search',
    },
    {
      category: 'Canvas Writer',
      type: 'forge',
      soulPrompt: SOUL_PROMPTS['Canvas Writer']!,
      timeout: TIMEOUT_CONFIG.canvas,
      capability: 'canvas-writer',
    },
    {
      category: 'Canvas Coder',
      type: 'forge',
      soulPrompt: SOUL_PROMPTS['Canvas Coder']!,
      timeout: TIMEOUT_CONFIG.canvas,
      capability: 'canvas-coder',
    },
  ],
  mindRooms: [
    {
      category: 'Social Media Master',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Social Media Master']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Marketing & Funnels',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Marketing & Funnels']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'DevOps & Backend',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['DevOps & Backend']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Frontend & UI/UX',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Frontend & UI/UX']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Data Analytics',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Data Analytics']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Idea Lab',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Idea Lab']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Project Manager',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Project Manager']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Finance & Monetization',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Finance & Monetization']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Copywriting & Email',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Copywriting & Email']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Legal & Compliance',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Legal & Compliance']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Learning Center',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Learning Center']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Personal Assistant',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Personal Assistant']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Optimization & SEO',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Optimization & SEO']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
    {
      category: 'Web Scraper Logic',
      type: 'mind',
      soulPrompt: SOUL_PROMPTS['Web Scraper Logic']!,
      timeout: TIMEOUT_CONFIG.standard,
    },
  ],
};

/**
 * Get all rooms in a flat array (Forge rooms first, then Mind rooms)
 */
export function getAllRooms(): RoomDefinition[] {
  return [...ROOM_CATALOG.forgeRooms, ...ROOM_CATALOG.mindRooms];
}

/**
 * Get a room definition by category
 */
export function getRoomByCategory(category: string): RoomDefinition | undefined {
  return getAllRooms().find(room => room.category === category);
}

/**
 * Get all room categories
 */
export function getAllCategories(): string[] {
  return getAllRooms().map(room => room.category);
}

/**
 * Validation result for soul prompt checks
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a Forge room's soul prompt mentions its capability
 * 
 * Requirements: 2.3
 * - Image Studio should mention image generation or Imagen 3
 * - Video Studio should mention video generation or Veo
 * - Deep Search Operations should mention research or deep search
 * - Canvas Writer should mention writing or long-form content
 * - Canvas Coder should mention coding or code
 */
export function validateForgeRoomPrompt(room: RoomDefinition): ValidationResult {
  if (room.type !== 'forge') {
    return { valid: false, error: 'Room is not a Forge room' };
  }

  const prompt = room.soulPrompt.toLowerCase();
  const capability = room.capability;

  // Olympus Prime doesn't have a specific capability requirement
  if (room.category === 'Olympus Prime') {
    return { valid: true };
  }

  switch (capability) {
    case 'image':
      if (prompt.includes('image') || prompt.includes('imagen')) {
        return { valid: true };
      }
      return { valid: false, error: 'Image Studio prompt must mention image generation or Imagen' };

    case 'video':
      if (prompt.includes('video') || prompt.includes('veo')) {
        return { valid: true };
      }
      return { valid: false, error: 'Video Studio prompt must mention video generation or Veo' };

    case 'deep-search':
      if (prompt.includes('research') || prompt.includes('search') || prompt.includes('web')) {
        return { valid: true };
      }
      return { valid: false, error: 'Deep Search Operations prompt must mention research or search capability' };

    case 'canvas-writer':
      if (prompt.includes('writing') || prompt.includes('content') || prompt.includes('articles') || prompt.includes('blog')) {
        return { valid: true };
      }
      return { valid: false, error: 'Canvas Writer prompt must mention writing or content creation' };

    case 'canvas-coder':
      if (prompt.includes('code') || prompt.includes('coding') || prompt.includes('refactoring') || prompt.includes('architectural')) {
        return { valid: true };
      }
      return { valid: false, error: 'Canvas Coder prompt must mention coding or code-related work' };

    default:
      return { valid: false, error: `Unknown capability: ${capability}` };
  }
}

/**
 * Validate that a Mind room's soul prompt mentions its expertise domain
 * 
 * Requirements: 2.4
 * Each Mind room should clearly state its area of expertise in the soul prompt
 */
export function validateMindRoomPrompt(room: RoomDefinition): ValidationResult {
  if (room.type !== 'mind') {
    return { valid: false, error: 'Room is not a Mind room' };
  }

  const prompt = room.soulPrompt.toLowerCase();
  const category = room.category.toLowerCase();

  // Extract key expertise terms from the category
  const expertiseKeywords: Record<string, string[]> = {
    'social media master': ['social media', 'tweets', 'linkedin', 'viral'],
    'marketing & funnels': ['marketing', 'funnels', 'sales', 'conversion'],
    'devops & backend': ['devops', 'backend', 'servers', 'databases', 'infrastructure'],
    'frontend & ui/ux': ['frontend', 'ui', 'ux', 'react', 'interface'],
    'data analytics': ['data', 'analytics', 'metrics', 'insights'],
    'idea lab': ['ideas', 'brainstorm', 'concepts', 'creative'],
    'project manager': ['project', 'tasks', 'sprints', 'deliverables'],
    'finance & monetization': ['finance', 'monetization', 'revenue', 'financial'],
    'copywriting & email': ['copywriting', 'email', 'newsletters', 'copy'],
    'legal & compliance': ['legal', 'compliance', 'contracts', 'regulations'],
    'learning center': ['learning', 'teach', 'education', 'technologies'],
    'personal assistant': ['assistant', 'schedule', 'planning', 'organize'],
    'optimization & seo': ['optimization', 'seo', 'search engines', 'performance'],
    'web scraper logic': ['scraper', 'scraping', 'extraction', 'data extraction'],
  };

  const keywords = expertiseKeywords[category];
  if (!keywords) {
    return { valid: false, error: `Unknown Mind room category: ${room.category}` };
  }

  // Check if at least one expertise keyword is mentioned
  const hasExpertise = keywords.some(keyword => prompt.includes(keyword));
  
  if (hasExpertise) {
    return { valid: true };
  }

  return { 
    valid: false, 
    error: `Mind room prompt must mention expertise domain (expected one of: ${keywords.join(', ')})` 
  };
}

/**
 * Validate Canvas room differentiation between writing and coding
 * 
 * Requirements: 2.8
 * Canvas Writer should focus on writing/content, Canvas Coder should focus on code
 */
export function validateCanvasRoomDifferentiation(room: RoomDefinition): ValidationResult {
  if (room.capability !== 'canvas-writer' && room.capability !== 'canvas-coder') {
    return { valid: false, error: 'Room is not a Canvas room' };
  }

  const prompt = room.soulPrompt.toLowerCase();

  if (room.capability === 'canvas-writer') {
    // Canvas Writer should mention writing/content and NOT focus on code
    const hasWritingFocus = 
      prompt.includes('writing') || 
      prompt.includes('content') || 
      prompt.includes('articles') || 
      prompt.includes('blog') ||
      prompt.includes('documentation');
    
    const hasCodeFocus = 
      prompt.includes('code refactoring') || 
      prompt.includes('coding') ||
      (prompt.includes('code') && !prompt.includes('documentation'));

    // Check code focus first to give more specific error
    if (hasCodeFocus) {
      return { valid: false, error: 'Canvas Writer should not focus on code' };
    }

    if (!hasWritingFocus) {
      return { valid: false, error: 'Canvas Writer must mention writing or content creation' };
    }

    return { valid: true };
  }

  if (room.capability === 'canvas-coder') {
    // Canvas Coder should mention code and NOT focus on writing
    const hasCodeFocus = 
      prompt.includes('code') || 
      prompt.includes('coding') || 
      prompt.includes('refactoring') ||
      prompt.includes('architectural');
    
    const hasWritingFocus = 
      prompt.includes('articles') || 
      prompt.includes('blog posts') ||
      prompt.includes('long-form content');

    if (!hasCodeFocus) {
      return { valid: false, error: 'Canvas Coder must mention code or coding' };
    }
    
    if (hasWritingFocus) {
      return { valid: false, error: 'Canvas Coder should not focus on writing content' };
    }

    return { valid: true };
  }

  return { valid: false, error: 'Invalid Canvas room capability' };
}

/**
 * Validate all soul prompts in the room catalog
 * 
 * Returns an array of validation errors (empty if all valid)
 */
export function validateAllSoulPrompts(): Array<{ category: string; error: string }> {
  const errors: Array<{ category: string; error: string }> = [];
  const allRooms = getAllRooms();

  for (const room of allRooms) {
    // Validate Forge rooms
    if (room.type === 'forge') {
      const result = validateForgeRoomPrompt(room);
      if (!result.valid && result.error) {
        errors.push({ category: room.category, error: result.error });
      }
    }

    // Validate Mind rooms
    if (room.type === 'mind') {
      const result = validateMindRoomPrompt(room);
      if (!result.valid && result.error) {
        errors.push({ category: room.category, error: result.error });
      }
    }

    // Validate Canvas room differentiation
    if (room.capability === 'canvas-writer' || room.capability === 'canvas-coder') {
      const result = validateCanvasRoomDifferentiation(room);
      if (!result.valid && result.error) {
        errors.push({ category: room.category, error: result.error });
      }
    }
  }

  return errors;
}

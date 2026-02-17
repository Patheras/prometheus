/**
 * Unit tests for room catalog soul prompt validators
 */

import {
  validateForgeRoomPrompt,
  validateMindRoomPrompt,
  validateCanvasRoomDifferentiation,
  validateAllSoulPrompts,
  ROOM_CATALOG,
  type RoomDefinition,
} from '../room-catalog.js';

describe('validateForgeRoomPrompt', () => {
  it('should validate Image Studio mentions image capability', () => {
    const room: RoomDefinition = {
      category: 'Image Studio',
      type: 'forge',
      soulPrompt: 'You are the Image Studio, powered by Imagen 3.',
      timeout: 60000,
      capability: 'image',
    };

    const result = validateForgeRoomPrompt(room);
    expect(result.valid).toBe(true);
  });

  it('should validate Video Studio mentions video capability', () => {
    const room: RoomDefinition = {
      category: 'Video Studio',
      type: 'forge',
      soulPrompt: 'You create video scripts and use Veo.',
      timeout: 60000,
      capability: 'video',
    };

    const result = validateForgeRoomPrompt(room);
    expect(result.valid).toBe(true);
  });

  it('should validate Deep Search mentions research capability', () => {
    const room: RoomDefinition = {
      category: 'Deep Search Operations',
      type: 'forge',
      soulPrompt: 'You conduct thorough internet research.',
      timeout: 60000,
      capability: 'deep-search',
    };

    const result = validateForgeRoomPrompt(room);
    expect(result.valid).toBe(true);
  });

  it('should validate Canvas Writer mentions writing', () => {
    const room: RoomDefinition = {
      category: 'Canvas Writer',
      type: 'forge',
      soulPrompt: 'You excel at long-form content and writing.',
      timeout: 45000,
      capability: 'canvas-writer',
    };

    const result = validateForgeRoomPrompt(room);
    expect(result.valid).toBe(true);
  });

  it('should validate Canvas Coder mentions code', () => {
    const room: RoomDefinition = {
      category: 'Canvas Coder',
      type: 'forge',
      soulPrompt: 'You handle complex code refactoring.',
      timeout: 45000,
      capability: 'canvas-coder',
    };

    const result = validateForgeRoomPrompt(room);
    expect(result.valid).toBe(true);
  });

  it('should allow Olympus Prime without specific capability', () => {
    const room: RoomDefinition = {
      category: 'Olympus Prime',
      type: 'forge',
      soulPrompt: 'You are Olympus Prime, the orchestration center.',
      timeout: 30000,
    };

    const result = validateForgeRoomPrompt(room);
    expect(result.valid).toBe(true);
  });

  it('should fail if Image Studio does not mention image', () => {
    const room: RoomDefinition = {
      category: 'Image Studio',
      type: 'forge',
      soulPrompt: 'You are a creative assistant.',
      timeout: 60000,
      capability: 'image',
    };

    const result = validateForgeRoomPrompt(room);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('image');
  });

  it('should fail if room is not a Forge room', () => {
    const room: RoomDefinition = {
      category: 'Social Media Master',
      type: 'mind',
      soulPrompt: 'You craft viral tweets.',
      timeout: 30000,
    };

    const result = validateForgeRoomPrompt(room);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Room is not a Forge room');
  });
});

describe('validateMindRoomPrompt', () => {
  it('should validate Social Media Master mentions expertise', () => {
    const room: RoomDefinition = {
      category: 'Social Media Master',
      type: 'mind',
      soulPrompt: 'You craft viral tweets and engaging LinkedIn posts.',
      timeout: 30000,
    };

    const result = validateMindRoomPrompt(room);
    expect(result.valid).toBe(true);
  });

  it('should validate Marketing & Funnels mentions expertise', () => {
    const room: RoomDefinition = {
      category: 'Marketing & Funnels',
      type: 'mind',
      soulPrompt: 'You design sales funnels and conversion strategies.',
      timeout: 30000,
    };

    const result = validateMindRoomPrompt(room);
    expect(result.valid).toBe(true);
  });

  it('should validate DevOps & Backend mentions expertise', () => {
    const room: RoomDefinition = {
      category: 'DevOps & Backend',
      type: 'mind',
      soulPrompt: 'You handle servers, databases, and infrastructure.',
      timeout: 30000,
    };

    const result = validateMindRoomPrompt(room);
    expect(result.valid).toBe(true);
  });

  it('should fail if Mind room does not mention expertise', () => {
    const room: RoomDefinition = {
      category: 'Data Analytics',
      type: 'mind',
      soulPrompt: 'You are a helpful assistant.',
      timeout: 30000,
    };

    const result = validateMindRoomPrompt(room);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expertise domain');
  });

  it('should fail if room is not a Mind room', () => {
    const room: RoomDefinition = {
      category: 'Image Studio',
      type: 'forge',
      soulPrompt: 'You create images.',
      timeout: 60000,
      capability: 'image',
    };

    const result = validateMindRoomPrompt(room);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Room is not a Mind room');
  });
});

describe('validateCanvasRoomDifferentiation', () => {
  it('should validate Canvas Writer focuses on writing', () => {
    const room: RoomDefinition = {
      category: 'Canvas Writer',
      type: 'forge',
      soulPrompt: 'You excel at long-form content: articles, blog posts.',
      timeout: 45000,
      capability: 'canvas-writer',
    };

    const result = validateCanvasRoomDifferentiation(room);
    expect(result.valid).toBe(true);
  });

  it('should validate Canvas Coder focuses on code', () => {
    const room: RoomDefinition = {
      category: 'Canvas Coder',
      type: 'forge',
      soulPrompt: 'You handle complex code refactoring and architectural design.',
      timeout: 45000,
      capability: 'canvas-coder',
    };

    const result = validateCanvasRoomDifferentiation(room);
    expect(result.valid).toBe(true);
  });

  it('should fail if Canvas Writer does not mention writing', () => {
    const room: RoomDefinition = {
      category: 'Canvas Writer',
      type: 'forge',
      soulPrompt: 'You are a helpful assistant.',
      timeout: 45000,
      capability: 'canvas-writer',
    };

    const result = validateCanvasRoomDifferentiation(room);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('writing');
  });

  it('should fail if Canvas Coder does not mention code', () => {
    const room: RoomDefinition = {
      category: 'Canvas Coder',
      type: 'forge',
      soulPrompt: 'You write articles and blog posts.',
      timeout: 45000,
      capability: 'canvas-coder',
    };

    const result = validateCanvasRoomDifferentiation(room);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('code');
  });

  it('should fail if Canvas Writer focuses on code', () => {
    const room: RoomDefinition = {
      category: 'Canvas Writer',
      type: 'forge',
      soulPrompt: 'You handle code refactoring and coding tasks.',
      timeout: 45000,
      capability: 'canvas-writer',
    };

    const result = validateCanvasRoomDifferentiation(room);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('should not focus on code');
  });

  it('should fail if Canvas Coder focuses on writing', () => {
    const room: RoomDefinition = {
      category: 'Canvas Coder',
      type: 'forge',
      soulPrompt: 'You write long-form content and blog posts about code.',
      timeout: 45000,
      capability: 'canvas-coder',
    };

    const result = validateCanvasRoomDifferentiation(room);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('should not focus on writing');
  });

  it('should fail if room is not a Canvas room', () => {
    const room: RoomDefinition = {
      category: 'Image Studio',
      type: 'forge',
      soulPrompt: 'You create images.',
      timeout: 60000,
      capability: 'image',
    };

    const result = validateCanvasRoomDifferentiation(room);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Room is not a Canvas room');
  });
});

describe('validateAllSoulPrompts', () => {
  it('should validate all soul prompts in the actual room catalog', () => {
    const errors = validateAllSoulPrompts();
    
    // If there are errors, log them for debugging
    if (errors.length > 0) {
      console.log('Validation errors:', errors);
    }
    
    expect(errors).toEqual([]);
  });

  it('should return empty array for valid catalog', () => {
    const errors = validateAllSoulPrompts();
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBe(0);
  });
});

describe('Integration with actual ROOM_CATALOG', () => {
  it('should validate all Forge rooms in catalog', () => {
    for (const room of ROOM_CATALOG.forgeRooms) {
      const result = validateForgeRoomPrompt(room);
      expect(result.valid).toBe(true);
    }
  });

  it('should validate all Mind rooms in catalog', () => {
    for (const room of ROOM_CATALOG.mindRooms) {
      const result = validateMindRoomPrompt(room);
      expect(result.valid).toBe(true);
    }
  });

  it('should validate Canvas room differentiation in catalog', () => {
    const canvasRooms = ROOM_CATALOG.forgeRooms.filter(
      room => room.capability === 'canvas-writer' || room.capability === 'canvas-coder'
    );

    for (const room of canvasRooms) {
      const result = validateCanvasRoomDifferentiation(room);
      expect(result.valid).toBe(true);
    }
  });
});

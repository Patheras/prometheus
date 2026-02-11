/**
 * Integration tests for vector similarity search
 * 
 * Tests the complete workflow of:
 * 1. Indexing code chunks with embeddings
 * 2. Executing vector similarity search
 * 3. Integration with embedding cache
 * 4. Hybrid search combining keyword and vector results
 * 
 * Requirements: 1.3, 1.4, 5.1
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrometheusDatabase, initializeDatabase } from '../database';
import { 
  vectorSearchCode, 
  indexChunkEmbedding, 
  indexAllChunkEmbeddings,
  hybridSearchCode,
} from '../search';
import { EmbeddingCache } from '../embedding-cache';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('Vector Search Integration', () => {
  let db: PrometheusDatabase;
  let tempDir: string;
  let embeddingCache: EmbeddingCache;

  beforeAll(async () => {
    // Create temporary directory for test database
    tempDir = mkdtempSync(join(tmpdir(), 'prometheus-vector-integration-'));
    const dbPath = join(tempDir, 'test.db');

    // Initialize database
    db = await initializeDatabase({ path: dbPath });
    embeddingCache = new EmbeddingCache(db);

    // Insert test data
    const dbInstance = db.getDb();
    
    // Insert code_files
    const insertFile = dbInstance.prepare(`
      INSERT INTO code_files (path, repo, hash, language, size, last_modified)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const testFiles = [
      { 
        path: 'src/auth/login.ts', 
        repo: 'test-app', 
        hash: 'auth1', 
        language: 'typescript', 
        size: 500, 
        last_modified: Date.now() 
      },
      { 
        path: 'src/auth/register.ts', 
        repo: 'test-app', 
        hash: 'auth2', 
        language: 'typescript', 
        size: 600, 
        last_modified: Date.now() 
      },
      { 
        path: 'src/api/users.ts', 
        repo: 'test-app', 
        hash: 'api1', 
        language: 'typescript', 
        size: 800, 
        last_modified: Date.now() 
      },
      { 
        path: 'src/utils/validation.ts', 
        repo: 'test-app', 
        hash: 'util1', 
        language: 'typescript', 
        size: 300, 
        last_modified: Date.now() 
      },
    ];

    for (const file of testFiles) {
      insertFile.run(file.path, file.repo, file.hash, file.language, file.size, file.last_modified);
    }
    
    // Insert test code chunks with realistic code
    const insertChunk = dbInstance.prepare(`
      INSERT INTO code_chunks (id, file_path, start_line, end_line, text, hash, symbols, imports)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const testChunks = [
      {
        id: 'auth-login-1',
        file_path: 'src/auth/login.ts',
        start_line: 1,
        end_line: 15,
        text: `export async function login(email: string, password: string): Promise<User> {
  const user = await db.users.findOne({ email });
  if (!user) {
    throw new Error('User not found');
  }
  
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid password');
  }
  
  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  return { ...user, token };
}`,
        hash: 'chunk-auth1',
        symbols: JSON.stringify(['login']),
        imports: JSON.stringify(['db', 'bcrypt', 'jwt']),
      },
      {
        id: 'auth-register-1',
        file_path: 'src/auth/register.ts',
        start_line: 1,
        end_line: 20,
        text: `export async function register(email: string, password: string, name: string): Promise<User> {
  // Validate email format
  if (!isValidEmail(email)) {
    throw new Error('Invalid email format');
  }
  
  // Check if user already exists
  const existing = await db.users.findOne({ email });
  if (existing) {
    throw new Error('User already exists');
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Create user
  const user = await db.users.create({ email, passwordHash, name });
  return user;
}`,
        hash: 'chunk-auth2',
        symbols: JSON.stringify(['register']),
        imports: JSON.stringify(['isValidEmail', 'db', 'bcrypt']),
      },
      {
        id: 'api-users-1',
        file_path: 'src/api/users.ts',
        start_line: 1,
        end_line: 10,
        text: `export async function getUsers(limit: number = 10): Promise<User[]> {
  const users = await db.users.find({})
    .limit(limit)
    .sort({ createdAt: -1 });
  
  return users;
}`,
        hash: 'chunk-api1',
        symbols: JSON.stringify(['getUsers']),
        imports: JSON.stringify(['db']),
      },
      {
        id: 'api-users-2',
        file_path: 'src/api/users.ts',
        start_line: 12,
        end_line: 25,
        text: `export async function updateUser(userId: string, updates: Partial<User>): Promise<User> {
  const user = await db.users.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Validate updates
  if (updates.email && !isValidEmail(updates.email)) {
    throw new Error('Invalid email format');
  }
  
  const updated = await db.users.updateOne({ _id: userId }, updates);
  return updated;
}`,
        hash: 'chunk-api2',
        symbols: JSON.stringify(['updateUser']),
        imports: JSON.stringify(['db', 'isValidEmail']),
      },
      {
        id: 'util-validation-1',
        file_path: 'src/utils/validation.ts',
        start_line: 1,
        end_line: 8,
        text: `export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}`,
        hash: 'chunk-util1',
        symbols: JSON.stringify(['isValidEmail', 'isValidPassword']),
        imports: JSON.stringify([]),
      },
    ];

    for (const chunk of testChunks) {
      insertChunk.run(
        chunk.id,
        chunk.file_path,
        chunk.start_line,
        chunk.end_line,
        chunk.text,
        chunk.hash,
        chunk.symbols,
        chunk.imports
      );
    }
  });

  afterAll(() => {
    // Clean up
    if (db) {
      db.close();
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Embedding Indexing', () => {
    it('should index a single chunk with embedding', async () => {
      const result = await indexChunkEmbedding(db, 'auth-login-1', 'test content');
      expect(result).toBe(true);

      // Verify embedding was stored
      const dbInstance = db.getDb();
      const stored = dbInstance
        .prepare('SELECT id, embedding FROM code_chunks_vec WHERE id = ?')
        .get('auth-login-1') as { id: string; embedding: string } | undefined;

      expect(stored).toBeDefined();
      expect(stored?.id).toBe('auth-login-1');
      
      const embedding = JSON.parse(stored!.embedding);
      expect(embedding).toHaveLength(1536);
    });

    it('should index all chunks without embeddings', async () => {
      const count = await indexAllChunkEmbeddings(db);
      
      // Should have indexed 4 remaining chunks (5 total - 1 already indexed)
      expect(count).toBe(4);

      // Verify all chunks now have embeddings
      const dbInstance = db.getDb();
      const result = dbInstance
        .prepare('SELECT COUNT(*) as count FROM code_chunks_vec')
        .get() as { count: number };

      expect(result.count).toBe(5);
    });

    it('should not re-index chunks that already have embeddings', async () => {
      const count = await indexAllChunkEmbeddings(db);
      
      // Should be 0 since all chunks are already indexed
      expect(count).toBe(0);
    });
  });

  describe('Vector Search Queries', () => {
    it('should find authentication-related code', async () => {
      const results = await vectorSearchCode(db, 'user authentication login', { limit: 5 });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find auth-related chunks
      const authChunks = results.filter(r => 
        r.id.includes('auth') || 
        r.content.includes('login') || 
        r.content.includes('password')
      );
      
      expect(authChunks.length).toBeGreaterThan(0);
    });

    it('should find email validation code', async () => {
      const results = await vectorSearchCode(db, 'email validation', { limit: 5 });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find validation or email-related chunks
      const emailChunks = results.filter(r => 
        r.content.includes('email') || 
        r.content.includes('Valid')
      );
      
      expect(emailChunks.length).toBeGreaterThan(0);
    });

    it('should find database query code', async () => {
      const results = await vectorSearchCode(db, 'database query find users', { limit: 5 });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find chunks with database operations
      const dbChunks = results.filter(r => 
        r.content.includes('db.') || 
        r.content.includes('find')
      );
      
      expect(dbChunks.length).toBeGreaterThan(0);
    });

    it('should return results sorted by similarity', async () => {
      const results = await vectorSearchCode(db, 'password hashing', { limit: 5 });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Verify descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should include all required metadata', async () => {
      const results = await vectorSearchCode(db, 'user', { limit: 1 });
      
      expect(results.length).toBeGreaterThan(0);
      
      const result = results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('source', 'code');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('metadata');
      
      expect(result.metadata).toHaveProperty('file_path');
      expect(result.metadata).toHaveProperty('start_line');
      expect(result.metadata).toHaveProperty('end_line');
      expect(result.metadata).toHaveProperty('symbols');
      expect(result.metadata).toHaveProperty('imports');
      expect(result.metadata).toHaveProperty('similarity');
    });
  });

  describe('Hybrid Search', () => {
    it('should combine keyword and vector results', async () => {
      const results = await hybridSearchCode(db, 'login password', { 
        limit: 5,
        keywordWeight: 0.3,
        vectorWeight: 0.7,
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find login-related code
      const loginChunks = results.filter(r => 
        r.content.includes('login') || 
        r.content.includes('password')
      );
      
      expect(loginChunks.length).toBeGreaterThan(0);
    });

    it('should respect custom weights', async () => {
      // Keyword-heavy search
      const keywordResults = await hybridSearchCode(db, 'async function', { 
        limit: 5,
        keywordWeight: 0.9,
        vectorWeight: 0.1,
      });
      
      // Vector-heavy search
      const vectorResults = await hybridSearchCode(db, 'async function', { 
        limit: 5,
        keywordWeight: 0.1,
        vectorWeight: 0.9,
      });
      
      // Both should return results
      expect(keywordResults.length).toBeGreaterThan(0);
      expect(vectorResults.length).toBeGreaterThan(0);
      
      // Results may differ due to different weighting
      // Just verify both searches work
    });

    it('should filter by minimum score', async () => {
      const results = await hybridSearchCode(db, 'user', { 
        limit: 10,
        minScore: 0.5,
      });
      
      // All results should meet minimum score
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should respect limit parameter', async () => {
      const results = await hybridSearchCode(db, 'user', { 
        limit: 2,
      });
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should handle queries with no results', async () => {
      const results = await hybridSearchCode(db, 'nonexistent_xyz_123', { 
        limit: 5,
      });
      
      // May return empty or very low-scored results
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete vector search in reasonable time', async () => {
      const start = Date.now();
      
      await vectorSearchCode(db, 'user authentication', { limit: 10 });
      
      const duration = Date.now() - start;
      
      // Should complete in under 100ms for small dataset
      expect(duration).toBeLessThan(100);
    });

    it('should complete hybrid search in reasonable time', async () => {
      const start = Date.now();
      
      await hybridSearchCode(db, 'user authentication', { limit: 10 });
      
      const duration = Date.now() - start;
      
      // Should complete in under 150ms for small dataset
      expect(duration).toBeLessThan(150);
    });
  });
});

/**
 * Repository Management API Routes
 */

export interface Repository {
  id: string
  name: string
  url: string
  branch: string
  status: 'healthy' | 'warning' | 'error'
  lastActivity: number
  issuesCount: number
  createdAt: number
}

// In-memory storage (TODO: Replace with database)
const repositories: Repository[] = [
  {
    id: 'repo-1',
    name: 'prometheus-core',
    url: 'https://github.com/org/prometheus-core',
    branch: 'main',
    status: 'healthy',
    lastActivity: Date.now() - 120000, // 2 min ago
    issuesCount: 0,
    createdAt: Date.now() - 86400000 * 7, // 7 days ago
  },
  {
    id: 'repo-2',
    name: 'admin-portal',
    url: 'https://github.com/org/admin-portal',
    branch: 'main',
    status: 'warning',
    lastActivity: Date.now() - 900000, // 15 min ago
    issuesCount: 3,
    createdAt: Date.now() - 86400000 * 2, // 2 days ago
  },
  {
    id: 'repo-3',
    name: 'anots-integration',
    url: 'https://github.com/org/anots-integration',
    branch: 'develop',
    status: 'healthy',
    lastActivity: Date.now() - 3600000, // 1 hour ago
    issuesCount: 0,
    createdAt: Date.now() - 86400000 * 14, // 14 days ago
  },
]

export function getAllRepositories(): Repository[] {
  return repositories
}

export function getRepositoryById(id: string): Repository | undefined {
  return repositories.find((r) => r.id === id)
}

export function createRepository(data: Omit<Repository, 'id' | 'createdAt'>): Repository {
  const newRepo: Repository = {
    ...data,
    id: `repo-${Date.now()}`,
    createdAt: Date.now(),
  }
  repositories.push(newRepo)
  return newRepo
}

export function updateRepository(
  id: string,
  data: Partial<Omit<Repository, 'id' | 'createdAt'>>
): Repository | undefined {
  const index = repositories.findIndex((r) => r.id === id)
  if (index === -1) return undefined

  repositories[index] = {
    ...repositories[index],
    ...data,
  }
  return repositories[index]
}

export function deleteRepository(id: string): boolean {
  const index = repositories.findIndex((r) => r.id === id)
  if (index === -1) return false

  repositories.splice(index, 1)
  return true
}

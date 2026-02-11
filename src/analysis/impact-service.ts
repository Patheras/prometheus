/**
 * Impact Assessment Service
 * 
 * Integrates impact assessment with Memory and Runtime engines.
 * Uses Memory Engine to retrieve component data and Runtime Engine for LLM estimation.
 * Stores assessment results back in Memory Engine.
 * 
 * Task 31.3: Wire impact assessment
 */

import { MemoryEngine } from '../memory/engine';
import { RuntimeExecutor } from '../runtime/runtime-executor';
import { ImpactAssessor } from './impact-assessor';
import { ImpactAssessment } from './types';

/**
 * Impact service configuration
 */
export type ImpactServiceConfig = {
  /** Memory engine instance */
  memoryEngine: MemoryEngine;
  /** Runtime executor instance */
  runtimeExecutor: RuntimeExecutor;
  /** Repository path for dependency analysis */
  repoPath?: string;
};

/**
 * Impact Assessment Service
 * 
 * Orchestrates impact assessment using Memory and Runtime engines.
 */
export class ImpactService {
  private memoryEngine: MemoryEngine;
  private runtimeExecutor: RuntimeExecutor;
  private assessor: ImpactAssessor;
  private repoPath: string;

  constructor(config: ImpactServiceConfig) {
    this.memoryEngine = config.memoryEngine;
    this.runtimeExecutor = config.runtimeExecutor;
    this.assessor = new ImpactAssessor(config.runtimeExecutor);
    this.repoPath = config.repoPath || process.cwd();
  }

  /**
   * Assess impact of proposed changes
   * 
   * @param changeDescription - Description of proposed changes
   * @param affectedFiles - Files that will be changed
   * @returns Impact assessment
   */
  async assessChange(
    changeDescription: string,
    affectedFiles: string[]
  ): Promise<ImpactAssessment> {
    // Perform impact assessment
    const assessment = await this.assessor.assessImpact(
      changeDescription,
      affectedFiles,
      this.repoPath
    );

    // Store assessment results
    await this.storeAssessment(assessment);

    return assessment;
  }

  /**
   * Store assessment in Memory Engine
   * 
   * @param assessment - Impact assessment
   */
  private async storeAssessment(assessment: ImpactAssessment): Promise<void> {
    const db = this.memoryEngine.getDatabase().getDb();

    // Create table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS impact_assessments (
        id TEXT PRIMARY KEY,
        change_description TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        affected_component_count INTEGER NOT NULL,
        requires_consultation INTEGER NOT NULL,
        assessed_at INTEGER NOT NULL,
        assessment_json TEXT NOT NULL
      )
    `);

    // Store assessment
    db.prepare(`
      INSERT OR REPLACE INTO impact_assessments
      (id, change_description, risk_level, affected_component_count, requires_consultation, assessed_at, assessment_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      assessment.id,
      assessment.changeDescription,
      assessment.riskLevel,
      assessment.affectedComponents.length,
      assessment.requiresConsultation ? 1 : 0,
      assessment.assessedAt,
      JSON.stringify(assessment)
    );
  }

  /**
   * Get assessment history
   * 
   * @param limit - Maximum number of results
   * @returns Array of impact assessments
   */
  async getAssessmentHistory(limit: number = 10): Promise<ImpactAssessment[]> {
    const db = this.memoryEngine.getDatabase().getDb();

    const rows = db.prepare(`
      SELECT assessment_json
      FROM impact_assessments
      ORDER BY assessed_at DESC
      LIMIT ?
    `).all(limit) as Array<{ assessment_json: string }>;

    return rows.map((row) => JSON.parse(row.assessment_json) as ImpactAssessment);
  }

  /**
   * Get high-risk assessments
   * 
   * @returns Array of high-risk impact assessments
   */
  async getHighRiskAssessments(): Promise<ImpactAssessment[]> {
    const db = this.memoryEngine.getDatabase().getDb();

    const rows = db.prepare(`
      SELECT assessment_json
      FROM impact_assessments
      WHERE risk_level IN ('high', 'critical')
      ORDER BY assessed_at DESC
    `).all() as Array<{ assessment_json: string }>;

    return rows.map((row) => JSON.parse(row.assessment_json) as ImpactAssessment);
  }
}

/**
 * Create an impact service instance
 * 
 * @param config - Service configuration
 * @returns Impact service instance
 */
export function createImpactService(config: ImpactServiceConfig): ImpactService {
  return new ImpactService(config);
}

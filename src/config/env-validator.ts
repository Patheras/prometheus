/**
 * Environment Variable Validator
 * 
 * Validates environment variables for required presence and correct formats.
 * Provides structured error messages for configuration issues.
 */

export interface EnvConfig {
  // Server
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  
  // Database
  databasePath: string;
  
  // LLM Providers
  azureOpenAI: {
    endpoint: string;
    apiKey: string;
    deploymentName: string;
    apiVersion: string;
    reasoningEffort?: string;
  };
  azureOpenAICodex?: {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion: string;
  };
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  
  // Integrations
  githubToken?: string;
  githubRepoOwner?: string;
  githubRepoName?: string;
}

export interface ValidationError {
  variable: string;
  message: string;
  required: boolean;
}

export interface ValidationWarning {
  variable: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export class EnvValidator {
  private static readonly REQUIRED_VARIABLES = [
    'PORT',
    'NODE_ENV',
    'DATABASE_PATH',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_DEPLOYMENT_NAME',
    'AZURE_OPENAI_API_VERSION'
  ];

  private static readonly OPTIONAL_VARIABLES = [
    'AZURE_OPENAI_REASONING_EFFORT',
    'AZURE_OPENAI_CODEX_ENDPOINT',
    'AZURE_OPENAI_CODEX_API_KEY',
    'AZURE_OPENAI_CODEX_DEPLOYMENT',
    'AZURE_OPENAI_CODEX_API_VERSION',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'GITHUB_TOKEN',
    'GITHUB_REPO_OWNER',
    'GITHUB_REPO_NAME',
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'ANOTS_REPO_PATH',
    'PROMETHEUS_REPO_PATH',
    'ADMIN_PORTAL_URL',
    'ADMIN_AUTH_SECRET',
    'ENABLE_METRICS',
    'METRICS_PORT'
  ];

  /**
   * Validate all environment variables
   */
  validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for missing required variables
    for (const variable of EnvValidator.REQUIRED_VARIABLES) {
      const value = process.env[variable];
      if (!value || value.trim() === '') {
        errors.push({
          variable,
          message: `Missing required environment variable: ${variable}`,
          required: true
        });
      }
    }

    // Validate formats for present variables
    this.validateFormats(errors);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate format of environment variables
   */
  private validateFormats(errors: ValidationError[]): void {
    // Validate PORT
    const port = process.env['PORT'];
    if (port && port.trim() !== '' && !this.validateFormat('PORT', port, 'port')) {
      errors.push({
        variable: 'PORT',
        message: `Invalid port format: ${port}. Must be a number between 1 and 65535.`,
        required: true
      });
    }

    // Validate NODE_ENV
    const nodeEnv = process.env['NODE_ENV'];
    if (nodeEnv && nodeEnv.trim() !== '' && !['development', 'production', 'test'].includes(nodeEnv)) {
      errors.push({
        variable: 'NODE_ENV',
        message: `Invalid NODE_ENV value: ${nodeEnv}. Must be one of: development, production, test.`,
        required: true
      });
    }

    // Validate DATABASE_PATH
    const dbPath = process.env['DATABASE_PATH'];
    if (dbPath && dbPath.trim() !== '' && !this.validateFormat('DATABASE_PATH', dbPath, 'path')) {
      errors.push({
        variable: 'DATABASE_PATH',
        message: `Invalid database path format: ${dbPath}. Must be a valid file path.`,
        required: true
      });
    }

    // Validate Azure OpenAI endpoint
    const azureEndpoint = process.env['AZURE_OPENAI_ENDPOINT'];
    if (azureEndpoint && azureEndpoint.trim() !== '' && !this.validateFormat('AZURE_OPENAI_ENDPOINT', azureEndpoint, 'url')) {
      errors.push({
        variable: 'AZURE_OPENAI_ENDPOINT',
        message: `Invalid URL format: ${azureEndpoint}. Must start with http:// or https://.`,
        required: true
      });
    }

    // Validate optional URL fields
    const optionalUrls = [
      'AZURE_OPENAI_CODEX_ENDPOINT',
      'SUPABASE_URL',
      'ADMIN_PORTAL_URL'
    ];

    for (const variable of optionalUrls) {
      const value = process.env[variable];
      if (value && value.trim() !== '' && !this.validateFormat(variable, value, 'url')) {
        errors.push({
          variable,
          message: `Invalid URL format: ${value}. Must start with http:// or https://.`,
          required: false
        });
      }
    }

    // Validate optional port fields
    const metricsPort = process.env['METRICS_PORT'];
    if (metricsPort && metricsPort.trim() !== '' && !this.validateFormat('METRICS_PORT', metricsPort, 'port')) {
      errors.push({
        variable: 'METRICS_PORT',
        message: `Invalid port format: ${metricsPort}. Must be a number between 1 and 65535.`,
        required: false
      });
    }
  }

  /**
   * Validate format of a specific variable
   */
  validateFormat(_variable: string, value: string, format: 'url' | 'port' | 'path'): boolean {
    switch (format) {
      case 'url':
        return this.isValidUrl(value);
      case 'port':
        return this.isValidPort(value);
      case 'path':
        return this.isValidPath(value);
      default:
        return false;
    }
  }

  /**
   * Check if value is a valid URL
   */
  private isValidUrl(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://');
  }

  /**
   * Check if value is a valid port number
   */
  private isValidPort(value: string): boolean {
    const port = parseInt(value, 10);
    return !isNaN(port) && port >= 1 && port <= 65535;
  }

  /**
   * Check if value is a valid file path
   */
  private isValidPath(value: string): boolean {
    // Basic path validation - check for invalid characters
    // Allow relative and absolute paths
    const invalidChars = /[<>"|?*\x00-\x1F]/;
    return !invalidChars.test(value) && value.length > 0;
  }

  /**
   * Get list of required variables
   */
  getRequiredVariables(): string[] {
    return [...EnvValidator.REQUIRED_VARIABLES];
  }

  /**
   * Get list of optional variables
   */
  getOptionalVariables(): string[] {
    return [...EnvValidator.OPTIONAL_VARIABLES];
  }
}

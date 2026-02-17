/**
 * Olympus - Gemini Messenger
 * 
 * Main class for Hermes (The Messenger)
 * Bridges Olympus with Gemini 3 Pro
 */

import { Page } from 'playwright';
import { Database } from 'better-sqlite3';
import { GeminiTabManager } from './gemini-tab-manager.js';
import { GeminiResponseParser } from './gemini-response-parser.js';
import { SessionManager } from './session-manager.js';
import { DOMNavigator } from './dom-navigator.js';
import { HermesMetrics, ErrorType } from './types.js';
import { TIMEOUTS, RETRY_CONFIG, GEMINI_SELECTORS } from './config.js';
import { findElement } from './selectors.js';

export class GeminiMessenger {
  private tabManager: GeminiTabManager;
  private responseParser: GeminiResponseParser;
  private sessionManager: SessionManager;
  private domNavigator: DOMNavigator;
  private page: Page | null = null;
  private metrics: HermesMetrics;
  private sessionChecked: boolean = false;
  
  constructor(
    private db: Database,
    page?: Page
  ) {
    this.tabManager = new GeminiTabManager(db);
    this.responseParser = new GeminiResponseParser();
    this.sessionManager = new SessionManager();
    this.domNavigator = new DOMNavigator();
    this.page = page || null;
    
    this.metrics = {
      messagesSent: 0,
      responsesReceived: 0,
      averageResponseTime: 0,
      errors: 0,
      tabSwitches: 0,
      gemsCreated: 0,
      snapshotsTaken: 0,
      refActionsPerformed: 0,
    };
  }
  
  async initialize(): Promise<void> {
    console.log('🏛️  Hermes: Initializing...');
    await this.tabManager.initialize();
    console.log('✅ Hermes initialized!');
  }
  
  setPage(page: Page): void {
    this.page = page;
  }

  async sendToGemini(
    category: string,
    message: string,
    maxRetries: number = RETRY_CONFIG.maxAttempts
  ): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Sending to ${category} (attempt ${attempt}/${maxRetries})...`);
        const response = await this.sendToGeminiOnce(category, message);
        this.metrics.messagesSent++;
        this.metrics.responsesReceived++;
        return response;
      } catch (error) {
        lastError = error as Error;
        const errorType = this.classifyError(error as Error);
        
        if (errorType === ErrorType.PERMANENT || errorType === ErrorType.USER_ERROR) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = Math.min(
            RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.exponentialBase, attempt - 1),
            RETRY_CONFIG.maxDelay
          );
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    this.metrics.errors++;
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
  }
  
  private async sendToGeminiOnce(category: string, message: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser page not set. Call setPage() first.');
    }
    
    const startTime = Date.now();
    const tab = this.tabManager.getTab(category);
    if (!tab) {
      throw new Error(`Tab ${category} not found`);
    }
    
    // Check if we're already on the right page
    const currentUrl = this.page.url();
    const targetUrl = tab.url || '';
    
    console.log(`🔍 Current URL: ${currentUrl}`);
    console.log(`🎯 Target URL: ${targetUrl}`);
    
    // Only navigate if we're not already there
    if (targetUrl && !currentUrl.includes(targetUrl.split('?')[0])) {
      console.log(`📍 Need to navigate to: ${targetUrl}`);
      await this.page.goto(targetUrl, { 
        timeout: TIMEOUTS.navigation,
        waitUntil: 'domcontentloaded'
      });
      await this.page.waitForTimeout(3000);
    } else if (!targetUrl) {
      console.log('📍 No target URL, navigating to Gemini...');
      await this.navigateToGemini();
      await this.page.waitForTimeout(3000);
      const url = this.page.url();
      console.log(`💾 Saving conversation URL: ${url}`);
      this.tabManager.updateTabMetadata(tab.id, { url });
    } else {
      console.log(`✅ Already on correct page, skipping navigation`);
    }
    
    console.log('🔍 Using DOM analysis to find input field...');
    const inputElement = await this.domNavigator.findInputField(this.page);
    
    if (!inputElement) {
      throw new Error('Could not find input field using DOM analysis');
    }
    
    console.log('🖱️  Clicking input field...');
    await inputElement.click();
    await this.page.waitForTimeout(500);
    
    console.log('⌨️  Typing message...');
    await inputElement.fill(message);
    
    console.log('📤 Sending...');
    await this.page.keyboard.press('Enter');
    
    console.log('⏳ Waiting for response...');
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max (60 * 2 seconds)
    
    while (!isComplete && attempts < maxAttempts) {
      await this.page.waitForTimeout(2000);
      isComplete = await this.domNavigator.isResponseComplete(this.page);
      attempts++;
      
      // Only log every 5 attempts to reduce noise
      if (!isComplete && attempts % 5 === 0) {
        console.log(`   Still waiting... (${attempts}/${maxAttempts})`);
      }
    }
    
    if (isComplete) {
      console.log(`✅ Response complete after ${attempts * 2} seconds`);
    } else {
      console.log('⚠️  Response timeout - proceeding anyway');
    }
    
    const responseText = await this.domNavigator.extractResponse(this.page, message);
    const parsed = this.responseParser.parseMarkdown(responseText, category);
    
    this.tabManager.markTabUsed(category);
    this.tabManager.incrementMessageCount(category);
    this.tabManager.updateContextEstimate(category, parsed.metadata.tokensEstimate);
    
    this.saveMessage(tab.id, 'user', message);
    this.saveMessage(tab.id, 'model', responseText);
    
    const duration = Date.now() - startTime;
    this.updateAverageResponseTime(duration);
    
    console.log(`✅ Response received in ${duration}ms`);
    return responseText;
  }

  private async navigateToGemini(): Promise<void> {
    if (!this.page) throw new Error('Page not set');
    console.log('🌐 Navigating to Gemini...');
    await this.page.goto('https://gemini.google.com/app', {
      timeout: TIMEOUTS.navigation,
      waitUntil: 'domcontentloaded',
    });
    await this.page.waitForTimeout(2000);
  }
  
  private async createNewChat(): Promise<void> {
    if (!this.page) throw new Error('Page not set');
    console.log('➕ Creating new chat...');
    const newChatButton = await findElement(this.page, GEMINI_SELECTORS.newChatButton);
    if (newChatButton) {
      await newChatButton.click();
      await this.page.waitForTimeout(1000);
    }
  }
  
  private saveMessage(tabId: string, role: 'user' | 'model', content: string): void {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.db.prepare(`
      INSERT INTO gemini_messages (id, tab_id, role, content, tokens_estimate, timestamp)
      VALUES ($id, $tabId, $role, $content, $tokensEstimate, $timestamp)
    `).run({
      id,
      tabId,
      role,
      content,
      tokensEstimate: Math.ceil(content.length / 4),
      timestamp: new Date().toISOString(),
    });
  }
  
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    if (message.includes('timeout')) return ErrorType.TRANSIENT;
    if (message.includes('network')) return ErrorType.TRANSIENT;
    if (message.includes('selector')) return ErrorType.PERMANENT;
    if (message.includes('not found')) return ErrorType.PERMANENT;
    if (message.includes('invalid')) return ErrorType.USER_ERROR;
    return ErrorType.TRANSIENT;
  }
  
  private updateAverageResponseTime(duration: number): void {
    const total = this.metrics.averageResponseTime * this.metrics.responsesReceived;
    this.metrics.averageResponseTime = (total + duration) / (this.metrics.responsesReceived + 1);
  }
  
  getMetrics(): HermesMetrics {
    return { ...this.metrics };
  }
  
  getTabManager(): GeminiTabManager {
    return this.tabManager;
  }
}

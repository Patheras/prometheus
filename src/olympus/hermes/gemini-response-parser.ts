/**
 * Olympus - Gemini Response Parser
 * 
 * Extracts and parses Gemini responses
 * Handles streaming, markdown, code blocks, etc.
 */

import { Page } from 'playwright';
import { ParsedResponse, CodeBlock, ResponseMetadata } from './types.js';
import { GEMINI_SELECTORS } from './config.js';
import { findElement, waitForElementToDisappear } from './selectors.js';

export class GeminiResponseParser {
  /**
   * Wait for Gemini response to complete
   */
  async waitForResponse(page: Page, timeout: number = 120000): Promise<string> {
    console.log('⏳ Waiting for Gemini response...');
    
    const startTime = Date.now();
    
    // Simple strategy: Just wait a bit for response to appear
    console.log('⏳ Waiting 5 seconds for response...');
    await page.waitForTimeout(5000);
    
    // Check if we have new content
    const fullText = await page.evaluate(() => document.body.innerText);
    
    if (fullText.includes('Hello from Hermes')) {
      console.log('✅ Message sent, waiting for response...');
      
      // Wait for response to appear (check every second)
      let lastLength = fullText.length;
      let stableCount = 0;
      
      for (let i = 0; i < 30; i++) {  // Max 30 seconds
        await page.waitForTimeout(1000);
        
        const currentText = await page.evaluate(() => document.body.innerText);
        const currentLength = currentText.length;
        
        // If content is growing, response is streaming
        if (currentLength > lastLength) {
          console.log(`📝 Response streaming... (${currentLength} chars)`);
          lastLength = currentLength;
          stableCount = 0;
        } else {
          // Content stable
          stableCount++;
          if (stableCount >= 3) {
            // Stable for 3 seconds - response complete!
            console.log('✅ Response complete!');
            break;
          }
        }
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Response received in ${duration}ms`);
    
    // Extract response
    return await this.extractResponse(page);
  }

  /**
   * Wait for content to stabilize (no changes for specified duration)
   */
  private async waitForContentStable(
    page: Page,
    stableDuration: number = 2000
  ): Promise<void> {
    let lastContent = '';
    let stableCount = 0;
    const checksNeeded = Math.ceil(stableDuration / 500);
    
    while (stableCount < checksNeeded) {
      await page.waitForTimeout(500);
      
      // Get current response content
      const responseElement = await findElement(page, GEMINI_SELECTORS.response);
      const currentContent = responseElement
        ? await responseElement.textContent()
        : '';
      
      if (currentContent === lastContent) {
        stableCount++;
      } else {
        stableCount = 0;
        lastContent = currentContent || '';
      }
    }
  }
  
  /**
   * Detect if response is currently streaming
   */
  async detectStreaming(page: Page): Promise<boolean> {
    for (const selector of GEMINI_SELECTORS.streamingIndicator) {
      const element = await page.$(selector);
      if (element) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Extract full response text from page
   */
  async extractResponse(page: Page): Promise<string> {
    // Strategy 1: Try specific selectors first
    for (const selector of GEMINI_SELECTORS.response) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text && text.trim().length > 0) {
            console.log(`✅ Found response with selector: ${selector}`);
            return text.trim();
          }
        }
      } catch {
        continue;
      }
    }
    
    // Strategy 2: Get all page text and extract last message
    console.log('⚠️  Specific selectors failed, using full page text...');
    const fullText = await page.evaluate(() => document.body.innerText);
    
    // Split by common separators and get the last substantial chunk
    const lines = fullText.split('\n').filter(line => line.trim().length > 20);
    
    // Find the response (usually after "Hello from Hermes")
    const userMessageIndex = lines.findIndex(line => 
      line.includes('Hello from Hermes')
    );
    
    if (userMessageIndex >= 0 && userMessageIndex < lines.length - 1) {
      // Get everything after user message
      const responseLines = lines.slice(userMessageIndex + 1);
      const response = responseLines.join('\n').trim();
      
      if (response.length > 0) {
        console.log(`✅ Extracted response from page text (${response.length} chars)`);
        return response;
      }
    }
    
    // Strategy 3: Just return the last substantial text block
    const lastBlock = lines.slice(-5).join('\n').trim();
    console.log(`⚠️  Returning last text block (${lastBlock.length} chars)`);
    return lastBlock;
  }

  /**
   * Parse response into structured format
   */
  parseMarkdown(content: string, category: string): ParsedResponse {
    // Extract code blocks
    const codeBlocks = this.extractCodeBlocks(content);
    
    // Extract images
    const images = this.extractImages(content);
    
    // Extract links
    const links = this.extractLinks(content);
    
    // Extract thinking tags
    const thinking = this.extractThinking(content);
    
    // Remove code blocks, images, thinking from main content
    let cleanContent = content;
    for (const block of codeBlocks) {
      cleanContent = cleanContent.replace(block.code, '');
    }
    
    return {
      content: cleanContent.trim(),
      codeBlocks,
      images,
      links,
      thinking,
      metadata: {
        timestamp: new Date(),
        tokensEstimate: this.estimateTokens(content),
        category,
      },
    };
  }
  
  /**
   * Extract code blocks from markdown
   */
  private extractCodeBlocks(content: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
      });
    }
    
    return blocks;
  }
  
  /**
   * Extract image URLs from markdown
   */
  private extractImages(content: string): string[] {
    const images: string[] = [];
    const regex = /!\[.*?\]\((.*?)\)/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      images.push(match[1]);
    }
    
    return images;
  }
  
  /**
   * Extract links from markdown
   */
  private extractLinks(content: string): string[] {
    const links: string[] = [];
    const regex = /\[.*?\]\((.*?)\)/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1]);
    }
    
    return links;
  }
  
  /**
   * Extract thinking tags content
   */
  private extractThinking(content: string): string | undefined {
    const match = content.match(/<think>([\s\S]*?)<\/think>/);
    return match ? match[1].trim() : undefined;
  }
  
  /**
   * Estimate token count (simple method)
   */
  private estimateTokens(content: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }
}

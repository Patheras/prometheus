/**
 * Olympus - DOM Navigator
 * 
 * Uses DeepSeek-R1 with DOM analysis to navigate Gemini UI
 * No hardcoded selectors - AI analyzes DOM and figures it out!
 */

import { Page, Locator } from 'playwright';

export class DOMNavigator {
  private lmstudioUrl: string;
  
  constructor(lmstudioUrl: string = 'http://localhost:1234') {
    this.lmstudioUrl = lmstudioUrl;
  }
  
  /**
   * Call LM Studio (text-only)
   */
  private async callLLM(prompt: string): Promise<string> {
    const response = await fetch(`${this.lmstudioUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-r1-0528-qwen3-8b',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
  
  /**
   * Get simplified DOM structure for AI analysis
   */
  private async getDOMStructure(page: Page): Promise<string> {
    // Extract all textareas and inputs with their attributes
    return await page.evaluate(() => {
      const elements: string[] = [];
      
      // Find all textareas
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach((el, idx) => {
        const id = el.id || '';
        const classes = el.className || '';
        const role = el.getAttribute('role') || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const placeholder = el.getAttribute('placeholder') || '';
        elements.push(`textarea[${idx}] id="${id}" class="${classes}" role="${role}" aria-label="${ariaLabel}" placeholder="${placeholder}"`);
      });
      
      // Find all inputs
      const inputs = document.querySelectorAll('input');
      inputs.forEach((el, idx) => {
        const id = el.id || '';
        const classes = el.className || '';
        const type = el.getAttribute('type') || '';
        const role = el.getAttribute('role') || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const placeholder = el.getAttribute('placeholder') || '';
        elements.push(`input[${idx}] id="${id}" class="${classes}" type="${type}" role="${role}" aria-label="${ariaLabel}" placeholder="${placeholder}"`);
      });
      
      // Find contenteditable divs
      const editableDivs = document.querySelectorAll('div[contenteditable="true"]');
      editableDivs.forEach((el, idx) => {
        const id = el.id || '';
        const classes = el.className || '';
        const role = el.getAttribute('role') || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        elements.push(`div[contenteditable][${idx}] id="${id}" class="${classes}" role="${role}" aria-label="${ariaLabel}"`);
      });
      
      return elements.join('\n');
    });
  }
  
  /**
   * Find input field using DOM analysis
   */
  async findInputField(page: Page): Promise<Locator | null> {
    console.log('🔍 Looking for input field...');
    
    // FAST PATH: Try hardcoded selectors first (much faster!)
    const quickSelectors = [
      '[aria-label="Enter a prompt for Gemini"]',
      '[contenteditable][class*="textarea"]',
      'div[role="textbox"]',
      'textarea',
      'div[contenteditable="true"]',
    ];
    
    for (const selector of quickSelectors) {
      const element = page.locator(selector).first();
      const count = await element.count();
      
      if (count > 0) {
        console.log(`✅ Found input field: ${selector}`);
        return element;
      }
    }
    
    // SLOW PATH: If hardcoded selectors fail, use AI analysis
    console.log('⚠️  Quick selectors failed, using AI analysis...');
    console.log('🔍 Analyzing DOM structure...');
    
    // Get DOM structure
    const domStructure = await this.getDOMStructure(page);
    console.log('📄 DOM structure (first 500 chars):', domStructure.substring(0, 500));
    
    console.log('🤖 Asking DeepSeek-R1 to find input field...');
    
    // Ask DeepSeek to analyze DOM
    const prompt = `You are analyzing a Gemini (Google AI) chat interface DOM structure.

Your task: Find the INPUT FIELD where users type messages.

DOM Structure:
${domStructure}

Look for:
- <textarea> elements
- <input> elements with type="text"
- Elements with role="textbox"
- Elements with placeholder text about typing messages
- Usually at the bottom of the page

Respond in JSON format:
{
  "found": true/false,
  "selector": "CSS selector to find the element",
  "reasoning": "why you chose this selector"
}

Example selectors:
- "textarea[placeholder*='message']"
- "div[role='textbox']"
- "textarea.input-class"
- "#input-id"

Be specific and use attributes that uniquely identify the input field.`;

    const responseText = await this.callLLM(prompt);
    console.log('🤖 DeepSeek response:', responseText);
    
    // Parse response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('⚠️  No JSON found in response');
        return null;
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      if (!result.found || !result.selector) {
        console.log('❌ Input field not found');
        return null;
      }
      
      console.log(`✅ Found selector: ${result.selector}`);
      console.log(`   Reasoning: ${result.reasoning}`);
      
      // Try to find element with the selector
      const element = page.locator(result.selector).first();
      
      // Verify it exists
      const count = await element.count();
      if (count === 0) {
        console.log('⚠️  Selector found no elements, trying fallback...');
        return await this.fallbackInputSearch(page);
      }
      
      return element;
      
    } catch (error) {
      console.error('❌ Failed to parse DeepSeek response:', error);
      return await this.fallbackInputSearch(page);
    }
  }
  
  /**
   * Fallback: Simple heuristic search for input field
   */
  private async fallbackInputSearch(page: Page): Promise<Locator | null> {
    console.log('🔄 Using fallback input search...');
    
    // Try common patterns
    const patterns = [
      'textarea',
      'div[role="textbox"]',
      'div[contenteditable="true"]',
      'input[type="text"]',
      'textarea[placeholder*="message"]',
      'textarea[placeholder*="Message"]',
      'div.input-area textarea',
    ];
    
    for (const pattern of patterns) {
      const element = page.locator(pattern).first();
      const count = await element.count();
      
      if (count > 0) {
        console.log(`✅ Fallback found: ${pattern}`);
        return element;
      }
    }
    
    console.log('❌ No input field found with fallback');
    return null;
  }
  
  /**
   * Check if response is complete by looking for action buttons
   */
  async isResponseComplete(page: Page): Promise<boolean> {
    // Look for the action buttons that appear after response is complete
    const hasActionButtons = await page.evaluate(() => {
      // Look for common action button patterns in Gemini
      const buttonSelectors = [
        'button[aria-label*="Good response"]',
        'button[aria-label*="Bad response"]',
        'button[aria-label*="Copy"]',
        'button[title*="Copy"]',
        'button[aria-label*="Refresh"]',
        '[data-test-id*="copy"]',
        '[data-test-id*="thumbs"]',
      ];
      
      // Check if any action buttons exist
      for (const selector of buttonSelectors) {
        const buttons = document.querySelectorAll(selector);
        if (buttons.length > 0) {
          // Make sure it's visible (not hidden)
          for (const button of Array.from(buttons)) {
            const rect = button.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return true;
            }
          }
        }
      }
      
      // Alternative: Look for any buttons near the last message
      // that have common action icons (thumbs, copy, etc.)
      const allButtons = Array.from(document.querySelectorAll('button'));
      const lastButtons = allButtons.slice(-10); // Check last 10 buttons
      
      for (const button of lastButtons) {
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        const title = button.getAttribute('title')?.toLowerCase() || '';
        const text = button.textContent?.toLowerCase() || '';
        
        // Check for action-related keywords
        const actionKeywords = ['copy', 'thumb', 'good', 'bad', 'refresh', 'share', 'more'];
        const hasActionKeyword = actionKeywords.some(keyword => 
          ariaLabel.includes(keyword) || title.includes(keyword) || text.includes(keyword)
        );
        
        if (hasActionKeyword) {
          const rect = button.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return true;
          }
        }
      }
      
      return false;
    });
    
    return hasActionButtons;
  }
  
  /**
   * Extract response text from DOM
   */
  async extractResponse(page: Page, _userMessage: string): Promise<string> {
    console.log('📄 Extracting response from DOM...');
    
    // Get the last model response
    const responseText = await page.evaluate(() => {
      // Try to find model response containers
      const selectors = [
        '[data-message-author-role="model"]',
        '.model-response-text',
        '.response-container-content',
        '[class*="model-turn"]',
        '[class*="response"]',
      ];
      
      let modelMessages: Element[] = [];
      
      // Try each selector
      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          modelMessages = elements;
          break;
        }
      }
      
      // If no specific model messages found, try to find all message-like containers
      if (modelMessages.length === 0) {
        // Look for divs that might contain messages
        const allDivs = Array.from(document.querySelectorAll('div[class*="message"], div[class*="turn"], div[class*="response"]'));
        modelMessages = allDivs;
      }
      
      // Get the last message (should be Gemini's response)
      if (modelMessages.length > 0) {
        const lastMessage = modelMessages[modelMessages.length - 1];
        
        // Try to get text content, excluding buttons and UI elements
        const clonedMessage = lastMessage.cloneNode(true) as Element;
        
        // Remove buttons, icons, and other UI elements
        const elementsToRemove = clonedMessage.querySelectorAll('button, svg, [role="button"], [class*="icon"], [class*="button"]');
        elementsToRemove.forEach(el => el.remove());
        
        return clonedMessage.textContent?.trim() || '';
      }
      
      // Fallback: get all text from main content area
      const mainContent = document.querySelector('main') || document.body;
      return mainContent.textContent?.trim() || '';
    });
    
    console.log(`✅ Extracted response (first 200 chars): ${responseText.substring(0, 200)}`);
    return responseText;
  }
}

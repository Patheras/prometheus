/**
 * Example 2: Form Filling and Submission
 * 
 * This example demonstrates:
 * - Navigating to a page with a form
 * - Filling out form fields
 * - Selecting options from dropdowns
 * - Clicking buttons
 * - Waiting for navigation after form submission
 * 
 * Requirements: 2.3, 2.4, 6.2, 6.3, 6.4
 */

import { initializeBrowserAutomation, shutdownBrowserAutomation } from '../init.js';

async function formFillingAndSubmission() {
  console.log('=== Example 2: Form Filling and Submission ===\n');

  try {
    // Step 1: Initialize the system
    console.log('1. Initializing browser automation system...');
    const system = await initializeBrowserAutomation({
      browser: {
        headless: false,
        defaultTimeout: 30000,
      },
    });
    console.log('   ✓ System initialized\n');

    const browserManager = system.getBrowserManager();

    // Step 2: Navigate to a form page
    // Using httpbin.org's forms endpoint as an example
    console.log('2. Navigating to form page...');
    const navigateResult = await browserManager.executeAction({
      type: 'navigate',
      url: 'https://httpbin.org/forms/post',
      waitUntil: 'networkidle',
    });

    if (!navigateResult.success) {
      throw new Error(`Navigation failed: ${navigateResult.error?.message}`);
    }
    console.log('   ✓ Form page loaded\n');

    // Step 3: Fill in text input fields
    console.log('3. Filling in form fields...');
    
    // Fill customer name
    const nameResult = await browserManager.executeAction({
      type: 'type',
      selector: 'input[name="custname"]',
      text: 'John Doe',
      delay: 50, // Delay between keystrokes in milliseconds
    });
    console.log(`   ✓ Customer name: ${nameResult.success ? 'filled' : 'failed'}`);

    // Fill telephone
    const phoneResult = await browserManager.executeAction({
      type: 'type',
      selector: 'input[name="custtel"]',
      text: '555-1234',
    });
    console.log(`   ✓ Telephone: ${phoneResult.success ? 'filled' : 'failed'}`);

    // Fill email
    const emailResult = await browserManager.executeAction({
      type: 'type',
      selector: 'input[name="custemail"]',
      text: 'john.doe@example.com',
    });
    console.log(`   ✓ Email: ${emailResult.success ? 'filled' : 'failed'}\n`);

    // Step 4: Select from dropdown
    console.log('4. Selecting pizza size...');
    const selectResult = await browserManager.executeAction({
      type: 'select',
      selector: 'select[name="size"]',
      values: ['medium'],
    });
    console.log(`   ✓ Size selected: ${selectResult.success ? 'medium' : 'failed'}\n`);

    // Step 5: Check checkboxes
    console.log('5. Selecting pizza toppings...');
    
    // Click bacon checkbox
    const baconResult = await browserManager.executeAction({
      type: 'click',
      selector: 'input[name="topping"][value="bacon"]',
    });
    console.log(`   ✓ Bacon: ${baconResult.success ? 'selected' : 'failed'}`);

    // Click cheese checkbox
    const cheeseResult = await browserManager.executeAction({
      type: 'click',
      selector: 'input[name="topping"][value="cheese"]',
    });
    console.log(`   ✓ Cheese: ${cheeseResult.success ? 'selected' : 'failed'}\n`);

    // Step 6: Fill textarea
    console.log('6. Adding delivery instructions...');
    const instructionsResult = await browserManager.executeAction({
      type: 'type',
      selector: 'textarea[name="delivery"]',
      text: 'Please ring the doorbell twice.',
    });
    console.log(`   ✓ Instructions: ${instructionsResult.success ? 'added' : 'failed'}\n`);

    // Step 7: Take a screenshot before submission
    console.log('7. Taking screenshot before submission...');
    const beforeScreenshot = await browserManager.executeAction({
      type: 'screenshot',
      fullPage: true,
      format: 'png',
    });
    if (beforeScreenshot.success) {
      console.log('   ✓ Screenshot captured\n');
    }

    // Step 8: Submit the form
    console.log('8. Submitting the form...');
    const submitResult = await browserManager.executeAction({
      type: 'click',
      selector: 'button[type="submit"]',
    });

    if (!submitResult.success) {
      throw new Error(`Form submission failed: ${submitResult.error?.message}`);
    }
    console.log('   ✓ Form submitted\n');

    // Step 9: Wait for navigation to complete
    console.log('9. Waiting for response page...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for page to load

    // Step 10: Verify we're on the results page
    const verifyResult = await browserManager.executeAction({
      type: 'execute_js',
      script: 'document.body.innerText',
    });

    if (verifyResult.success) {
      console.log('   ✓ Response received');
      console.log(`   - Response preview: ${verifyResult.result.substring(0, 100)}...\n`);
    }

    // Step 11: Take a screenshot after submission
    console.log('10. Taking screenshot after submission...');
    const afterScreenshot = await browserManager.executeAction({
      type: 'screenshot',
      fullPage: true,
      format: 'png',
    });
    if (afterScreenshot.success) {
      console.log('   ✓ Screenshot captured\n');
    }

    console.log('=== Example completed successfully! ===');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean up
    console.log('\n11. Shutting down...');
    await shutdownBrowserAutomation();
    console.log('   ✓ Shutdown complete');
  }
}

// Alternative example: Using fill instead of type for faster input
async function formFillingWithFill() {
  console.log('=== Alternative: Using fill() for faster input ===\n');

  try {
    const system = await initializeBrowserAutomation();
    const browserManager = system.getBrowserManager();

    await browserManager.executeAction({
      type: 'navigate',
      url: 'https://httpbin.org/forms/post',
      waitUntil: 'networkidle',
    });

    // fill() is faster than type() as it doesn't simulate keystrokes
    console.log('Filling form with fill() method...');
    
    await browserManager.executeAction({
      type: 'fill',
      selector: 'input[name="custname"]',
      value: 'Jane Smith',
    });

    await browserManager.executeAction({
      type: 'fill',
      selector: 'input[name="custemail"]',
      value: 'jane.smith@example.com',
    });

    console.log('✓ Form filled quickly with fill() method\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await shutdownBrowserAutomation();
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  formFillingAndSubmission().catch(console.error);
}

export { formFillingAndSubmission, formFillingWithFill };

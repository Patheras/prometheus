# Olympus - Hermes Implementation Tasks

## Overview
Implementation tasks for Hermes (The Messenger) - the browser agent that bridges Olympus with Gemini 3 Pro.

**Timeline:** 6 days
**Status:** 🚀 Ready to start

---

## Phase 1: Core Infrastructure (Day 1)

### 1.1 Project Structure Setup
- [ ] Create `src/olympus/` directory
- [ ] Create `src/olympus/hermes/` directory
- [ ] Create `src/olympus/hermes/__tests__/` directory
- [ ] Create `src/olympus/hermes/types.ts` with core interfaces
- [ ] Create `src/olympus/hermes/config.ts` with configuration
- [ ] Create `src/olympus/hermes/index.ts` as main export

**Acceptance:** Directory structure exists, TypeScript compiles

### 1.2 Database Schema
- [ ] Create migration file for Gemini tabs table
- [ ] Create migration file for Gemini messages table
- [ ] Create migration file for Gemini gems table
- [ ] Create migration file for gem-tab associations
- [ ] Run migrations and verify schema

**Acceptance:** All tables created, indexes in place

### 1.3 Gemini Tab Manager (Basic)
- [ ] Create `gemini-tab-manager.ts`
- [ ] Implement `initializeTabs()` - create 20 category tabs
- [ ] Implement `getTab(category)` - retrieve tab by category
- [ ] Implement `listTabs()` - list all tabs
- [ ] Implement `updateTabMetadata()` - update tab info
- [ ] Write unit tests for tab manager

**Acceptance:** Can create and manage 20 tabs in database

---

## Phase 2: Browser Integration (Day 2)

### 2.1 Browser Profile Setup
- [ ] Create Hermes browser profile configuration
- [ ] Initialize ProfileManager with 'olympus-hermes' profile
- [ ] Configure browser launch options (headless: false, viewport, etc.)
- [ ] Test browser launches with Hermes profile
- [ ] Verify Gemini session persists across restarts

**Acceptance:** Browser launches with dedicated profile, Gemini stays logged in

### 2.2 Selector Strategies (OpenClaw Pattern)
- [ ] Create `selectors.ts` with multi-layered selectors
- [ ] Define input field selectors (textarea, contenteditable, etc.)
- [ ] Define response selectors (.model-response, etc.)
- [ ] Define streaming indicator selectors
- [ ] Implement `findElement()` with fallback logic
- [ ] Write tests for selector strategies

**Acceptance:** Selectors work with current Gemini UI, fallback logic tested

### 2.3 Basic Navigation
- [ ] Implement `navigateToGemini()` - go to gemini.google.com
- [ ] Implement `navigateToTab(tabId)` - switch to specific tab
- [ ] Implement `createNewChat()` - start new conversation
- [ ] Handle navigation errors and timeouts
- [ ] Write integration tests

**Acceptance:** Can navigate to Gemini and switch between tabs

---

## Phase 3: Core Messaging (Day 3)

### 3.1 Response Parser
- [ ] Create `gemini-response-parser.ts`
- [ ] Implement `waitForResponse()` - wait for streaming to complete
- [ ] Implement `detectStreaming()` - detect if response is streaming
- [ ] Implement `extractResponse()` - get full response text
- [ ] Implement `parseMarkdown()` - parse response format
- [ ] Handle code blocks, images, links extraction
- [ ] Write unit tests for parser

**Acceptance:** Can detect and extract complete Gemini responses

### 3.2 Send Message (Basic)
- [ ] Create `gemini-messenger.ts` main class
- [ ] Implement `sendToGemini(category, message)` - basic version
- [ ] Type message in input field
- [ ] Press Enter to send
- [ ] Wait for response
- [ ] Extract and return response
- [ ] Write integration test: send "Hello" to Coding tab

**Acceptance:** ✅ **HERMES SENDS FIRST MESSAGE TO GEMINI!** 🎉

### 3.3 Error Handling
- [ ] Implement error classification (transient, permanent, user)
- [ ] Implement retry logic with exponential backoff
- [ ] Handle timeout errors
- [ ] Handle selector not found errors
- [ ] Handle session expiry
- [ ] Write error handling tests

**Acceptance:** Errors are classified and handled appropriately

---

## Phase 4: OpenClaw Snapshot Integration (Day 4)

### 4.1 Accessibility Snapshot
- [ ] Create `snapshot-generator.ts`
- [ ] Implement `takeSnapshot()` using Playwright accessibility API
- [ ] Generate element refs (e1, e2, e3...)
- [ ] Extract interactive elements (buttons, inputs, links)
- [ ] Format accessibility tree as compact string
- [ ] Write unit tests for snapshot generation

**Acceptance:** Can generate accessibility snapshot with refs

### 4.2 Ref-Based Actions
- [ ] Implement `click(category, ref)` - click using ref
- [ ] Implement `type(category, ref, text)` - type using ref
- [ ] Implement ref validation (check ref exists)
- [ ] Implement ref-to-selector mapping
- [ ] Invalidate refs after navigation
- [ ] Write tests for ref-based actions

**Acceptance:** Can perform actions using refs instead of CSS selectors

### 4.3 Snapshot Workflow
- [ ] Update `sendToGemini()` to use snapshot workflow
- [ ] Take snapshot before actions
- [ ] Use refs for interactions
- [ ] Invalidate refs after page changes
- [ ] Write integration test: snapshot → type → click workflow

**Acceptance:** Full snapshot-based workflow works end-to-end

---

## Phase 5: Advanced Features (Day 5)

### 5.1 Gem Management
- [ ] Create `gemini-gem-manager.ts`
- [ ] Implement `createGem(name, instructions)` - create Gem via UI
- [ ] Implement `listGems()` - get all Gems
- [ ] Implement `associateGemWithTab(gemId, tabId)` - link Gem to tab
- [ ] Store Gem metadata in database
- [ ] Write tests for Gem management

**Acceptance:** Can create Gems and associate with tabs

### 5.2 Context Management
- [ ] Create `context-estimator.ts`
- [ ] Implement token estimation for messages
- [ ] Track context usage per tab
- [ ] Implement context rotation (summarize when near limit)
- [ ] Alert when tab context is 90% full
- [ ] Write tests for context estimation

**Acceptance:** Context usage is tracked and managed

### 5.3 Tab Health Monitoring
- [ ] Create `tab-health-monitor.ts`
- [ ] Implement `getTabHealth()` - check all tabs
- [ ] Track last used timestamp
- [ ] Track message count
- [ ] Track context estimate
- [ ] Detect idle tabs
- [ ] Write tests for health monitoring

**Acceptance:** Can monitor health of all 20 tabs

---

## Phase 6: Polish & Testing (Day 6)

### 6.1 Metrics Collection
- [ ] Create `metrics-collector.ts`
- [ ] Track messages sent/received
- [ ] Track average response time
- [ ] Track errors
- [ ] Track tab switches
- [ ] Implement metrics export
- [ ] Write tests for metrics

**Acceptance:** Metrics are collected and exportable

### 6.2 Console Logging
- [ ] Implement browser console listener
- [ ] Store console logs
- [ ] Implement `getConsoleLogs()` method
- [ ] Filter logs by level (error, warn, info)
- [ ] Write tests for console logging

**Acceptance:** Browser console logs are captured

### 6.3 Dialog Handling
- [ ] Implement dialog event handlers
- [ ] Auto-accept alerts
- [ ] Auto-accept confirms
- [ ] Log dialog messages
- [ ] Write tests for dialog handling

**Acceptance:** Dialogs are handled automatically

### 6.4 Integration Tests
- [ ] Test: Initialize Hermes
- [ ] Test: Send message to Coding tab
- [ ] Test: Send follow-up message (context preserved)
- [ ] Test: Switch between tabs
- [ ] Test: Create Gem
- [ ] Test: Take snapshot and use refs
- [ ] Test: Error recovery
- [ ] Test: Full workflow (send → receive → parse)

**Acceptance:** All integration tests pass

### 6.5 Documentation
- [ ] Write user guide (how to use Hermes)
- [ ] Write developer guide (architecture, code structure)
- [ ] Document configuration options
- [ ] Add code comments
- [ ] Create example usage scripts

**Acceptance:** Documentation is complete and clear

---

## Phase 7: First Real Test (Day 7)

### 7.1 Gemini "Hello World"
- [ ] Initialize Hermes with real Gemini account
- [ ] Send "Hello, I am Hermes!" to General tab
- [ ] Verify response is received
- [ ] Log the interaction
- [ ] Celebrate! 🎉

**Acceptance:** ✅ **HERMES SUCCESSFULLY TALKS TO GEMINI 3 PRO!**

### 7.2 Multi-Tab Test
- [ ] Send coding question to Coding tab
- [ ] Send design question to Design tab
- [ ] Send social media question to Social Media tab
- [ ] Verify context isolation (tabs don't interfere)
- [ ] Verify responses are category-appropriate

**Acceptance:** Multiple tabs work independently

### 7.3 Context Preservation Test
- [ ] Send: "My name is Zeus" to Coding tab
- [ ] Send: "What is my name?" to Coding tab
- [ ] Verify Gemini remembers "Zeus"
- [ ] Send: "What is my name?" to Design tab
- [ ] Verify Design tab doesn't know (context isolated)

**Acceptance:** Context is preserved within tabs, isolated between tabs

---

## Bonus Tasks (Optional)

### B.1 Screenshot Integration
- [ ] Integrate screenshot file storage (already done in test-wikipedia.ts)
- [ ] Save screenshots to `./screenshots/gemini/`
- [ ] Return `MEDIA:<path>` instead of base64
- [ ] Test screenshot workflow

### B.2 Upload Support
- [ ] Implement file upload to Gemini
- [ ] Support image upload for analysis
- [ ] Support document upload
- [ ] Test upload workflow

### B.3 Deep Research Integration
- [ ] Detect when to use Gemini Deep Research
- [ ] Handle longer response times (up to 5 minutes)
- [ ] Parse Deep Research results
- [ ] Test Deep Research workflow

---

## Success Criteria

### Functional
- ✅ Hermes can send messages to Gemini
- ✅ Hermes can receive and parse responses
- ✅ Hermes can manage 20 tabs
- ✅ Hermes can create Gems
- ✅ Hermes can take snapshots and use refs
- ✅ Hermes handles errors gracefully

### Performance
- ✅ Response time < 30 seconds
- ✅ Tab switch time < 2 seconds
- ✅ Startup time < 5 seconds

### Reliability
- ✅ 99% uptime (handles UI changes)
- ✅ Auto-retry on transient failures
- ✅ Session persists across restarts

---

## Timeline Summary

| Day | Phase | Key Deliverable |
|-----|-------|----------------|
| 1 | Infrastructure | Database schema, tab manager |
| 2 | Browser Integration | Profile setup, navigation |
| 3 | Core Messaging | **First message to Gemini!** 🎉 |
| 4 | Snapshot Integration | Ref-based actions |
| 5 | Advanced Features | Gems, context management |
| 6 | Polish & Testing | Metrics, tests, docs |
| 7 | Real Test | **Hermes talks to Gemini 3 Pro!** 🏛️ |

---

## Notes

- **Priority:** Focus on getting first message working (Day 3)
- **OpenClaw Patterns:** Use snapshot-based approach, ref-based actions
- **Testing:** Write tests as you go, don't wait until end
- **Documentation:** Document as you code
- **Iteration:** Expect to iterate on selectors as Gemini UI changes

---

## Ready to Start! 🚀

**First task:** Create project structure (Task 1.1)

Let's build Hermes! 🏛️⚡

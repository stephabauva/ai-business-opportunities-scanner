# AI Business Opportunity Scanner - MVP Development Plan

## Overview
Build a web application that analyzes company descriptions and generates AI implementation opportunities with a prioritized roadmap. The MVP will be completed in 2 hours with support for both OpenAI and Google Gemini APIs.

## Technical Stack
- **Frontend**: Single HTML file with inline CSS and JavaScript
- **Backend**: Node.js with Express.js
- **AI Providers**: OpenAI API and Google Gemini API
- **PDF Generation**: PDFKit
- **File Upload**: Multer
- **Deployment**: Local development server (with ngrok option for public access)

## Model Tiers
| Tier | OpenAI | Google Gemini | Use Case |
|------|---------|---------------|----------|
| Nano | gpt-4.1-nano-2025-04-14 | gemini-1.5-flash-8b, gemini-2.0-flash-lite | Fast, cost-effective analysis |
| Mini | o4-mini-2025-04-16 | Gemini-1.5-flash | Balanced performance |
| Standard | gpt-4.1-2025-04-14 | Gemini-1.5-pro | Most comprehensive analysis |

## Development Timeline (2 Hours)

### Task 1: Project Setup and Dependencies (10 minutes)

**Objective**: Initialize the project with all required dependencies

**Steps**:
1. Create project directory structure:
   ```
   ai-business-scanner/
   ├── server.js
   ├── index.html
   ├── package.json
   └── uploads/ (temporary file storage)
   ```

2. Initialize npm and install dependencies:
   ```bash
   npm init -y
   npm install express multer cors openai @google/generative-ai pdfkit
   ```

3. Create `.gitignore` for node_modules and uploads folder

**Deliverable**: Working Node.js project with all dependencies installed

---

### Task 2: Frontend Development (25 minutes)

**Objective**: Create a single-page interface for user interaction

**Components**:
1. **Provider Selection**
   - Radio buttons for OpenAI/Google selection
   - Dynamic API key label update

2. **Model Selection**
   - Dropdown with Nano/Mini/Standard options
   - Model descriptions on hover

3. **Input Fields**
   - API key input (password field)
   - Company description textarea (min 100 chars)
   - File upload (optional, accepts .txt, .pdf)

4. **UI Elements**
   - Submit button with loading state
   - Results display area
   - Download PDF button (appears after analysis)
   - Error message display

5. **Styling**
   - Clean, minimal CSS
   - Responsive layout
   - Professional color scheme

**Technical Details**:
- Use Fetch API for backend communication
- Form validation before submission
- Loading spinner during processing
- Clear error messages

**Deliverable**: Complete HTML file with all UI elements and client-side logic

---

### Task 3: Backend Server Setup (25 minutes)

**Objective**: Create Express server with necessary endpoints

**Endpoints**:
1. `GET /` - Serve the HTML file
2. `POST /api/analyze` - Main analysis endpoint
3. `GET /api/download/:id` - PDF download endpoint

**Features**:
1. **CORS Configuration**
   ```javascript
   app.use(cors({
     origin: '*',
     methods: ['GET', 'POST']
   }));
   ```

2. **File Upload Handling**
   - Configure Multer for file uploads
   - Set file size limit (5MB)
   - Accept only .txt and .pdf files

3. **Request Validation**
   - Check required fields
   - Validate API key format
   - Validate provider and model selection

4. **Error Handling**
   - Global error handler
   - Specific error messages
   - Proper HTTP status codes

**Deliverable**: Express server with all endpoints configured

---

### Task 4: AI Provider Integration (35 minutes)

**Objective**: Implement both OpenAI and Google Gemini support

**Implementation**:

1. **Provider Factory Pattern**
   ```javascript
   const analyzeWithProvider = async (provider, model, apiKey, content) => {
     if (provider === 'openai') {
       return analyzeWithOpenAI(model, apiKey, content);
     } else {
       return analyzeWithGemini(model, apiKey, content);
     }
   };
   ```

2. **Unified Prompt Template**
   ```
   Analyze this company description and identify 3-5 specific AI implementation opportunities.
   For each opportunity provide:
   - Title
   - Description (2-3 sentences)
   - Impact (High/Medium/Low)
   - Effort (High/Medium/Low)
   - Priority Score (1-10)
   
   Company Description: [USER_INPUT]
   
   Return as JSON array.
   ```

3. **Model Mapping**
   ```javascript
   const modelMap = {
     openai: {
       nano: 'gpt-3.5-turbo',
       mini: 'gpt-4o-mini',
       standard: 'gpt-4o'
     },
     google: {
       nano: 'gemini-1.5-flash',
       mini: 'gemini-1.5-flash-8b',
       standard: 'gemini-1.5-pro'
     }
   };
   ```

4. **Response Processing**
   - Parse AI responses
   - Validate JSON structure
   - Add impact/effort matrix calculations
   - Sort by priority

**Deliverable**: Working AI analysis with both providers

---

### Task 5: PDF Generation (20 minutes)

**Objective**: Convert analysis results to professional PDF report

**PDF Structure**:
1. **Header**
   - Company name/description summary
   - Analysis date
   - AI provider used

2. **Executive Summary**
   - Total opportunities identified
   - High-priority items count

3. **Opportunities Section**
   - Each opportunity as a section
   - Visual impact/effort matrix
   - Priority scoring

4. **Implementation Roadmap**
   - Sorted by priority
   - Timeline suggestions
   - Quick wins highlighted

**Technical Implementation**:
- Use PDFKit for generation
- Store temporarily with unique ID
- Auto-cleanup after download

**Deliverable**: Downloadable PDF reports

---

### Task 6: Testing and Debugging (5 minutes)

**Objective**: Ensure all features work correctly

**Test Cases**:
1. Test with both providers
2. Test all model tiers
3. Test with/without file upload
4. Test error scenarios:
   - Invalid API key
   - Network errors
   - Large files
   - Invalid inputs

**Quick Fixes**:
- Common error resolutions
- Performance optimizations
- UI/UX improvements

**Deliverable**: Fully functional MVP

---

### Task 7: Deployment Preparation (5 minutes)

**Objective**: Ready for local deployment and demo

**Steps**:
1. Create `README.md` with:
   - Setup instructions
   - API key acquisition guide
   - Usage examples

2. Environment setup:
   ```bash
   # Start server
   node server.js
   
   # Access at http://localhost:3000
   ```

3. Optional public access:
   ```bash
   # Install ngrok
   ngrok http 3000
   ```

**Deliverable**: Deployable application with documentation

---

## Success Criteria
- [ ] User can select between OpenAI and Google Gemini
- [ ] User can choose from three model tiers
- [ ] Company descriptions are analyzed successfully
- [ ] 3-5 AI opportunities are generated
- [ ] PDF report is downloadable
- [ ] Error handling works properly
- [ ] Application runs without crashes

## Time Buffer
- 10 minutes reserved for unexpected issues
- Can be used for:
  - Additional testing
  - UI polish
  - Performance optimization
  - Documentation updates

## Post-MVP Considerations (Not for today)
- Database for storing analyses
- User authentication
- Multiple file format support
- Email report delivery
- API rate limiting
- Production deployment
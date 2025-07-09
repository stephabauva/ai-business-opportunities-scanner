# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI Business Opportunity Scanner MVP that analyzes company descriptions and generates AI implementation opportunities with prioritized roadmaps. The application supports both OpenAI and Google Gemini APIs with three model tiers (Nano, Mini, Standard).

## Common Commands

```bash
# Start the development server
npm start
# or
npm run dev

# Install dependencies
npm install

# Run the application (starts Express server on port 3000)
node server.js
```

## Architecture

### Core Components
- **server.js**: Express.js backend with three main endpoints:
  - `GET /` - Serves the HTML file
  - `POST /api/analyze` - Main analysis endpoint that processes company descriptions
  - `GET /api/download/:id` - PDF download endpoint
- **index.html**: Single-page frontend with inline CSS and JavaScript
- **uploads/**: Temporary file storage for uploaded documents

### AI Integration
The application uses a provider factory pattern to support multiple AI services:
- **OpenAI**: gpt-4.1-nano, o4-mini, gpt-4.1 models
- **Google Gemini**: gemini-1.5-flash-8b, gemini-1.5-flash, gemini-1.5-pro models

### Data Flow
1. User selects AI provider and model tier
2. Submits company description (text or file upload)
3. Backend processes request through selected AI provider
4. AI generates 3-5 opportunities with impact/effort scoring
5. Results formatted and returned as JSON
6. PDF report generated using PDFKit
7. User can download comprehensive report

### Key Dependencies
- **express**: Web server framework
- **multer**: File upload handling (supports .txt, .pdf up to 5MB)
- **cors**: Cross-origin resource sharing
- **openai**: OpenAI API client
- **@google/generative-ai**: Google Gemini API client
- **pdfkit**: PDF generation for reports

## Development Notes

### Model Mapping
The application maps user-friendly tier names to specific model identifiers:
- Nano: Fast, cost-effective analysis
- Mini: Balanced performance
- Standard: Most comprehensive analysis

### File Structure
This is a minimal MVP with a flat structure. The main server logic handles routing, AI integration, and PDF generation in a single file. Frontend is contained in one HTML file with inline styles and JavaScript.

### MVP Development Plan
The project follows a 7-task development timeline documented in `MVP_DEVELOPMENT_PLAN.md`. Task 1 (project setup) is complete. Remaining tasks focus on frontend development, backend endpoints, AI integration, PDF generation, testing, and deployment preparation.
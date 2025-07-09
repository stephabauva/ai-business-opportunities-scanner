# Vercel Deployment Errors and Solutions

## Error 1: Mixed Configuration Syntax
**Error Message:** "The function property cannot be used in conjunction with build..."

**Problem:** The original `vercel.json` mixed old (`builds`, `routes`) and new (`functions`, `rewrites`) configuration syntax.

**Solution:** 
- Removed `builds` and `routes` properties
- Used only `functions` configuration
- Moved `server.js` to `api/server.js` for proper serverless function structure

## Error 2: Missing Public Directory
**Error Message:** "No Output Directory named 'public' found after the Build completed."

**Problem:** Vercel expected static files in a `public` directory, but the project had `index.html` in the root.

**Solution:**
- Created `public/` directory
- Moved `index.html` to `public/index.html`
- Updated server path references to `../public/index.html`
- Removed unnecessary rewrites from `vercel.json`

## Final Working Configuration

```json
{
  "functions": {
    "api/server.js": {
      "maxDuration": 30
    }
  }
}
```

## Error 3: "The string did not match the expected pattern"
**Error Message:** "The string did not match the expected pattern" during AI response processing

**Problem:** Complex regex patterns for JSON parsing were failing in Vercel's serverless environment, causing AI responses to fail processing.

**Root Cause:**
- Complex regex pattern: `/(["])([^"]*?)(["])(\s*:\s*)(["])([^"]*?)([^\\])(")([^"]*?)(["])/g`
- AI responses with malformed JSON or special characters
- Vercel's serverless environment handling regex differently than local development

**Solution:**
1. **Replaced complex regex with simple string replacements**
2. **Added three-tier fallback JSON parsing:**
   - First attempt: Standard JSON.parse()
   - Second attempt: Simple quote escaping
   - Third attempt: Aggressive sanitization removing control characters
3. **Enhanced error handling with detailed logging**
4. **Added response text cleaning for markdown code blocks**

**Key Code Changes in `processAIResponse` function:**
```javascript
// Instead of complex regex, use progressive parsing attempts
try {
  opportunities = JSON.parse(cleanedResponse);
} catch (parseError) {
  // Fallback 1: Simple fixes
  let fixedResponse = cleanedResponse
    .replace(/([^\\])"/g, '$1\\"')
    .replace(/^"/, '\\"')
    .replace(/\\"/g, '"')
    .replace(/\\\\"/g, '\\"');
  
  try {
    opportunities = JSON.parse(fixedResponse);
  } catch (secondParseError) {
    // Fallback 2: Aggressive sanitization
    let sanitizedResponse = cleanedResponse
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\\n/g, ' ')
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
      .replace(/([^\\])"/g, '$1\\"')
      .replace(/^"/, '\\"');
    
    opportunities = JSON.parse(sanitizedResponse);
  }
}
```

**Additional Vercel-specific fixes:**
- Changed file upload destination from `'uploads/'` to `'/tmp/'`
- Updated PDF generation to use `/tmp/` directory
- Added specific error handling for OpenAI/Gemini API failures
- Implemented multilingual value normalization (French/English)

## Project Structure
```
├── api/
│   └── server.js (serverless function)
├── public/
│   └── index.html (static files)
├── vercel.json
└── package.json
```
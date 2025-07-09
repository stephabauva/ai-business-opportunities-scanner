// AI Business Opportunity Scanner - Server
// MVP Implementation

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'text/plain' || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only .txt and .pdf files are allowed!'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Store for temporary PDF files
const pdfStore = new Map();

// Model mapping for different providers
const modelMap = {
  openai: {
    nano: 'gpt-4o-mini',
    mini: 'gpt-4o-mini',
    standard: 'gpt-4o'
  },
  google: {
    nano: 'gemini-1.5-flash-8b',
    mini: 'gemini-1.5-flash',
    standard: 'gemini-1.5-pro'
  }
};

// Unified prompt template
const createPrompt = (companyDescription) => {
  return `Analyze this company description and identify 3-5 specific AI implementation opportunities.
For each opportunity provide:
- Title (concise, specific)
- Description (2-3 sentences explaining the implementation)
- Impact (High/Medium/Low)
- Effort (High/Medium/Low)
- Priority Score (1-10, where 10 is highest priority)

Company Description: ${companyDescription}

Return your response as a valid JSON array with the following structure:
[
  {
    "title": "Opportunity Title",
    "description": "Detailed description of the AI implementation opportunity.",
    "impact": "High|Medium|Low",
    "effort": "High|Medium|Low",
    "priority": 8
  }
]

Focus on practical, implementable AI solutions that would provide real business value.`;
};

// OpenAI integration
const analyzeWithOpenAI = async (model, apiKey, content) => {
  try {
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: modelMap.openai[model],
      messages: [
        {
          role: "system",
          content: "You are an AI business consultant specializing in identifying practical AI implementation opportunities for businesses. Always respond with valid JSON."
        },
        {
          role: "user",
          content: createPrompt(content)
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
};

// Google Gemini integration
const analyzeWithGemini = async (model, apiKey, content) => {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: modelMap.google[model] });

    const result = await geminiModel.generateContent(createPrompt(content));
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
};

// Provider factory pattern
const analyzeWithProvider = async (provider, model, apiKey, content) => {
  if (provider === 'openai') {
    return await analyzeWithOpenAI(model, apiKey, content);
  } else if (provider === 'google') {
    return await analyzeWithGemini(model, apiKey, content);
  } else {
    throw new Error('Invalid provider');
  }
};

// Response processing and validation
const processAIResponse = (responseText, provider, model) => {
  try {
    // Clean up response text - remove markdown code blocks if present
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```$/g, '');
    }
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, '').replace(/```$/g, '');
    }

    // Parse JSON
    const opportunities = JSON.parse(cleanedResponse);
    
    // Validate structure
    if (!Array.isArray(opportunities)) {
      throw new Error('Response is not an array');
    }

    // Validate each opportunity
    const validatedOpportunities = opportunities.map((opp, index) => {
      if (!opp.title || !opp.description || !opp.impact || !opp.effort || !opp.priority) {
        throw new Error(`Invalid opportunity structure at index ${index}`);
      }

      // Validate impact and effort values
      if (!['High', 'Medium', 'Low'].includes(opp.impact)) {
        throw new Error(`Invalid impact value at index ${index}: ${opp.impact}`);
      }
      if (!['High', 'Medium', 'Low'].includes(opp.effort)) {
        throw new Error(`Invalid effort value at index ${index}: ${opp.effort}`);
      }

      // Validate priority score
      const priority = parseInt(opp.priority);
      if (isNaN(priority) || priority < 1 || priority > 10) {
        throw new Error(`Invalid priority score at index ${index}: ${opp.priority}`);
      }

      return {
        title: opp.title.trim(),
        description: opp.description.trim(),
        impact: opp.impact,
        effort: opp.effort,
        priority: priority
      };
    });

    // Sort by priority (highest first)
    validatedOpportunities.sort((a, b) => b.priority - a.priority);

    return {
      id: Date.now().toString(),
      provider: provider,
      model: model,
      analysisDate: new Date().toISOString(),
      opportunities: validatedOpportunities
    };

  } catch (error) {
    console.error('Response processing error:', error);
    throw new Error(`Failed to process AI response: ${error.message}`);
  }
};

// PDF Generation Function
const generatePDF = (analysisData, companyDescription) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const filename = `analysis-${analysisData.id}.pdf`;
      const filepath = path.join(__dirname, 'uploads', filename);
      
      // Pipe the PDF into a file
      doc.pipe(fs.createWriteStream(filepath));

      // Header Section
      doc.fontSize(20).text('AI Business Opportunity Analysis Report', { align: 'center' });
      doc.moveDown(0.5);
      
      // Company Description Summary
      doc.fontSize(14).text('Company Overview', { underline: true });
      doc.fontSize(12).text(companyDescription.substring(0, 300) + (companyDescription.length > 300 ? '...' : ''));
      doc.moveDown();
      
      // Analysis Details
      doc.fontSize(12);
      doc.text(`Analysis Date: ${new Date(analysisData.analysisDate).toLocaleDateString()}`);
      doc.text(`AI Provider: ${analysisData.provider.toUpperCase()}`);
      doc.text(`Model: ${analysisData.model.toUpperCase()}`);
      doc.moveDown();

      // Executive Summary
      doc.fontSize(16).text('Executive Summary', { underline: true });
      doc.fontSize(12);
      doc.text(`Total Opportunities Identified: ${analysisData.opportunities.length}`);
      
      const highPriorityCount = analysisData.opportunities.filter(opp => opp.priority >= 7).length;
      doc.text(`High-Priority Opportunities: ${highPriorityCount}`);
      
      const quickWins = analysisData.opportunities.filter(opp => opp.impact === 'High' && opp.effort === 'Low').length;
      doc.text(`Quick Wins (High Impact, Low Effort): ${quickWins}`);
      doc.moveDown();

      // Opportunities Section
      doc.fontSize(16).text('Identified Opportunities', { underline: true });
      doc.moveDown(0.5);
      
      analysisData.opportunities.forEach((opportunity, index) => {
        doc.fontSize(14).text(`${index + 1}. ${opportunity.title}`, { underline: true });
        doc.fontSize(12);
        doc.text(`Priority Score: ${opportunity.priority}/10`);
        doc.text(`Impact: ${opportunity.impact} | Effort: ${opportunity.effort}`);
        doc.moveDown(0.3);
        doc.text(opportunity.description);
        doc.moveDown();
        
        // Impact/Effort Matrix Visual
        const matrixY = doc.y;
        doc.text('Impact/Effort Matrix:');
        
        // Simple text-based matrix representation
        const impactScore = opportunity.impact === 'High' ? 3 : opportunity.impact === 'Medium' ? 2 : 1;
        const effortScore = opportunity.effort === 'High' ? 3 : opportunity.effort === 'Medium' ? 2 : 1;
        
        doc.text(`  Impact: ${'●'.repeat(impactScore)}${'○'.repeat(3 - impactScore)}`);
        doc.text(`  Effort: ${'●'.repeat(effortScore)}${'○'.repeat(3 - effortScore)}`);
        doc.moveDown();
        
        // Add page break if needed
        if (index < analysisData.opportunities.length - 1 && doc.y > 700) {
          doc.addPage();
        }
      });

      // Implementation Roadmap
      if (doc.y > 600) {
        doc.addPage();
      }
      
      doc.fontSize(16).text('Implementation Roadmap', { underline: true });
      doc.moveDown(0.5);
      
      // Sort opportunities by priority for roadmap
      const sortedOpportunities = [...analysisData.opportunities].sort((a, b) => b.priority - a.priority);
      
      doc.fontSize(14).text('Recommended Implementation Order:', { underline: true });
      doc.fontSize(12);
      
      sortedOpportunities.forEach((opportunity, index) => {
        const phase = index < 2 ? 'Phase 1 (0-3 months)' : 
                     index < 4 ? 'Phase 2 (3-6 months)' : 
                     'Phase 3 (6+ months)';
        
        doc.text(`${index + 1}. ${opportunity.title} - ${phase}`);
        doc.text(`   Priority: ${opportunity.priority}/10 | Impact: ${opportunity.impact} | Effort: ${opportunity.effort}`);
        
        if (opportunity.impact === 'High' && opportunity.effort === 'Low') {
          doc.text('   ⭐ QUICK WIN - Prioritize for immediate implementation');
        }
        doc.moveDown(0.3);
      });
      
      // Timeline Suggestions
      doc.moveDown();
      doc.fontSize(14).text('Timeline Suggestions:', { underline: true });
      doc.fontSize(12);
      doc.text('• Phase 1 (0-3 months): Focus on highest priority items and quick wins');
      doc.text('• Phase 2 (3-6 months): Implement medium-priority opportunities');
      doc.text('• Phase 3 (6+ months): Tackle complex, long-term initiatives');
      doc.moveDown();
      
      // Footer
      doc.fontSize(10).text('Generated by AI Business Opportunity Scanner', { align: 'center' });
      
      // Finalize the PDF
      doc.end();
      
      doc.on('end', () => {
        // Store the PDF path in memory for download
        pdfStore.set(analysisData.id, filepath);
        resolve(filepath);
      });
      
    } catch (error) {
      reject(error);
    }
  });
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    // Extract form data
    const { provider, model, apiKey, companyDescription } = req.body;
    
    // Validation
    if (!provider || !model || !apiKey) {
      return res.status(400).json({ 
        error: 'Missing required fields: provider, model, or apiKey' 
      });
    }

    if (!companyDescription && !req.file) {
      return res.status(400).json({ 
        error: 'Either company description or file upload is required' 
      });
    }

    // Validate provider
    if (!['openai', 'google'].includes(provider)) {
      return res.status(400).json({ 
        error: 'Invalid provider. Must be "openai" or "google"' 
      });
    }

    // Validate model
    if (!['nano', 'mini', 'standard'].includes(model)) {
      return res.status(400).json({ 
        error: 'Invalid model. Must be "nano", "mini", or "standard"' 
      });
    }

    // Get content from description or file
    let content = companyDescription;
    if (req.file) {
      content = fs.readFileSync(req.file.path, 'utf8');
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
    }

    // Validate content length
    if (content.length < 100) {
      return res.status(400).json({ 
        error: 'Company description must be at least 100 characters' 
      });
    }

    // Analyze with selected AI provider
    const aiResponse = await analyzeWithProvider(provider, model, apiKey, content);
    
    // Process and validate the AI response
    const analysis = processAIResponse(aiResponse, provider, model);
    
    // Generate PDF report
    await generatePDF(analysis, content);
    
    res.json(analysis);

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Handle specific AI provider errors
    if (error.message.includes('OpenAI API error')) {
      return res.status(400).json({ 
        error: 'OpenAI API error. Please check your API key and try again.' 
      });
    }
    
    if (error.message.includes('Gemini API error')) {
      return res.status(400).json({ 
        error: 'Google Gemini API error. Please check your API key and try again.' 
      });
    }
    
    if (error.message.includes('Failed to process AI response')) {
      return res.status(500).json({ 
        error: 'Failed to process AI response. Please try again.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error during analysis' 
    });
  }
});

app.get('/api/download/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if PDF exists in store
    if (!pdfStore.has(id)) {
      return res.status(404).json({ 
        error: 'PDF not found or expired' 
      });
    }

    const pdfPath = pdfStore.get(id);
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      pdfStore.delete(id);
      return res.status(404).json({ 
        error: 'PDF file not found' 
      });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="analysis-${id}.pdf"`);
    
    // Send file and clean up
    res.sendFile(pdfPath, (err) => {
      if (!err) {
        // Clean up file after successful download
        fs.unlinkSync(pdfPath);
        pdfStore.delete(id);
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'Internal server error during download' 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 5MB' 
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Unexpected file field' 
      });
    }
  }
  
  if (error.message === 'Only .txt and .pdf files are allowed!') {
    return res.status(400).json({ 
      error: 'Invalid file type. Only .txt and .pdf files are allowed' 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found' 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
});
// AI Business Opportunity Scanner - Server
// MVP Implementation

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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

    // TODO: Implement AI analysis logic here
    // For now, return mock data
    const mockAnalysis = {
      id: Date.now().toString(),
      provider: provider,
      model: model,
      analysisDate: new Date().toISOString(),
      opportunities: [
        {
          title: "Customer Service Chatbot",
          description: "Implement an AI-powered chatbot to handle customer inquiries 24/7, reducing response time and operational costs.",
          impact: "High",
          effort: "Medium",
          priority: 8
        },
        {
          title: "Predictive Analytics Dashboard",
          description: "Deploy machine learning models to forecast business trends and customer behavior patterns.",
          impact: "High",
          effort: "High",
          priority: 7
        },
        {
          title: "Automated Document Processing",
          description: "Use AI to extract and process information from documents, invoices, and forms automatically.",
          impact: "Medium",
          effort: "Medium",
          priority: 6
        }
      ]
    };

    res.json(mockAnalysis);

  } catch (error) {
    console.error('Analysis error:', error);
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
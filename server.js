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
const createPrompt = (companyDescription, model = 'standard') => {
  // For nano models, use simpler structure
  if (model === 'nano') {
    return `Analyze this company description and identify EXACTLY 4 specific AI implementation opportunities.

For each opportunity provide:
- Title and brief description
- Impact (High/Medium/Low) and Effort (High/Medium/Low) 
- Priority score (1-10)
- Basic business case: problem, current state, AI solution, success metrics
- Implementation: timeline, team size, budget estimate, main risks
- Financial projection: cost savings, revenue increase, investment, ROI timeline

Company Description: ${companyDescription}

IMPORTANT: Return ONLY a valid JSON array with this simplified structure:
[
  {
    "title": "Opportunity Title",
    "description": "Brief 2-3 sentence overview",
    "impact": "High|Medium|Low",
    "effort": "High|Medium|Low", 
    "priority": 8,
    "businessCase": {
      "problemStatement": "What problem does this solve?",
      "currentState": "Current process",
      "aiSolution": "AI approach",
      "successMetrics": ["Metric 1", "Metric 2"]
    },
    "implementation": {
      "timeline": "X weeks for MVP",
      "teamSize": "X people",
      "estimatedBudget": "$X - $Y",
      "mainRisks": ["Risk 1", "Risk 2"]
    },
    "financialProjections": {
      "costSavings": "$X annually",
      "revenueIncrease": "$Y potential", 
      "investmentRequired": "$Z",
      "roiTimeline": "X months"
    }
  }
]

Focus on practical, implementable solutions.`;
  }
  
  // For standard/mini models, use detailed structure
  return `Analyze this company description and identify EXACTLY 4-5 specific AI implementation opportunities with comprehensive business cases.

For each opportunity provide detailed information including:

BUSINESS CASE:
- Problem statement: What specific pain point does this solve?
- Current state: How is this currently handled?
- AI solution: Specific AI approach (not generic "use AI")
- Success metrics: Specific KPIs that will improve

IMPLEMENTATION DETAILS:
- Technical requirements: APIs, data sources, infrastructure needed
- Timeline: Phases from MVP to full deployment (weeks/months)
- Resource needs: Team size, skills required, estimated budget
- Risk assessment: Technical, business, and change management risks

FINANCIAL PROJECTIONS:
- Cost savings: Quantified annual savings
- Revenue increase: Potential revenue uplift
- Investment required: Development, deployment, operations costs
- ROI timeline: When benefits will materialize
- Conservative vs optimistic scenarios

STRATEGIC RECOMMENDATIONS:
- Implementation phases: 30/60/90 day milestones
- Change management: Stakeholder impact and training needs
- Vendor recommendations: Specific tools/platforms
- Success criteria: How to measure progress

Company Description: ${companyDescription}

IMPORTANT: Return ONLY a valid JSON array with the following structure. Do not include any explanatory text before or after the JSON:
[
  {
    "title": "Opportunity Title",
    "description": "Brief 2-3 sentence overview",
    "impact": "High|Medium|Low",
    "effort": "High|Medium|Low",
    "priority": 8,
    "businessCase": {
      "problemStatement": "What specific pain point does this solve?",
      "currentState": "How is this currently handled?",
      "aiSolution": "Specific AI approach and technology",
      "successMetrics": ["KPI 1", "KPI 2", "KPI 3"]
    },
    "implementation": {
      "technicalRequirements": ["Requirement 1", "Requirement 2"],
      "timeline": "X weeks/months for MVP, Y for full deployment",
      "resourceNeeds": {
        "teamSize": "X people",
        "skills": ["Skill 1", "Skill 2"],
        "estimatedBudget": "$X - $Y"
      },
      "riskAssessment": {
        "technical": "Technical risks and mitigation",
        "business": "Business risks and mitigation",
        "change": "Change management challenges"
      }
    },
    "financialProjections": {
      "costSavings": "$X annually",
      "revenueIncrease": "$Y potential",
      "investmentRequired": "$Z total",
      "roiTimeline": "X months to break even",
      "scenarios": {
        "conservative": "Conservative ROI estimate",
        "optimistic": "Optimistic ROI estimate"
      }
    },
    "strategicRecommendations": {
      "phases": {
        "phase1": "0-30 days: Initial steps",
        "phase2": "30-60 days: Next steps",
        "phase3": "60-90 days: Full implementation"
      },
      "changeManagement": {
        "stakeholderImpact": "Who will be affected and how",
        "trainingNeeds": "Required training and skills development"
      },
      "vendorRecommendations": ["Specific vendor/tool 1", "Specific vendor/tool 2"],
      "successCriteria": ["Success metric 1", "Success metric 2"]
    }
  }
]

Focus on practical, implementable AI solutions with realistic cost estimates and timelines.`;
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
          content: createPrompt(content, model)
        }
      ],
      temperature: 0.7,
      max_tokens: 8000
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

    const result = await geminiModel.generateContent(createPrompt(content, model));
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

    // Additional JSON cleanup
    cleanedResponse = cleanedResponse
      .replace(/,\s*}/g, '}')  // Remove trailing commas before }
      .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
      .replace(/\n/g, ' ')     // Replace newlines with spaces
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();

    // Try to find and extract just the JSON array
    const jsonStart = cleanedResponse.indexOf('[');
    const jsonEnd = cleanedResponse.lastIndexOf(']');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
    }

    // Parse JSON with fallback
    let opportunities;
    try {
      opportunities = JSON.parse(cleanedResponse);
    } catch (parseError) {
      // If parsing fails, try to fix common JSON issues
      console.log('JSON parse failed, attempting to fix common issues...');
      console.log('Original response:', responseText.substring(0, 500));
      
      // Try to fix unescaped quotes in strings
      let fixedResponse = cleanedResponse.replace(/(["])([^"]*?)(["])(\s*:\s*)(["])([^"]*?)([^\\])(")([^"]*?)(["])/g, '$1$2$3$4$5$6\\$7$8$9$10');
      
      try {
        opportunities = JSON.parse(fixedResponse);
      } catch (secondParseError) {
        throw new Error(`JSON parsing failed: ${parseError.message}. Response preview: ${cleanedResponse.substring(0, 200)}...`);
      }
    }
    
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

      // Handle both nano and standard structures
      const result = {
        title: opp.title.trim(),
        description: opp.description.trim(),
        impact: opp.impact,
        effort: opp.effort,
        priority: priority,
        businessCase: opp.businessCase || {},
        implementation: opp.implementation || {},
        financialProjections: opp.financialProjections || {},
        strategicRecommendations: opp.strategicRecommendations || {}
      };

      // For nano models, convert simplified structure to detailed structure
      if (opp.implementation && opp.implementation.mainRisks) {
        result.implementation.riskAssessment = {
          technical: opp.implementation.mainRisks[0] || 'Assessment needed',
          business: opp.implementation.mainRisks[1] || 'Assessment needed',
          change: opp.implementation.mainRisks[2] || 'Assessment needed'
        };
        result.implementation.resourceNeeds = {
          teamSize: opp.implementation.teamSize || 'TBD',
          estimatedBudget: opp.implementation.estimatedBudget || 'TBD',
          skills: ['Assessment needed']
        };
        result.implementation.timeline = opp.implementation.timeline || 'TBD';
        result.implementation.technicalRequirements = ['Assessment needed'];
        
        // Add minimal strategic recommendations for nano
        result.strategicRecommendations = {
          phases: {
            phase1: '0-30 days: Initial assessment',
            phase2: '30-60 days: Development',
            phase3: '60-90 days: Implementation'
          },
          changeManagement: {
            stakeholderImpact: 'Impact assessment needed',
            trainingNeeds: 'Training needs assessment required'
          },
          vendorRecommendations: ['Vendor assessment needed'],
          successCriteria: opp.businessCase?.successMetrics || ['Success criteria needed']
        };
      }

      return result;
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

      // Helper function to add page breaks when needed
      const checkPageBreak = () => {
        if (doc.y > 720) {
          doc.addPage();
        }
      };

      // Helper function to add section headers
      const addSectionHeader = (title) => {
        checkPageBreak();
        doc.fontSize(18).fillColor('black').text(title, { underline: true });
        doc.moveDown(0.5);
      };

      // Helper function to add subsection headers
      const addSubsectionHeader = (title) => {
        checkPageBreak();
        doc.fontSize(14).fillColor('black').text(title, { underline: true });
        doc.moveDown(0.3);
      };

      // Calculate summary metrics
      const totalOpportunities = analysisData.opportunities.length;
      const highPriorityCount = analysisData.opportunities.filter(opp => opp.priority >= 7).length;
      const quickWins = analysisData.opportunities.filter(opp => opp.impact === 'High' && opp.effort === 'Low').length;
      const strategicBets = analysisData.opportunities.filter(opp => opp.impact === 'High' && opp.effort === 'High').length;
      
      // Calculate financial projections
      const totalCostSavings = analysisData.opportunities.reduce((sum, opp) => {
        const savings = opp.financialProjections?.costSavings || '$0';
        const numValue = parseInt(savings.replace(/[^\d]/g, '')) || 0;
        return sum + numValue;
      }, 0);
      
      const totalRevenueIncrease = analysisData.opportunities.reduce((sum, opp) => {
        const revenue = opp.financialProjections?.revenueIncrease || '$0';
        const numValue = parseInt(revenue.replace(/[^\d]/g, '')) || 0;
        return sum + numValue;
      }, 0);
      
      const totalInvestment = analysisData.opportunities.reduce((sum, opp) => {
        const investment = opp.financialProjections?.investmentRequired || '$0';
        const numValue = parseInt(investment.replace(/[^\d]/g, '')) || 0;
        return sum + numValue;
      }, 0);

      // COVER PAGE
      doc.fontSize(24).fillColor('black').text('AI Business Opportunity Analysis Report', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(16).text('Professional Assessment & Implementation Roadmap', { align: 'center' });
      doc.moveDown(2);
      
      doc.fontSize(12);
      doc.text(`Analysis Date: ${new Date(analysisData.analysisDate).toLocaleDateString()}`);
      doc.text(`AI Provider: ${analysisData.provider.toUpperCase()}`);
      doc.text(`Model: ${analysisData.model.toUpperCase()}`);
      doc.moveDown(2);
      
      doc.fontSize(14).text('Company Overview', { underline: true });
      doc.fontSize(12).text(companyDescription.substring(0, 500) + (companyDescription.length > 500 ? '...' : ''));
      doc.addPage();

      // EXECUTIVE SUMMARY (1 page)
      addSectionHeader('Executive Summary');
      
      doc.fontSize(12);
      doc.text(`This analysis identified ${totalOpportunities} prioritized AI opportunities with significant potential for business transformation. The recommendations focus on practical, implementable solutions that balance impact with feasibility.`);
      doc.moveDown();
      
      addSubsectionHeader('Key Findings');
      doc.fontSize(12);
      doc.text(`• Total Opportunities Identified: ${totalOpportunities}`);
      doc.text(`• High-Priority Opportunities (7+ score): ${highPriorityCount}`);
      doc.text(`• Quick Wins (High Impact, Low Effort): ${quickWins}`);
      doc.text(`• Strategic Bets (High Impact, High Effort): ${strategicBets}`);
      doc.moveDown();
      
      addSubsectionHeader('Financial Impact Summary');
      doc.text(`• Total Potential Cost Savings: $${totalCostSavings.toLocaleString()} annually`);
      doc.text(`• Total Revenue Increase Potential: $${totalRevenueIncrease.toLocaleString()}`);
      doc.text(`• Total Investment Required: $${totalInvestment.toLocaleString()}`);
      doc.text(`• Expected ROI: ${totalCostSavings + totalRevenueIncrease > 0 ? Math.round(((totalCostSavings + totalRevenueIncrease) / totalInvestment) * 100) : 0}%`);
      doc.moveDown();
      
      addSubsectionHeader('Recommended Next Steps');
      const topOpportunity = analysisData.opportunities[0];
      doc.text(`1. Immediate Focus: Begin with "${topOpportunity.title}" (Priority ${topOpportunity.priority}/10)`);
      doc.text(`2. Timeline: ${topOpportunity.strategicRecommendations?.phases?.phase1 || 'Initiate planning within 30 days'}`);
      doc.text(`3. Investment: ${topOpportunity.financialProjections?.investmentRequired || 'Budget assessment required'}`);
      doc.text(`4. Expected ROI: ${topOpportunity.financialProjections?.roiTimeline || 'Timeline assessment required'}`);
      doc.addPage();

      // OPPORTUNITY ANALYSIS (per opportunity)
      addSectionHeader('Detailed Opportunity Analysis');
      
      analysisData.opportunities.forEach((opportunity, index) => {
        if (index > 0) doc.addPage();
        
        doc.fontSize(16).fillColor('black').text(`${index + 1}. ${opportunity.title}`, { underline: true });
        doc.fontSize(12).text(`Priority Score: ${opportunity.priority}/10 | Impact: ${opportunity.impact} | Effort: ${opportunity.effort}`);
        doc.moveDown();
        
        // Business Case
        addSubsectionHeader('Business Case');
        doc.fontSize(12);
        doc.text(`Problem Statement: ${opportunity.businessCase?.problemStatement || 'Detailed problem analysis required'}`);
        doc.moveDown(0.3);
        doc.text(`Current State: ${opportunity.businessCase?.currentState || 'Current process assessment needed'}`);
        doc.moveDown(0.3);
        doc.text(`AI Solution: ${opportunity.businessCase?.aiSolution || opportunity.description}`);
        doc.moveDown(0.3);
        
        if (opportunity.businessCase?.successMetrics && opportunity.businessCase.successMetrics.length > 0) {
          doc.text('Success Metrics:');
          opportunity.businessCase.successMetrics.forEach(metric => {
            doc.text(`  • ${metric}`);
          });
        }
        doc.moveDown();
        
        // Implementation Details
        addSubsectionHeader('Implementation Details');
        doc.text(`Timeline: ${opportunity.implementation?.timeline || 'Timeline assessment required'}`);
        doc.text(`Team Size: ${opportunity.implementation?.resourceNeeds?.teamSize || 'Resource planning needed'}`);
        doc.text(`Budget Estimate: ${opportunity.implementation?.resourceNeeds?.estimatedBudget || 'Cost analysis required'}`);
        doc.moveDown(0.3);
        
        if (opportunity.implementation?.technicalRequirements && opportunity.implementation.technicalRequirements.length > 0) {
          doc.text('Technical Requirements:');
          opportunity.implementation.technicalRequirements.forEach(req => {
            doc.text(`  • ${req}`);
          });
        }
        doc.moveDown(0.3);
        
        if (opportunity.implementation?.resourceNeeds?.skills && opportunity.implementation.resourceNeeds.skills.length > 0) {
          doc.text('Required Skills:');
          opportunity.implementation.resourceNeeds.skills.forEach(skill => {
            doc.text(`  • ${skill}`);
          });
        }
        doc.moveDown();
        
        // Risk Assessment
        addSubsectionHeader('Risk Assessment');
        doc.text(`Technical Risk: ${opportunity.implementation?.riskAssessment?.technical || 'Technical risk analysis required'}`);
        doc.moveDown(0.3);
        doc.text(`Business Risk: ${opportunity.implementation?.riskAssessment?.business || 'Business risk analysis required'}`);
        doc.moveDown(0.3);
        doc.text(`Change Risk: ${opportunity.implementation?.riskAssessment?.change || 'Change management assessment required'}`);
        doc.moveDown();
      });
      
      // STRATEGIC RECOMMENDATIONS
      doc.addPage();
      addSectionHeader('Strategic Recommendations');
      
      addSubsectionHeader('Prioritization Matrix');
      doc.fontSize(12);
      doc.text('Impact vs Effort Analysis:');
      doc.moveDown(0.3);
      
      // Create a simple text-based matrix
      const quickWinOpps = analysisData.opportunities.filter(opp => opp.impact === 'High' && opp.effort === 'Low');
      const strategicBetOpps = analysisData.opportunities.filter(opp => opp.impact === 'High' && opp.effort === 'High');
      const fillInOpps = analysisData.opportunities.filter(opp => opp.impact === 'Medium' || opp.effort === 'Medium');
      
      doc.text('QUICK WINS (High Impact, Low Effort):');
      quickWinOpps.forEach(opp => doc.text(`  • ${opp.title} (Priority: ${opp.priority}/10)`));
      doc.moveDown(0.3);
      
      doc.text('STRATEGIC BETS (High Impact, High Effort):');
      strategicBetOpps.forEach(opp => doc.text(`  • ${opp.title} (Priority: ${opp.priority}/10)`));
      doc.moveDown(0.3);
      
      doc.text('FILL-IN OPPORTUNITIES (Medium Impact/Effort):');
      fillInOpps.forEach(opp => doc.text(`  • ${opp.title} (Priority: ${opp.priority}/10)`));
      doc.moveDown();
      
      addSubsectionHeader('Implementation Sequencing');
      doc.text('Recommended implementation order based on priority and dependencies:');
      doc.moveDown(0.3);
      
      analysisData.opportunities.forEach((opp, index) => {
        const phase = index < 2 ? 'Phase 1 (0-3 months)' : 
                     index < 4 ? 'Phase 2 (3-6 months)' : 
                     'Phase 3 (6+ months)';
        doc.text(`${index + 1}. ${opp.title} - ${phase}`);
      });
      doc.moveDown();
      
      addSubsectionHeader('Change Management Strategy');
      const topOpp = analysisData.opportunities[0];
      doc.text(`Stakeholder Impact: ${topOpp.strategicRecommendations?.changeManagement?.stakeholderImpact || 'Stakeholder analysis required'}`);
      doc.moveDown(0.3);
      doc.text(`Training Requirements: ${topOpp.strategicRecommendations?.changeManagement?.trainingNeeds || 'Training needs assessment required'}`);
      doc.moveDown(0.3);
      
      if (topOpp.strategicRecommendations?.vendorRecommendations && topOpp.strategicRecommendations.vendorRecommendations.length > 0) {
        doc.text('Vendor Recommendations:');
        topOpp.strategicRecommendations.vendorRecommendations.forEach(vendor => {
          doc.text(`  • ${vendor}`);
        });
      }
      doc.moveDown();

      // FINANCIAL PROJECTIONS
      doc.addPage();
      addSectionHeader('Financial Projections');
      
      addSubsectionHeader('Investment Summary');
      doc.fontSize(12);
      doc.text(`Total Investment Required: $${totalInvestment.toLocaleString()}`);
      doc.text(`Expected Annual Cost Savings: $${totalCostSavings.toLocaleString()}`);
      doc.text(`Potential Revenue Increase: $${totalRevenueIncrease.toLocaleString()}`);
      doc.text(`Total Annual Benefit: $${(totalCostSavings + totalRevenueIncrease).toLocaleString()}`);
      doc.moveDown();
      
      addSubsectionHeader('ROI Timeline');
      doc.text('Projected return on investment by opportunity:');
      doc.moveDown(0.3);
      
      analysisData.opportunities.forEach((opp, index) => {
        doc.text(`${index + 1}. ${opp.title}`);
        doc.text(`   Investment: ${opp.financialProjections?.investmentRequired || 'TBD'}`);
        doc.text(`   ROI Timeline: ${opp.financialProjections?.roiTimeline || 'Assessment required'}`);
        doc.text(`   Conservative ROI: ${opp.financialProjections?.scenarios?.conservative || 'Analysis required'}`);
        doc.text(`   Optimistic ROI: ${opp.financialProjections?.scenarios?.optimistic || 'Analysis required'}`);
        doc.moveDown(0.3);
      });

      // NEXT STEPS & ACTION PLAN
      doc.addPage();
      addSectionHeader('Next Steps & Action Plan');
      
      const priorityOne = analysisData.opportunities[0];
      
      addSubsectionHeader('30/60/90 Day Plan for Priority #1');
      doc.fontSize(12);
      doc.text(`Focus: ${priorityOne.title}`);
      doc.moveDown(0.3);
      
      doc.text(`30 Days: ${priorityOne.strategicRecommendations?.phases?.phase1 || 'Initial planning and stakeholder alignment'}`);
      doc.moveDown(0.3);
      doc.text(`60 Days: ${priorityOne.strategicRecommendations?.phases?.phase2 || 'MVP development and testing'}`);
      doc.moveDown(0.3);
      doc.text(`90 Days: ${priorityOne.strategicRecommendations?.phases?.phase3 || 'Full implementation and optimization'}`);
      doc.moveDown();
      
      addSubsectionHeader('Decision Points');
      doc.text('Key milestones for evaluation:');
      doc.text('• 30-day checkpoint: Stakeholder buy-in and resource allocation');
      doc.text('• 60-day checkpoint: Technical feasibility and MVP results');
      doc.text('• 90-day checkpoint: Full deployment decision and scaling plan');
      doc.moveDown();
      
      addSubsectionHeader('Success Criteria');
      if (priorityOne.strategicRecommendations?.successCriteria && priorityOne.strategicRecommendations.successCriteria.length > 0) {
        doc.text('Measures of success:');
        priorityOne.strategicRecommendations.successCriteria.forEach(criteria => {
          doc.text(`  • ${criteria}`);
        });
      } else {
        doc.text('• Define specific KPIs and success metrics');
        doc.text('• Establish baseline measurements');
        doc.text('• Set up monitoring and reporting systems');
      }
      doc.moveDown();
      
      addSubsectionHeader('Immediate Actions Required');
      doc.text('1. Secure executive sponsorship and budget approval');
      doc.text('2. Assemble project team with required skills');
      doc.text('3. Conduct detailed technical feasibility assessment');
      doc.text('4. Develop comprehensive project plan with milestones');
      doc.text('5. Establish success metrics and monitoring framework');
      doc.moveDown();
      
      // Footer
      doc.fontSize(10).text('Generated by AI Business Opportunity Scanner - Professional Edition', { align: 'center' });
      
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
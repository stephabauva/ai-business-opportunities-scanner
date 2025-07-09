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
const createPrompt = (companyDescription, model = 'standard', language = 'en') => {
  // Language instructions based on selected language
  const langInstructions = language === 'fr' 
    ? 'Répondez en français. Toutes les opportunités, descriptions et métriques doivent être en français. Utilisez des termes techniques appropriés en français.'
    : 'Respond in English.';
  // For nano models, use simpler structure
  if (model === 'nano') {
    return `${langInstructions}

Analyze this company description and identify EXACTLY 4 specific AI implementation opportunities.

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
  return `${langInstructions}

Analyze this company description and identify EXACTLY 4-5 specific AI implementation opportunities with comprehensive business cases.

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
const analyzeWithOpenAI = async (model, apiKey, content, language = 'en') => {
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
          content: createPrompt(content, model, language)
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
const analyzeWithGemini = async (model, apiKey, content, language = 'en') => {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: modelMap.google[model] });

    const result = await geminiModel.generateContent(createPrompt(content, model, language));
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
};

// Provider factory pattern
const analyzeWithProvider = async (provider, model, apiKey, content, language = 'en') => {
  if (provider === 'openai') {
    return await analyzeWithOpenAI(model, apiKey, content, language);
  } else if (provider === 'google') {
    return await analyzeWithGemini(model, apiKey, content, language);
  } else {
    throw new Error('Invalid provider');
  }
};

// Response processing and validation
const processAIResponse = (responseText, provider, model, language = 'en') => {
  // Define fallback text for missing data based on language
  const fallbackTexts = {
    fr: {
      assessmentNeeded: 'Évaluation nécessaire',
      tbd: 'À déterminer',
      impactAssessmentNeeded: 'Évaluation de l\'impact nécessaire',
      trainingNeedsAssessmentRequired: 'Évaluation des besoins de formation requise',
      vendorAssessmentNeeded: 'Évaluation des fournisseurs nécessaire',
      successCriteriaNeeded: 'Critères de succès nécessaires',
      initialAssessment: 'Jour 0-30 : Évaluation initiale',
      development: 'Jour 30-60 : Développement',
      implementation: 'Jour 60-90 : Implémentation'
    },
    en: {
      assessmentNeeded: 'Assessment needed',
      tbd: 'TBD',
      impactAssessmentNeeded: 'Impact assessment needed',
      trainingNeedsAssessmentRequired: 'Training needs assessment required',
      vendorAssessmentNeeded: 'Vendor assessment needed',
      successCriteriaNeeded: 'Success criteria needed',
      initialAssessment: '0-30 days: Initial assessment',
      development: '30-60 days: Development',
      implementation: '60-90 days: Implementation'
    }
  };

  const fallback = fallbackTexts[language] || fallbackTexts.en;
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
          technical: opp.implementation.mainRisks[0] || fallback.assessmentNeeded,
          business: opp.implementation.mainRisks[1] || fallback.assessmentNeeded,
          change: opp.implementation.mainRisks[2] || fallback.assessmentNeeded
        };
        result.implementation.resourceNeeds = {
          teamSize: opp.implementation.teamSize || fallback.tbd,
          estimatedBudget: opp.implementation.estimatedBudget || fallback.tbd,
          skills: [fallback.assessmentNeeded]
        };
        result.implementation.timeline = opp.implementation.timeline || fallback.tbd;
        result.implementation.technicalRequirements = [fallback.assessmentNeeded];
        
        // Add minimal strategic recommendations for nano
        result.strategicRecommendations = {
          phases: {
            phase1: fallback.initialAssessment,
            phase2: fallback.development,
            phase3: fallback.implementation
          },
          changeManagement: {
            stakeholderImpact: fallback.impactAssessmentNeeded,
            trainingNeeds: fallback.trainingNeedsAssessmentRequired
          },
          vendorRecommendations: [fallback.vendorAssessmentNeeded],
          successCriteria: opp.businessCase?.successMetrics || [fallback.successCriteriaNeeded]
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
const generatePDF = (analysisData, companyDescription, language = 'en') => {
  // Fallback text for missing data
  const fallbackText = {
    fr: {
      assessmentNeeded: 'Évaluation nécessaire',
      tbd: 'À déterminer',
      detailedAnalysisRequired: 'Analyse détaillée requise',
      processAssessmentNeeded: 'Évaluation du processus actuel nécessaire',
      timelineAssessmentRequired: 'Évaluation du calendrier requise',
      resourcePlanningNeeded: 'Planification des ressources nécessaire',
      costAnalysisRequired: 'Analyse des coûts requise',
      technicalRiskAnalysisRequired: 'Analyse des risques techniques requise',
      businessRiskAnalysisRequired: 'Analyse des risques d\'affaires requise',
      changeManagementAssessmentRequired: 'Évaluation de la gestion du changement requise',
      stakeholderAnalysisRequired: 'Analyse des parties prenantes requise',
      trainingNeedsAssessmentRequired: 'Évaluation des besoins de formation requise',
      analysisRequired: 'Analyse requise',
      vendorAssessmentNeeded: 'Évaluation des fournisseurs nécessaire',
      successCriteriaNeeded: 'Critères de succès nécessaires',
      initialAssessment: 'Jour 0-30 : Évaluation initiale',
      development: 'Jour 30-60 : Développement',
      implementation: 'Jour 60-90 : Implémentation',
      impactAssessmentNeeded: 'Évaluation de l\'impact nécessaire',
      budgetAssessmentRequired: 'Évaluation du budget requise',
      executiveSummaryText: 'Cette analyse a identifié {totalOpportunities} opportunités IA priorisées avec un potentiel significatif de transformation d\'affaires. Les recommandations se concentrent sur des solutions pratiques et implémentables qui équilibrent l\'impact et la faisabilité.',
      implementationOrderText: 'Ordre d\'implémentation recommandé basé sur la priorité et les dépendances :',
      keyMilestonesText: 'Jalons clés pour l\'évaluation :',
      checkpoint30: '• Point de contrôle 30 jours : Adhésion des parties prenantes et allocation des ressources',
      checkpoint60: '• Point de contrôle 60 jours : Faisabilité technique et résultats MVP',
      checkpoint90: '• Point de contrôle 90 jours : Décision de déploiement complet et plan de mise à l\'échelle',
      defineKpis: '• Définir des KPI et des métriques de succès spécifiques',
      establishBaseline: '• Établir des mesures de base',
      setupMonitoring: '• Mettre en place des systèmes de surveillance et de rapport',
      immediateAction1: '1. Sécuriser le parrainage exécutif et l\'approbation du budget',
      immediateAction2: '2. Assembler l\'équipe de projet avec les compétences requises',
      immediateAction3: '3. Effectuer une évaluation détaillée de la faisabilité technique',
      immediateAction4: '4. Développer un plan de projet complet avec des jalons',
      immediateAction5: '5. Établir des métriques de succès et un cadre de surveillance'
    },
    en: {
      assessmentNeeded: 'Assessment needed',
      tbd: 'TBD',
      detailedAnalysisRequired: 'Detailed problem analysis required',
      processAssessmentNeeded: 'Current process assessment needed',
      timelineAssessmentRequired: 'Timeline assessment required',
      resourcePlanningNeeded: 'Resource planning needed',
      costAnalysisRequired: 'Cost analysis required',
      technicalRiskAnalysisRequired: 'Technical risk analysis required',
      businessRiskAnalysisRequired: 'Business risk analysis required',
      changeManagementAssessmentRequired: 'Change management assessment required',
      stakeholderAnalysisRequired: 'Stakeholder analysis required',
      trainingNeedsAssessmentRequired: 'Training needs assessment required',
      analysisRequired: 'Analysis required',
      vendorAssessmentNeeded: 'Vendor assessment needed',
      successCriteriaNeeded: 'Success criteria needed',
      initialAssessment: '0-30 days: Initial assessment',
      development: '30-60 days: Development',
      implementation: '60-90 days: Implementation',
      impactAssessmentNeeded: 'Impact assessment needed',
      budgetAssessmentRequired: 'Budget assessment required',
      executiveSummaryText: 'This analysis identified {totalOpportunities} prioritized AI opportunities with significant potential for business transformation. The recommendations focus on practical, implementable solutions that balance impact with feasibility.',
      implementationOrderText: 'Recommended implementation order based on priority and dependencies:',
      keyMilestonesText: 'Key milestones for evaluation:',
      checkpoint30: '• 30-day checkpoint: Stakeholder buy-in and resource allocation',
      checkpoint60: '• 60-day checkpoint: Technical feasibility and MVP results',
      checkpoint90: '• 90-day checkpoint: Full deployment decision and scaling plan',
      defineKpis: '• Define specific KPIs and success metrics',
      establishBaseline: '• Establish baseline measurements',
      setupMonitoring: '• Set up monitoring and reporting systems',
      immediateAction1: '1. Secure executive sponsorship and budget approval',
      immediateAction2: '2. Assemble project team with required skills',
      immediateAction3: '3. Conduct detailed technical feasibility assessment',
      immediateAction4: '4. Develop comprehensive project plan with milestones',
      immediateAction5: '5. Establish success metrics and monitoring framework'
    }
  };

  const fallback = fallbackText[language] || fallbackText.en;

  // PDF Labels based on language
  const pdfLabels = {
    fr: {
      title: 'Rapport d\'Analyse d\'Opportunités Business IA',
      subtitle: 'Évaluation Professionnelle et Feuille de Route d\'Implémentation',
      analysisDate: 'Date d\'analyse',
      aiProvider: 'Fournisseur IA',
      model: 'Modèle',
      companyOverview: 'Aperçu de l\'entreprise',
      executiveSummary: 'Résumé Exécutif',
      keyFindings: 'Conclusions Principales',
      totalOpps: 'Opportunités Totales Identifiées',
      highPriorityOpps: 'Opportunités Haute Priorité (7+ score)',
      quickWins: 'Victoires Rapides (Impact Élevé, Effort Faible)',
      strategicBets: 'Paris Stratégiques (Impact Élevé, Effort Élevé)',
      financialSummary: 'Résumé de l\'Impact Financier',
      costSavings: 'Économies de Coûts Potentielles Totales',
      revenueIncrease: 'Augmentation de Revenus Potentielle Totale',
      investment: 'Investissement Total Requis',
      expectedRoi: 'ROI Attendu',
      nextSteps: 'Prochaines Étapes Recommandées',
      immediateFocus: 'Focus Immédiat',
      timeline: 'Calendrier',
      opportunityAnalysis: 'Analyse Détaillée des Opportunités',
      priority: 'Priorité',
      impact: 'Impact',
      effort: 'Effort',
      businessCase: 'Cas d\'Affaires',
      problemStatement: 'Problème',
      currentState: 'État Actuel',
      aiSolution: 'Solution IA',
      successMetrics: 'Métriques de Succès',
      implementationDetails: 'Détails d\'Implémentation',
      teamSize: 'Taille d\'Équipe',
      budget: 'Budget Estimé',
      technicalReqs: 'Exigences Techniques',
      requiredSkills: 'Compétences Requises',
      riskAssessment: 'Évaluation des Risques',
      technicalRisk: 'Risque Technique',
      businessRisk: 'Risque d\'Affaires',
      changeRisk: 'Risque de Changement',
      strategicRecs: 'Recommandations Stratégiques',
      prioritizationMatrix: 'Matrice de Priorisation',
      impactEffortAnalysis: 'Analyse Impact vs Effort',
      quickWinsLabel: 'VICTOIRES RAPIDES (Impact Élevé, Effort Faible)',
      strategicBetsLabel: 'PARIS STRATÉGIQUES (Impact Élevé, Effort Élevé)',
      fillInLabel: 'OPPORTUNITÉS COMPLÉMENTAIRES (Impact/Effort Moyen)',
      sequencing: 'Séquençage d\'Implémentation',
      changeManagement: 'Stratégie de Gestion du Changement',
      stakeholderImpact: 'Impact sur les Parties Prenantes',
      trainingReqs: 'Exigences de Formation',
      vendorRecs: 'Recommandations de Fournisseurs',
      financialProjections: 'Projections Financières',
      investmentSummary: 'Résumé d\'Investissement',
      roiTimeline: 'Calendrier de ROI',
      conservativeRoi: 'ROI Conservateur',
      optimisticRoi: 'ROI Optimiste',
      actionPlan: 'Plan d\'Action et Prochaines Étapes',
      dayPlan: 'Plan 30/60/90 Jours pour la Priorité #1',
      focus: 'Focus',
      days: 'Jours',
      decisionPoints: 'Points de Décision',
      successCriteria: 'Critères de Succès',
      immediateActions: 'Actions Immédiates Requises',
      annually: 'annuellement',
      phase: 'Phase',
      months: 'mois',
      generated: 'Généré par Scanner d\'Opportunités Business IA - Édition Professionnelle'
    },
    en: {
      title: 'AI Business Opportunity Analysis Report',
      subtitle: 'Professional Assessment & Implementation Roadmap',
      analysisDate: 'Analysis Date',
      aiProvider: 'AI Provider',
      model: 'Model',
      companyOverview: 'Company Overview',
      executiveSummary: 'Executive Summary',
      keyFindings: 'Key Findings',
      totalOpps: 'Total Opportunities Identified',
      highPriorityOpps: 'High-Priority Opportunities (7+ score)',
      quickWins: 'Quick Wins (High Impact, Low Effort)',
      strategicBets: 'Strategic Bets (High Impact, High Effort)',
      financialSummary: 'Financial Impact Summary',
      costSavings: 'Total Potential Cost Savings',
      revenueIncrease: 'Total Revenue Increase Potential',
      investment: 'Total Investment Required',
      expectedRoi: 'Expected ROI',
      nextSteps: 'Recommended Next Steps',
      immediateFocus: 'Immediate Focus',
      timeline: 'Timeline',
      opportunityAnalysis: 'Detailed Opportunity Analysis',
      priority: 'Priority',
      impact: 'Impact',
      effort: 'Effort',
      businessCase: 'Business Case',
      problemStatement: 'Problem Statement',
      currentState: 'Current State',
      aiSolution: 'AI Solution',
      successMetrics: 'Success Metrics',
      implementationDetails: 'Implementation Details',
      teamSize: 'Team Size',
      budget: 'Budget Estimate',
      technicalReqs: 'Technical Requirements',
      requiredSkills: 'Required Skills',
      riskAssessment: 'Risk Assessment',
      technicalRisk: 'Technical Risk',
      businessRisk: 'Business Risk',
      changeRisk: 'Change Risk',
      strategicRecs: 'Strategic Recommendations',
      prioritizationMatrix: 'Prioritization Matrix',
      impactEffortAnalysis: 'Impact vs Effort Analysis',
      quickWinsLabel: 'QUICK WINS (High Impact, Low Effort)',
      strategicBetsLabel: 'STRATEGIC BETS (High Impact, High Effort)',
      fillInLabel: 'FILL-IN OPPORTUNITIES (Medium Impact/Effort)',
      sequencing: 'Implementation Sequencing',
      changeManagement: 'Change Management Strategy',
      stakeholderImpact: 'Stakeholder Impact',
      trainingReqs: 'Training Requirements',
      vendorRecs: 'Vendor Recommendations',
      financialProjections: 'Financial Projections',
      investmentSummary: 'Investment Summary',
      roiTimeline: 'ROI Timeline',
      conservativeRoi: 'Conservative ROI',
      optimisticRoi: 'Optimistic ROI',
      actionPlan: 'Next Steps & Action Plan',
      dayPlan: '30/60/90 Day Plan for Priority #1',
      focus: 'Focus',
      days: 'Days',
      decisionPoints: 'Decision Points',
      successCriteria: 'Success Criteria',
      immediateActions: 'Immediate Actions Required',
      annually: 'annually',
      phase: 'Phase',
      months: 'months',
      generated: 'Generated by AI Business Opportunity Scanner - Professional Edition'
    }
  };
  
  const labels = pdfLabels[language] || pdfLabels.en;
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
      doc.fontSize(24).fillColor('black').text(labels.title, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(16).text(labels.subtitle, { align: 'center' });
      doc.moveDown(2);
      
      doc.fontSize(12);
      doc.text(`${labels.analysisDate}: ${new Date(analysisData.analysisDate).toLocaleDateString()}`);
      doc.text(`${labels.aiProvider}: ${analysisData.provider.toUpperCase()}`);
      doc.text(`${labels.model}: ${analysisData.model.toUpperCase()}`);
      doc.moveDown(2);
      
      doc.fontSize(14).text(labels.companyOverview, { underline: true });
      doc.fontSize(12).text(companyDescription.substring(0, 500) + (companyDescription.length > 500 ? '...' : ''));
      doc.addPage();

      // EXECUTIVE SUMMARY (1 page)
      addSectionHeader(labels.executiveSummary);
      
      doc.fontSize(12);
      doc.text(fallback.executiveSummaryText.replace('{totalOpportunities}', totalOpportunities));
      doc.moveDown();
      
      addSubsectionHeader(labels.keyFindings);
      doc.fontSize(12);
      doc.text(`• ${labels.totalOpps}: ${totalOpportunities}`);
      doc.text(`• ${labels.highPriorityOpps}: ${highPriorityCount}`);
      doc.text(`• ${labels.quickWins}: ${quickWins}`);
      doc.text(`• ${labels.strategicBets}: ${strategicBets}`);
      doc.moveDown();
      
      addSubsectionHeader(labels.financialSummary);
      doc.text(`• ${labels.costSavings}: $${totalCostSavings.toLocaleString()} ${labels.annually}`);
      doc.text(`• ${labels.revenueIncrease}: $${totalRevenueIncrease.toLocaleString()}`);
      doc.text(`• ${labels.investment}: $${totalInvestment.toLocaleString()}`);
      doc.text(`• ${labels.expectedRoi}: ${totalCostSavings + totalRevenueIncrease > 0 ? Math.round(((totalCostSavings + totalRevenueIncrease) / totalInvestment) * 100) : 0}%`);
      doc.moveDown();
      
      addSubsectionHeader(labels.nextSteps);
      const topOpportunity = analysisData.opportunities[0];
      doc.text(`1. ${labels.immediateFocus}: Begin with "${topOpportunity.title}" (${labels.priority} ${topOpportunity.priority}/10)`);
      doc.text(`2. ${labels.timeline}: ${topOpportunity.strategicRecommendations?.phases?.phase1 || 'Initiate planning within 30 days'}`);
      doc.text(`3. ${labels.investment}: ${topOpportunity.financialProjections?.investmentRequired || fallback.budgetAssessmentRequired}`);
      doc.text(`4. ${labels.expectedRoi}: ${topOpportunity.financialProjections?.roiTimeline || fallback.timelineAssessmentRequired}`);
      doc.addPage();

      // OPPORTUNITY ANALYSIS (per opportunity)
      addSectionHeader(labels.opportunityAnalysis);
      
      analysisData.opportunities.forEach((opportunity, index) => {
        if (index > 0) doc.addPage();
        
        doc.fontSize(16).fillColor('black').text(`${index + 1}. ${opportunity.title}`, { underline: true });
        doc.fontSize(12).text(`${labels.priority}: ${opportunity.priority}/10 | ${labels.impact}: ${opportunity.impact} | ${labels.effort}: ${opportunity.effort}`);
        doc.moveDown();
        
        // Business Case
        addSubsectionHeader(labels.businessCase);
        doc.fontSize(12);
        doc.text(`${labels.problemStatement}: ${opportunity.businessCase?.problemStatement || fallback.detailedAnalysisRequired}`);
        doc.moveDown(0.3);
        doc.text(`${labels.currentState}: ${opportunity.businessCase?.currentState || fallback.processAssessmentNeeded}`);
        doc.moveDown(0.3);
        doc.text(`${labels.aiSolution}: ${opportunity.businessCase?.aiSolution || opportunity.description}`);
        doc.moveDown(0.3);
        
        if (opportunity.businessCase?.successMetrics && opportunity.businessCase.successMetrics.length > 0) {
          doc.text(`${labels.successMetrics}:`);
          opportunity.businessCase.successMetrics.forEach(metric => {
            doc.text(`  • ${metric}`);
          });
        }
        doc.moveDown();
        
        // Implementation Details
        addSubsectionHeader(labels.implementationDetails);
        doc.text(`${labels.timeline}: ${opportunity.implementation?.timeline || fallback.timelineAssessmentRequired}`);
        doc.text(`${labels.teamSize}: ${opportunity.implementation?.resourceNeeds?.teamSize || fallback.resourcePlanningNeeded}`);
        doc.text(`${labels.budget}: ${opportunity.implementation?.resourceNeeds?.estimatedBudget || fallback.costAnalysisRequired}`);
        doc.moveDown(0.3);
        
        if (opportunity.implementation?.technicalRequirements && opportunity.implementation.technicalRequirements.length > 0) {
          doc.text(`${labels.technicalReqs}:`);
          opportunity.implementation.technicalRequirements.forEach(req => {
            doc.text(`  • ${req}`);
          });
        }
        doc.moveDown(0.3);
        
        if (opportunity.implementation?.resourceNeeds?.skills && opportunity.implementation.resourceNeeds.skills.length > 0) {
          doc.text(`${labels.requiredSkills}:`);
          opportunity.implementation.resourceNeeds.skills.forEach(skill => {
            doc.text(`  • ${skill}`);
          });
        }
        doc.moveDown();
        
        // Risk Assessment
        addSubsectionHeader(labels.riskAssessment);
        doc.text(`${labels.technicalRisk}: ${opportunity.implementation?.riskAssessment?.technical || fallback.technicalRiskAnalysisRequired}`);
        doc.moveDown(0.3);
        doc.text(`${labels.businessRisk}: ${opportunity.implementation?.riskAssessment?.business || fallback.businessRiskAnalysisRequired}`);
        doc.moveDown(0.3);
        doc.text(`${labels.changeRisk}: ${opportunity.implementation?.riskAssessment?.change || fallback.changeManagementAssessmentRequired}`);
        doc.moveDown();
      });
      
      // STRATEGIC RECOMMENDATIONS
      doc.addPage();
      addSectionHeader(labels.strategicRecs);
      
      addSubsectionHeader(labels.prioritizationMatrix);
      doc.fontSize(12);
      doc.text(`${labels.impactEffortAnalysis}:`);
      doc.moveDown(0.3);
      
      // Create a simple text-based matrix
      const quickWinOpps = analysisData.opportunities.filter(opp => opp.impact === 'High' && opp.effort === 'Low');
      const strategicBetOpps = analysisData.opportunities.filter(opp => opp.impact === 'High' && opp.effort === 'High');
      const fillInOpps = analysisData.opportunities.filter(opp => opp.impact === 'Medium' || opp.effort === 'Medium');
      
      doc.text(labels.quickWinsLabel);
      quickWinOpps.forEach(opp => doc.text(`  • ${opp.title} (Priority: ${opp.priority}/10)`));
      doc.moveDown(0.3);
      
      doc.text(labels.strategicBetsLabel);
      strategicBetOpps.forEach(opp => doc.text(`  • ${opp.title} (Priority: ${opp.priority}/10)`));
      doc.moveDown(0.3);
      
      doc.text(labels.fillInLabel);
      fillInOpps.forEach(opp => doc.text(`  • ${opp.title} (Priority: ${opp.priority}/10)`));
      doc.moveDown();
      
      addSubsectionHeader(labels.sequencing);
      doc.text(fallback.implementationOrderText);
      doc.moveDown(0.3);
      
      analysisData.opportunities.forEach((opp, index) => {
        const phase = index < 2 ? 'Phase 1 (0-3 months)' : 
                     index < 4 ? `${labels.phase} 2 (3-6 ${labels.months})` : 
                     `${labels.phase} 3 (6+ ${labels.months})`;
        doc.text(`${index + 1}. ${opp.title} - ${phase}`);
      });
      doc.moveDown();
      
      addSubsectionHeader(labels.changeManagement);
      const topOpp = analysisData.opportunities[0];
      doc.text(`${labels.stakeholderImpact}: ${topOpp.strategicRecommendations?.changeManagement?.stakeholderImpact || fallback.stakeholderAnalysisRequired}`);
      doc.moveDown(0.3);
      doc.text(`${labels.trainingReqs}: ${topOpp.strategicRecommendations?.changeManagement?.trainingNeeds || fallback.trainingNeedsAssessmentRequired}`);
      doc.moveDown(0.3);
      
      if (topOpp.strategicRecommendations?.vendorRecommendations && topOpp.strategicRecommendations.vendorRecommendations.length > 0) {
        doc.text(`${labels.vendorRecs}:`);
        topOpp.strategicRecommendations.vendorRecommendations.forEach(vendor => {
          doc.text(`  • ${vendor}`);
        });
      }
      doc.moveDown();

      // FINANCIAL PROJECTIONS
      doc.addPage();
      addSectionHeader(labels.financialProjections);
      
      addSubsectionHeader(labels.investmentSummary);
      doc.fontSize(12);
      doc.text(`${labels.investment}: $${totalInvestment.toLocaleString()}`);
      doc.text(`${labels.costSavings}: $${totalCostSavings.toLocaleString()}`);
      doc.text(`${labels.revenueIncrease}: $${totalRevenueIncrease.toLocaleString()}`);
      doc.text(`${labels.costSavings + ' + ' + labels.revenueIncrease}: $${(totalCostSavings + totalRevenueIncrease).toLocaleString()}`);
      doc.moveDown();
      
      addSubsectionHeader(labels.roiTimeline);
      doc.text('Projected return on investment by opportunity:');
      doc.moveDown(0.3);
      
      analysisData.opportunities.forEach((opp, index) => {
        doc.text(`${index + 1}. ${opp.title}`);
        doc.text(`   ${labels.investment}: ${opp.financialProjections?.investmentRequired || 'TBD'}`);
        doc.text(`   ${labels.roiTimeline}: ${opp.financialProjections?.roiTimeline || fallback.analysisRequired}`);
        doc.text(`   ${labels.conservativeRoi}: ${opp.financialProjections?.scenarios?.conservative || fallback.analysisRequired}`);
        doc.text(`   ${labels.optimisticRoi}: ${opp.financialProjections?.scenarios?.optimistic || fallback.analysisRequired}`);
        doc.moveDown(0.3);
      });

      // NEXT STEPS & ACTION PLAN
      doc.addPage();
      addSectionHeader(labels.actionPlan);
      
      const priorityOne = analysisData.opportunities[0];
      
      addSubsectionHeader(labels.dayPlan);
      doc.fontSize(12);
      doc.text(`${labels.focus}: ${priorityOne.title}`);
      doc.moveDown(0.3);
      
      doc.text(`30 ${labels.days}: ${priorityOne.strategicRecommendations?.phases?.phase1 || 'Initial planning and stakeholder alignment'}`);
      doc.moveDown(0.3);
      doc.text(`60 ${labels.days}: ${priorityOne.strategicRecommendations?.phases?.phase2 || 'MVP development and testing'}`);
      doc.moveDown(0.3);
      doc.text(`90 ${labels.days}: ${priorityOne.strategicRecommendations?.phases?.phase3 || 'Full implementation and optimization'}`);
      doc.moveDown();
      
      addSubsectionHeader(labels.decisionPoints);
      doc.text(fallback.keyMilestonesText);
      doc.text(fallback.checkpoint30);
      doc.text(fallback.checkpoint60);
      doc.text(fallback.checkpoint90);
      doc.moveDown();
      
      addSubsectionHeader(labels.successCriteria);
      if (priorityOne.strategicRecommendations?.successCriteria && priorityOne.strategicRecommendations.successCriteria.length > 0) {
        doc.text('Measures of success:');
        priorityOne.strategicRecommendations.successCriteria.forEach(criteria => {
          doc.text(`  • ${criteria}`);
        });
      } else {
        doc.text(fallback.defineKpis);
        doc.text(fallback.establishBaseline);
        doc.text(fallback.setupMonitoring);
      }
      doc.moveDown();
      
      addSubsectionHeader(labels.immediateActions);
      doc.text(fallback.immediateAction1);
      doc.text(fallback.immediateAction2);
      doc.text(fallback.immediateAction3);
      doc.text(fallback.immediateAction4);
      doc.text(fallback.immediateAction5);
      doc.moveDown();
      
      // Footer
      doc.fontSize(10).text(labels.generated, { align: 'center' });
      
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
    const { provider, model, apiKey, companyDescription, language = 'en' } = req.body;
    
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
    const aiResponse = await analyzeWithProvider(provider, model, apiKey, content, language);
    
    // Process and validate the AI response
    const analysis = processAIResponse(aiResponse, provider, model, language);
    
    // Generate PDF report
    await generatePDF(analysis, content, language);
    
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
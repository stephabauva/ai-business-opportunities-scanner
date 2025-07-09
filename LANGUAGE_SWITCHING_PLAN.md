# Language Switching Implementation Plan - French/English

## Overview
This plan outlines the implementation of a bilingual (French/English) interface for the AI Business Opportunity Scanner. The application will default to French with an instant language switcher in the top navigation.

## Key Requirements
- Default language: French
- Language toggle button in top navigation (FR/EN)
- Instant switching without page reload
- All UI text translated
- Generated AI opportunities in selected language
- PDF reports generated in selected language
- Language preference persisted in localStorage

## Implementation Architecture

### 1. Frontend Structure

#### 1.1 Language Toggle Component
```html
<!-- Add to header section -->
<div class="language-switcher">
    <button class="lang-btn active" data-lang="fr">FR</button>
    <button class="lang-btn" data-lang="en">EN</button>
</div>
```

#### 1.2 Translation System
- Create a JavaScript object containing all translations
- Use data attributes for text elements requiring translation
- Implement dynamic text replacement function

#### 1.3 Translation Keys Structure
```javascript
const translations = {
    fr: {
        // Header
        appTitle: "Scanner d'Opportunités Business IA",
        appSubtitle: "Analysez votre entreprise et découvrez des opportunités d'implémentation IA avec des feuilles de route priorisées",
        
        // Form Labels
        chooseProvider: "Choisir le fournisseur IA",
        modelTier: "Niveau du modèle",
        apiKeyLabel: "Clé API {provider}",
        companyDescription: "Description de l'entreprise",
        uploadDocument: "Télécharger le document de l'entreprise (Optionnel)",
        analyzeButton: "Analyser les opportunités business",
        
        // Model Options
        nanoTier: "{tierName} - Analyse rapide et économique",
        miniTier: "{tierName} - Performance équilibrée",
        standardTier: "{tierName} - Analyse la plus complète",
        
        // Results
        resultsTitle: "Opportunités d'implémentation IA",
        downloadReport: "Télécharger le rapport PDF",
        priority: "Priorité",
        impact: "Impact",
        effort: "Effort",
        
        // Metrics
        high: "Élevé",
        medium: "Moyen",
        low: "Faible",
        
        // Messages
        analyzing: "Analyse de votre entreprise...",
        errorMessage: "Une erreur s'est produite lors de l'analyse",
        fileUploadText: "Cliquez pour télécharger un document d'entreprise (.txt, .pdf, max 5MB)",
        fileSelected: "Sélectionné: {filename}",
        characterCount: "{count}/1000 caractères",
        
        // Validation
        apiKeyRequired: "La clé API est requise",
        descriptionRequired: "La description de l'entreprise est requise",
        descriptionMinLength: "La description de l'entreprise doit contenir au moins 100 caractères",
        fileSizeError: "La taille du fichier doit être inférieure à 5MB",
        fileTypeError: "Seuls les fichiers .txt et .pdf sont autorisés"
    },
    en: {
        // Header
        appTitle: "AI Business Opportunity Scanner",
        appSubtitle: "Analyze your company and discover AI implementation opportunities with prioritized roadmaps",
        
        // Form Labels
        chooseProvider: "Choose AI Provider",
        modelTier: "Model Tier",
        apiKeyLabel: "{provider} API Key",
        companyDescription: "Company Description",
        uploadDocument: "Upload Company Document (Optional)",
        analyzeButton: "Analyze Business Opportunities",
        
        // Model Options
        nanoTier: "{tierName} - Fast, cost-effective analysis",
        miniTier: "{tierName} - Balanced performance",
        standardTier: "{tierName} - Most comprehensive analysis",
        
        // Results
        resultsTitle: "AI Implementation Opportunities",
        downloadReport: "Download PDF Report",
        priority: "Priority",
        impact: "Impact",
        effort: "Effort",
        
        // Metrics
        high: "High",
        medium: "Medium",
        low: "Low",
        
        // Messages
        analyzing: "Analyzing Your Business...",
        errorMessage: "An error occurred during analysis",
        fileUploadText: "Click to upload a company document (.txt, .pdf, max 5MB)",
        fileSelected: "Selected: {filename}",
        characterCount: "{count}/1000 characters",
        
        // Validation
        apiKeyRequired: "API key is required",
        descriptionRequired: "Company description is required",
        descriptionMinLength: "Company description must be at least 100 characters long",
        fileSizeError: "File size must be less than 5MB",
        fileTypeError: "Only .txt and .pdf files are allowed"
    }
};
```

### 2. Frontend Implementation Steps

#### 2.1 Add Language Switcher to HTML
- Position in top-right corner of header
- Style with toggle button design
- Add active state styling

#### 2.2 Create Translation System
```javascript
// Language management
let currentLanguage = localStorage.getItem('language') || 'fr';

// Translation function
function t(key, params = {}) {
    let text = translations[currentLanguage][key] || translations['en'][key] || key;
    
    // Replace parameters
    Object.keys(params).forEach(param => {
        text = text.replace(`{${param}}`, params[param]);
    });
    
    return text;
}

// Apply translations to DOM
function applyTranslations() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const params = JSON.parse(element.getAttribute('data-i18n-params') || '{}');
        
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.placeholder = t(key, params);
        } else {
            element.textContent = t(key, params);
        }
    });
    
    // Update document language
    document.documentElement.lang = currentLanguage;
}

// Language switcher handler
function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    
    // Update button states
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
    
    // Apply translations
    applyTranslations();
    
    // Update dynamic content
    updateDynamicTranslations();
}
```

#### 2.3 Update HTML Elements
Add data-i18n attributes to all text elements:
```html
<h1 data-i18n="appTitle">AI Business Opportunity Scanner</h1>
<p data-i18n="appSubtitle">Analyze your company...</p>
<label data-i18n="chooseProvider">Choose AI Provider</label>
```

### 3. Backend Modifications

#### 3.1 Language Parameter in API Requests
- Add language parameter to /api/analyze endpoint
- Pass language to AI prompt generation

#### 3.2 Modified Prompt Generation
```javascript
const createPrompt = (companyDescription, model = 'standard', language = 'en') => {
    const langInstructions = language === 'fr' 
        ? 'Répondez en français. Toutes les opportunités, descriptions et métriques doivent être en français.'
        : 'Respond in English.';
    
    // Include language instruction in prompt
    return `${langInstructions}
    
    Analyze this company description and identify opportunities...
    ${companyDescription}`;
};
```

#### 3.3 PDF Generation in Selected Language
- Pass language parameter to PDF generation
- Translate PDF headers and labels
- Ensure AI-generated content is in correct language

### 4. CSS Additions

```css
/* Language Switcher Styles */
.language-switcher {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 2px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 20px;
    padding: 2px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.lang-btn {
    padding: 6px 16px;
    border: none;
    background: transparent;
    color: var(--medium-gray);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    border-radius: 18px;
    transition: all 0.3s ease;
    font-family: var(--font-primary);
}

.lang-btn:hover {
    color: var(--deep-purple);
}

.lang-btn.active {
    background: var(--deep-purple);
    color: white;
    box-shadow: 0 2px 8px rgba(107, 91, 149, 0.3);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .language-switcher {
        top: 10px;
        right: 10px;
    }
    
    .lang-btn {
        padding: 4px 12px;
        font-size: 12px;
    }
}
```

### 5. Implementation Timeline

#### Phase 1: Frontend Infrastructure (2-3 hours)
1. Add language switcher component to HTML
2. Implement translation object structure
3. Create translation system functions
4. Add data-i18n attributes to all static text

#### Phase 2: Dynamic Content Translation (2-3 hours)
1. Update form validation messages
2. Translate dynamic content (character counter, file upload)
3. Update model tier descriptions based on provider
4. Implement localStorage persistence

#### Phase 3: Backend Integration (2-3 hours)
1. Modify /api/analyze to accept language parameter
2. Update prompt generation for multilingual responses
3. Ensure AI responses are in correct language
4. Test with both OpenAI and Google Gemini

#### Phase 4: PDF Generation (2-3 hours)
1. Update PDF generation to use selected language
2. Translate all PDF headers and labels
3. Ensure AI content in PDF matches language
4. Test PDF downloads in both languages

#### Phase 5: Testing & Polish (1-2 hours)
1. Test all UI elements in both languages
2. Verify instant switching functionality
3. Test API responses in both languages
4. Ensure proper text formatting and alignment
5. Mobile responsiveness testing

### 6. Key Considerations

#### 6.1 Text Expansion
- French text is typically 15-20% longer than English
- Ensure UI elements can accommodate longer text
- Test button and label sizing with French text

#### 6.2 Date and Number Formatting
- Consider locale-specific formatting for dates
- Number formatting (decimal separators)

#### 6.3 AI Response Quality
- Test AI responses in French for quality
- Ensure technical terms are properly translated
- Validate that opportunities make sense in French

#### 6.4 Performance
- Translations loaded once on page load
- No additional API calls for language switching
- Instant UI updates without flickering

### 7. Testing Checklist

- [ ] Language switcher visible and functional
- [ ] All static text translates correctly
- [ ] Form placeholders update on language switch
- [ ] Validation messages appear in correct language
- [ ] AI responses generated in selected language
- [ ] PDF reports generated in correct language
- [ ] Language preference persists on page reload
- [ ] Mobile responsive design maintained
- [ ] No text overflow or UI breaking
- [ ] Character counter works in both languages

### 8. Future Enhancements

1. **Additional Languages**: Structure supports easy addition of more languages
2. **Regional Variants**: Support for fr-CA, en-GB variants
3. **RTL Support**: Framework for Arabic, Hebrew if needed
4. **Translation Management**: External translation file loading
5. **A/B Testing**: Track language preference analytics

## Conclusion

This implementation plan provides a comprehensive approach to adding French/English language switching to the AI Business Opportunity Scanner. The solution is designed to be maintainable, performant, and provide an excellent user experience with instant language switching and complete translation coverage including AI-generated content.
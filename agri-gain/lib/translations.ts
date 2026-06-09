// Translation files for multilingual support

export type Language = 'en' | 'hi'

export const translations = {
  en: {
    // Navigation
    nav: {
      home: 'Home',
      dashboard: 'Dashboard',
      guides: 'Guides',
      help: 'Help',
      logWaste: 'Log Waste',
      opportunities: 'Opportunities',
    },
    // Log Waste Page
    logWaste: {
      title: 'Log Your Farm Waste',
      subtitle: 'Help us understand your waste and discover opportunities',
      step1: 'What waste do you have?',
      step1Desc: 'Select the type of farm waste you want to log',
      step2: 'How much do you have?',
      step2Desc: 'Enter the quantity and select the unit of measurement',
      step3: 'Additional Details',
      step3Desc: 'Add any notes and review your submission',
      quantity: 'Quantity',
      unit: 'Unit',
      notes: 'Notes (Optional)',
      notesPlaceholder: 'Add any additional information about the waste condition, location, etc...',
      reviewTitle: 'Review Your Submission:',
      estimatedWeight: 'Estimated Weight:',
      next: 'Next',
      back: 'Back',
      submit: 'Submit & Get Opportunities',
      submitting: 'Submitting...',
      success: 'Waste logged successfully!',
      redirecting: 'Redirecting to opportunities...',
      logAnother: 'Log Another Waste',
      conversionModels: 'conversion models available',
    },
    // Opportunities Page
    opportunities: {
      personalizedTitle: 'Your Personalized Opportunities',
      generalTitle: 'Waste-to-Value Opportunities',
      personalizedSubtitle: 'AI-powered opportunities based on your specific waste data',
      generalSubtitle: 'Discover actionable ways to monetize your agricultural waste',
      refresh: 'Refresh',
      sourcesAnalyzed: 'sources analyzed',
      queriesGenerated: 'search queries generated',
      processedIn: 'Processed in',
      showingGeneral: 'Showing general opportunities. Log your waste to get personalized AI recommendations!',
      personalizedUnavailable: 'Personalized recommendations unavailable. Showing general opportunities instead.',
      searchPlaceholder: 'Search opportunities...',
      difficulty: 'Difficulty:',
      category: 'Category:',
      onFarmUse: 'On-Farm Use',
      localSale: 'Local Sale',
      processAndSell: 'Process & Sell',
      showing: 'Showing',
      opportunities: 'opportunities',
      opportunity: 'opportunity',
      tailored: 'tailored for your waste',
      logMore: 'Log More Waste',
      noOpportunities: 'No opportunities found',
      noMatch: 'No opportunities match your current filters. Try adjusting your search criteria.',
      clearFilters: 'Clear Filters',
      detailedAnalysis: 'Detailed AI Analysis',
      charactersAnalyzed: 'characters analyzed',
    },
    // Dashboard
    dashboard: {
      title: 'Your Impact Dashboard',
      subtitle: 'Track your environmental and financial impact',
      totalWasteLogged: 'Total Waste Logged',
      revenueGenerated: 'Revenue Generated',
      co2Saved: 'CO₂ Saved',
      activeOpportunities: 'Active Opportunities',
      revenueTrend: 'Revenue Trend',
      wasteLogged: 'Waste Logged',
      quickActions: 'Quick Actions',
      viewOpportunities: 'View Opportunities',
      readGuides: 'Read Guides',
    },
    // Guides
    guides: {
      title: 'How-To Guides',
      subtitle: 'Learn best practices for waste management and monetization',
      noGuides: 'No guides found in this category.',
    },
    // Help
    help: {
      title: 'Help & Support',
      subtitle: 'Get the help you need to maximize your agricultural waste monetization potential',
      quickStart: 'Quick Start',
      faq: 'Frequently Asked Questions',
      gettingStarted: 'Getting Started with Agri-Gain',
      contactSupport: 'Contact Support',
      additionalResources: 'Additional Resources',
    },
    // Common
    common: {
      loading: 'Loading...',
      error: 'Error',
      retry: 'Try Again',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      select: 'Select',
      search: 'Search',
      filter: 'Filter',
    },
    // Waste Types
    wasteTypes: {
      rice: 'Rice Husks',
      sugarcane: 'Sugarcane Bagasse',
      vegetable: 'Vegetable Trimmings',
      fruit: 'Fruit Seeds',
      corn: 'Corn Stalks',
      wheat: 'Wheat Straw',
      coconut: 'Coconut Husks',
      cotton: 'Cotton Stalks',
      other: 'Other',
    },
    // Units
    units: {
      sacks: 'Sacks',
      wheelbarrows: 'Wheelbarrows',
      crates: 'Crates',
      baskets: 'Baskets',
      bags: 'Bags',
      trucks: 'Trucks',
    },
  },
  hi: {
    // Navigation
    nav: {
      home: 'होम',
      dashboard: 'डैशबोर्ड',
      guides: 'गाइड',
      help: 'मदद',
      logWaste: 'अपशिष्ट दर्ज करें',
      opportunities: 'अवसर',
    },
    // Log Waste Page
    logWaste: {
      title: 'अपने खेत के अपशिष्ट को दर्ज करें',
      subtitle: 'हमें अपने अपशिष्ट को समझने और अवसरों की खोज करने में मदद करें',
      step1: 'आपके पास कौन सा अपशिष्ट है?',
      step1Desc: 'उस प्रकार के खेत के अपशिष्ट का चयन करें जिसे आप दर्ज करना चाहते हैं',
      step2: 'आपके पास कितना है?',
      step2Desc: 'मात्रा दर्ज करें और माप की इकाई का चयन करें',
      step3: 'अतिरिक्त विवरण',
      step3Desc: 'कोई नोट्स जोड़ें और अपने सबमिशन की समीक्षा करें',
      quantity: 'मात्रा',
      unit: 'इकाई',
      notes: 'नोट्स (वैकल्पिक)',
      notesPlaceholder: 'अपशिष्ट की स्थिति, स्थान आदि के बारे में कोई अतिरिक्त जानकारी जोड़ें...',
      reviewTitle: 'अपने सबमिशन की समीक्षा करें:',
      estimatedWeight: 'अनुमानित वजन:',
      next: 'आगे',
      back: 'पीछे',
      submit: 'सबमिट करें और अवसर प्राप्त करें',
      submitting: 'सबमिट हो रहा है...',
      success: 'अपशिष्ट सफलतापूर्वक दर्ज किया गया!',
      redirecting: 'अवसरों पर पुनर्निर्देशित किया जा रहा है...',
      logAnother: 'एक और अपशिष्ट दर्ज करें',
      conversionModels: 'रूपांतरण मॉडल उपलब्ध',
    },
    // Opportunities Page
    opportunities: {
      personalizedTitle: 'आपके व्यक्तिगत अवसर',
      generalTitle: 'अपशिष्ट-से-मूल्य अवसर',
      personalizedSubtitle: 'आपके विशिष्ट अपशिष्ट डेटा के आधार पर AI-संचालित अवसर',
      generalSubtitle: 'अपने कृषि अपशिष्ट को मुद्रीकृत करने के लिए कार्रवाई योग्य तरीके खोजें',
      refresh: 'ताज़ा करें',
      sourcesAnalyzed: 'स्रोत विश्लेषण किए गए',
      queriesGenerated: 'खोज क्वेरी उत्पन्न',
      processedIn: 'में संसाधित',
      showingGeneral: 'सामान्य अवसर दिखा रहे हैं। व्यक्तिगत AI सिफारिशें प्राप्त करने के लिए अपना अपशिष्ट दर्ज करें!',
      personalizedUnavailable: 'व्यक्तिगत सिफारिशें उपलब्ध नहीं हैं। इसके बजाय सामान्य अवसर दिखा रहे हैं।',
      searchPlaceholder: 'अवसर खोजें...',
      difficulty: 'कठिनाई:',
      category: 'श्रेणी:',
      onFarmUse: 'खेत पर उपयोग',
      localSale: 'स्थानीय बिक्री',
      processAndSell: 'प्रसंस्करण और बिक्री',
      showing: 'दिखा रहा है',
      opportunities: 'अवसर',
      opportunity: 'अवसर',
      tailored: 'आपके अपशिष्ट के लिए तैयार',
      logMore: 'अधिक अपशिष्ट दर्ज करें',
      noOpportunities: 'कोई अवसर नहीं मिला',
      noMatch: 'कोई अवसर आपके वर्तमान फ़िल्टर से मेल नहीं खाता। अपने खोज मानदंड को समायोजित करने का प्रयास करें।',
      clearFilters: 'फ़िल्टर साफ़ करें',
      detailedAnalysis: 'विस्तृत AI विश्लेषण',
      charactersAnalyzed: 'वर्ण विश्लेषित',
    },
    // Dashboard
    dashboard: {
      title: 'आपका प्रभाव डैशबोर्ड',
      subtitle: 'अपने पर्यावरणीय और वित्तीय प्रभाव को ट्रैक करें',
      totalWasteLogged: 'कुल अपशिष्ट दर्ज',
      revenueGenerated: 'राजस्व उत्पन्न',
      co2Saved: 'CO₂ बचाया',
      activeOpportunities: 'सक्रिय अवसर',
      revenueTrend: 'राजस्व प्रवृत्ति',
      wasteLogged: 'अपशिष्ट दर्ज',
      quickActions: 'त्वरित कार्रवाई',
      viewOpportunities: 'अवसर देखें',
      readGuides: 'गाइड पढ़ें',
    },
    // Guides
    guides: {
      title: 'कैसे-करें गाइड',
      subtitle: 'अपशिष्ट प्रबंधन और मुद्रीकरण के लिए सर्वोत्तम प्रथाओं को सीखें',
      noGuides: 'इस श्रेणी में कोई गाइड नहीं मिला।',
    },
    // Help
    help: {
      title: 'मदद और सहायता',
      subtitle: 'अपनी कृषि अपशिष्ट मुद्रीकरण क्षमता को अधिकतम करने के लिए आवश्यक मदद प्राप्त करें',
      quickStart: 'त्वरित शुरुआत',
      faq: 'अक्सर पूछे जाने वाले प्रश्न',
      gettingStarted: 'Agri-Gain के साथ शुरुआत करें',
      contactSupport: 'सहायता से संपर्क करें',
      additionalResources: 'अतिरिक्त संसाधन',
    },
    // Common
    common: {
      loading: 'लोड हो रहा है...',
      error: 'त्रुटि',
      retry: 'पुनः प्रयास करें',
      cancel: 'रद्द करें',
      save: 'सहेजें',
      delete: 'हटाएं',
      edit: 'संपादित करें',
      close: 'बंद करें',
      select: 'चुनें',
      search: 'खोजें',
      filter: 'फ़िल्टर',
    },
    // Waste Types
    wasteTypes: {
      rice: 'चावल का भूसा',
      sugarcane: 'गन्ने की खोई',
      vegetable: 'सब्जियों की कतरनें',
      fruit: 'फल के बीज',
      corn: 'मक्का के डंठल',
      wheat: 'गेहूं का भूसा',
      coconut: 'नारियल का छिलका',
      cotton: 'कपास के डंठल',
      other: 'अन्य',
    },
    // Units
    units: {
      sacks: 'बोरे',
      wheelbarrows: 'ठेले',
      crates: 'पेटी',
      baskets: 'टोकरी',
      bags: 'थैले',
      trucks: 'ट्रक',
    },
  },
}

export function getTranslation(lang: Language, key: string): string {
  const keys = key.split('.')
  let value: any = translations[lang]
  
  for (const k of keys) {
    value = value?.[k]
    if (value === undefined) {
      // Fallback to English if translation missing
      value = translations.en
      for (const k2 of keys) {
        value = value?.[k2]
      }
      break
    }
  }
  
  return value || key
}


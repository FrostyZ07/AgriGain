/**
 * Test script to verify language switching functionality
 * Run this in browser console after page loads
 */

async function testLanguageSwitching() {
  console.log('🧪 Testing Language Switching Functionality\n')
  
  // Test 1: Check if localStorage works
  console.log('Test 1: localStorage functionality')
  try {
    localStorage.setItem('language', 'hi')
    const saved = localStorage.getItem('language')
    console.log(`✓ localStorage works. Saved: ${saved}`)
    localStorage.setItem('language', 'en') // Reset
  } catch (error) {
    console.error('✗ localStorage error:', error)
    return false
  }
  
  // Test 2: Check if context is available
  console.log('\nTest 2: Language Context availability')
  const contextElement = document.querySelector('[data-language-context]')
  if (contextElement) {
    console.log('✓ Language context element found')
  } else {
    console.log('⚠ Language context element not found (might be OK)')
  }
  
  // Test 3: Check if header language selector exists
  console.log('\nTest 3: Header language selector')
  const languageButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent.includes('English') || btn.textContent.includes('हिंदी')
  )
  if (languageButton) {
    console.log(`✓ Language selector button found: ${languageButton.textContent.trim()}`)
    
    // Click to open dropdown
    languageButton.click()
    
    // Wait for dropdown to appear
    setTimeout(() => {
      const dropdownItems = Array.from(document.querySelectorAll('[role="menuitem"]'))
      console.log(`✓ Dropdown items found: ${dropdownItems.length}`)
      
      if (dropdownItems.length >= 2) {
        console.log('✓ Language options available in dropdown')
        
        // Try clicking Hindi option
        const hindiOption = Array.from(dropdownItems).find(item => 
          item.textContent.includes('हिंदी') || item.textContent.includes('Hindi')
        )
        if (hindiOption) {
          console.log('✓ Hindi option found, clicking...')
          hindiOption.click()
          
          setTimeout(() => {
            const newLanguage = localStorage.getItem('language')
            console.log(`\nResult: Language in localStorage is now: ${newLanguage}`)
            
            if (newLanguage === 'hi') {
              console.log('✅ SUCCESS: Language switched to Hindi!')
            } else {
              console.log('❌ FAILED: Language did not change to Hindi')
            }
          }, 500)
        } else {
          console.log('⚠ Hindi option not found in dropdown')
        }
      }
    }, 300)
  } else {
    console.log('✗ Language selector button not found')
    return false
  }
  
  // Test 4: Check translated content
  console.log('\nTest 4: Check for translated content')
  setTimeout(() => {
    const hasHindiText = Array.from(document.querySelectorAll('*')).some(el => {
      const text = el.textContent || ''
      return text.includes('होम') || text.includes('डैशबोर्ड') || text.includes('गाइड')
    })
    
    if (hasHindiText) {
      console.log('✅ Hindi translations are visible on the page')
    } else {
      console.log('⚠ No Hindi translations found (might need to wait for re-render)')
    }
  }, 1000)
  
  return true
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  console.log('📋 Language Switching Test Script Loaded')
  console.log('Run testLanguageSwitching() in console to test, or it will auto-run in 2 seconds...\n')
  setTimeout(() => {
    testLanguageSwitching()
  }, 2000)
}


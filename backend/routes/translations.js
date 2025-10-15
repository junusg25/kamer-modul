const express = require('express')
const fs = require('fs')
const path = require('path')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const router = express.Router()

// Get all translations (Admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const translationsDir = path.join(__dirname, '../../frontend/src/locales')
    const translations = {}

    // Read all language directories
    const languages = ['en', 'bs']
    
    languages.forEach(language => {
      const languageDir = path.join(translationsDir, language)
      if (fs.existsSync(languageDir)) {
        translations[language] = {}
        
        // Read all JSON files in the language directory
        const files = fs.readdirSync(languageDir).filter(file => file.endsWith('.json'))
        
        files.forEach(file => {
          const namespace = path.basename(file, '.json')
          const filePath = path.join(languageDir, file)
          
          try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
            translations[language][namespace] = content
          } catch (error) {
            console.error(`Error reading ${filePath}:`, error)
          }
        })
      }
    })

    res.json({
      success: true,
      data: translations
    })
  } catch (error) {
    console.error('Error getting translations:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get translations'
    })
  }
})

// Update a translation (Admin only)
router.put('/:language/:namespace/:key', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { language, namespace, key } = req.params
    const { value } = req.body

    // Validate language
    if (!['en', 'bs'].includes(language)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid language'
      })
    }

    // Validate namespace
    if (!['common', 'settings'].includes(namespace)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid namespace'
      })
    }

    if (!value) {
      return res.status(400).json({
        success: false,
        error: 'Value is required'
      })
    }

    // Construct file path
    const filePath = path.join(__dirname, '../../frontend/src/locales', language, `${namespace}.json`)
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Translation file not found'
      })
    }

    // Read current translations
    let translations
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      translations = JSON.parse(content)
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error)
      return res.status(500).json({
        success: false,
        error: 'Failed to read translation file'
      })
    }

    // Parse the key (handle nested keys like "navigation.customers")
    const keyParts = key.split('.')
    let current = translations

    // Navigate to the parent object
    for (let i = 0; i < keyParts.length - 1; i++) {
      if (!current[keyParts[i]]) {
        current[keyParts[i]] = {}
      }
      current = current[keyParts[i]]
    }

    // Set the value
    const finalKey = keyParts[keyParts.length - 1]
    current[finalKey] = value

    // Write back to file
    try {
      fs.writeFileSync(filePath, JSON.stringify(translations, null, 2), 'utf8')
    } catch (error) {
      console.error(`Error writing ${filePath}:`, error)
      return res.status(500).json({
        success: false,
        error: 'Failed to write translation file'
      })
    }

    res.json({
      success: true,
      message: 'Translation updated successfully'
    })
  } catch (error) {
    console.error('Error updating translation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update translation'
    })
  }
})

module.exports = router

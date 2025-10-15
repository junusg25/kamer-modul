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

    console.log('=== TRANSLATION UPDATE DEBUG ===')
    console.log('Language:', language)
    console.log('Namespace:', namespace)
    console.log('Key:', key)
    console.log('Value:', value)

    // Validate language
    if (!['en', 'bs'].includes(language)) {
      console.log('Invalid language:', language)
      return res.status(400).json({
        success: false,
        error: 'Invalid language'
      })
    }

    // Validate namespace
    if (!['common', 'settings'].includes(namespace)) {
      console.log('Invalid namespace:', namespace)
      return res.status(400).json({
        success: false,
        error: 'Invalid namespace'
      })
    }

    if (!value) {
      console.log('No value provided')
      return res.status(400).json({
        success: false,
        error: 'Value is required'
      })
    }

    // Construct file path
    const filePath = path.join(__dirname, '../../frontend/src/locales', language, `${namespace}.json`)
    console.log('File path:', filePath)
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('File does not exist:', filePath)
      return res.status(404).json({
        success: false,
        error: 'Translation file not found',
        debug: {
          filePath,
          exists: fs.existsSync(filePath),
          parentDir: path.dirname(filePath),
          parentExists: fs.existsSync(path.dirname(filePath))
        }
      })
    }

    console.log('File exists, reading content...')

    // Read current translations
    let translations
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      translations = JSON.parse(content)
      console.log('Current translations loaded successfully')
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error)
      return res.status(500).json({
        success: false,
        error: 'Failed to read translation file',
        debug: error.message
      })
    }

    // Parse the key (handle nested keys like "navigation.customers")
    const keyParts = key.split('.')
    let current = translations

    console.log('Key parts:', keyParts)

    // Navigate to the parent object
    for (let i = 0; i < keyParts.length - 1; i++) {
      if (!current[keyParts[i]]) {
        current[keyParts[i]] = {}
      }
      current = current[keyParts[i]]
      console.log(`Navigated to: ${keyParts.slice(0, i + 1).join('.')}`)
    }

    // Set the value
    const finalKey = keyParts[keyParts.length - 1]
    const oldValue = current[finalKey]
    current[finalKey] = value

    console.log(`Updated ${finalKey}: "${oldValue}" -> "${value}"`)

    // Write back to file
    try {
      fs.writeFileSync(filePath, JSON.stringify(translations, null, 2), 'utf8')
      console.log('File written successfully')
    } catch (error) {
      console.error(`Error writing ${filePath}:`, error)
      return res.status(500).json({
        success: false,
        error: 'Failed to write translation file',
        debug: error.message
      })
    }

    console.log('=== TRANSLATION UPDATE SUCCESS ===')

    res.json({
      success: true,
      message: 'Translation updated successfully',
      debug: {
        filePath,
        key,
        oldValue,
        newValue: value
      }
    })
  } catch (error) {
    console.error('Error updating translation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update translation',
      debug: error.message
    })
  }
})

module.exports = router
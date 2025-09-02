import React, { useState } from 'react'
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Tooltip
} from '@mui/material'
import { Language as LanguageIcon } from '@mui/icons-material'
import { useLanguage } from '../contexts/LanguageContext'

export default function LanguageSwitcher() {
  const { currentLanguage, changeLanguage, getAvailableLanguages, getCurrentLanguageInfo, translate } = useLanguage()
  const [anchorEl, setAnchorEl] = useState(null)

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLanguageChange = (languageCode) => {
    changeLanguage(languageCode)
    handleClose()
  }

  const currentLangInfo = getCurrentLanguageInfo()
  const availableLanguages = getAvailableLanguages()

  return (
    <>
      <Tooltip title={translate('language.changeLanguage')}>
        <IconButton
          onClick={handleClick}
          color="inherit"
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            borderRadius: 2,
            px: 1,
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <LanguageIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
            {currentLangInfo?.flag} {currentLangInfo?.code.toUpperCase()}
          </Typography>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            minWidth: 150,
            mt: 1
          }
        }}
      >
        {availableLanguages.map((language) => (
          <MenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            selected={currentLanguage === language.code}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              py: 1,
              px: 2
            }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Typography variant="body1">
                {language.flag}
              </Typography>
            </ListItemIcon>
            <ListItemText>
              <Typography variant="body2">
                {language.name}
              </Typography>
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

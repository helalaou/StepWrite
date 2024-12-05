import { IconButton, Typography, Box, Slider, Popover, List, ListItem, ListItemText, Divider } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSettingsLogic } from '../hooks/useSettingsLogic';

function SettingsGear({ 
  wordSpacing, onWordSpacingChange,
}) {
  const initialSettings = {
    wordSpacing
  };

  const {
    anchorEl,
    currentView,
    settings,
    handleClick,
    handleClose,
    handleViewChange,
    handleSettingChange
  } = useSettingsLogic(initialSettings);

  const fontStyle = {
    wordSpacing: `${settings.wordSpacing}px`,
  };

  const renderMainView = () => (
    <List>
      <ListItem button onClick={() => handleViewChange('textSpacing')}>
        <ListItemText primary="Text Spacing" primaryTypographyProps={{ style: fontStyle }} />
      </ListItem>
    </List>
  );

  const renderTextSpacing = () => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => handleViewChange('main')} size="small" sx={{ mr: 1, cursor: 'pointer' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" style={fontStyle}>Text Spacing</Typography>
      </Box>
      <Divider sx={{ my: 2 }} />
      <Typography gutterBottom style={fontStyle}>Word Spacing</Typography>
      <Slider
        value={settings.wordSpacing}
        onChange={(_, newValue) => {
          handleSettingChange('wordSpacing', newValue);
          onWordSpacingChange(newValue);
        }}
        aria-labelledby="word-spacing-slider"
        valueLabelDisplay="auto"
        step={0.2}
        marks={[
          { value: 0, label: '0' },
          { value: 2, label: '1' },
          { value: 4, label: '2' },
          { value: 6, label: '3' },
          { value: 8, label: '4' },
          { value: 10, label: '5' },
        ]}
        min={0}
        max={10}
        sx={{ mb: 2 }}
      />
    </Box>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'textSpacing':
        return renderTextSpacing();
      default:
        return renderMainView();
    }
  };

  return (
    <>
      <IconButton aria-label="settings" onClick={handleClick} sx={{ cursor: 'pointer' }}>
        <SettingsIcon />
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ 
          p: 3, 
          width: 300, 
          border: '1px solid #e0e0e0', 
          borderRadius: 2,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          backgroundColor: '#f5f5f5',
          ...fontStyle,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="h2" style={{...fontStyle, fontWeight: 'bold'}}>Settings</Typography>
            <IconButton onClick={handleClose} size="small" sx={{ cursor: 'pointer' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {renderContent()}
        </Box>
      </Popover>
    </>
  );
}

export default SettingsGear;

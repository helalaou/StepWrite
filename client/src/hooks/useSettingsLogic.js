import { useState } from 'react';

export function useSettingsLogic(initialSettings) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentView, setCurrentView] = useState('main');
  const [settings, setSettings] = useState(initialSettings);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setCurrentView('main');
  };

  const handleClose = () => {
    setAnchorEl(null);
    setCurrentView('main');
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({ ...prev, [setting]: value }));
  };

  return {
    anchorEl,
    currentView,
    settings,
    handleClick,
    handleClose,
    handleViewChange,
    handleSettingChange
  };
}

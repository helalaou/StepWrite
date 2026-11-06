import React from 'react';
import { IconButton, Tooltip, useMediaQuery } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useSettings } from './SettingsProvider';
import { playClickSound } from '../utils/soundUtils';
import { WATCH_SCREEN_QUERY } from '../utils/layout';

// The gear that opens Settings, in the top right corner of every page and clear
// of a phone's notch
function SettingsButton() {
  const { openSettings, isSettingsOpen } = useSettings();
  const isWatch = useMediaQuery(WATCH_SCREEN_QUERY);
  const inset = isWatch ? 4 : 12;

  if (isSettingsOpen) return null;

  return (
    <Tooltip title="Settings">
      <IconButton
        aria-label="Settings"
        size={isWatch ? 'small' : 'medium'}
        onClick={() => {
          playClickSound();
          openSettings();
        }}
        sx={{
          position: 'fixed',
          top: `max(${inset}px, env(safe-area-inset-top))`,
          right: `max(${inset}px, env(safe-area-inset-right))`,
          zIndex: 20,
          color: 'text.secondary',
          backgroundColor: 'rgba(var(--sw-surface-rgb), 0.8)',
          backdropFilter: 'blur(6px)',
          boxShadow: 1,
          '&:hover': { backgroundColor: 'rgba(var(--sw-surface-rgb), 0.95)', color: 'text.primary' },
        }}
      >
        <SettingsIcon fontSize={isWatch ? 'small' : 'medium'} />
      </IconButton>
    </Tooltip>
  );
}

export default SettingsButton;

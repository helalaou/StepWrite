import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LightModeIcon from '@mui/icons-material/LightMode';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import { useSettings } from './SettingsProvider';
import { applyReadingSpeed, fetchSpeech } from '../utils/audioUtils';
import {
  ANSWER_PAUSES,
  checkServer,
  DEFAULT_SETTINGS,
  normalizeServerUrl,
  READING_SPEEDS,
  REPEAT_DELAYS,
  VOICES,
} from '../utils/settings';

const INPUT_MODE_CHOICES = [
  { value: 'HANDS_FREE', label: 'Hands-free', detail: 'Speak your answers and commands. StepWrite listens on its own.' },
  { value: 'TEXT_AND_VOICE', label: 'Type or speak', detail: 'Type, or press the microphone to speak an answer.' },
  { value: 'TEXT_ONLY', label: 'Type only', detail: 'Type every answer. The microphone stays off.' },
];

const SAMPLE_TEXT = 'This is how StepWrite will sound.';

const seconds = ms => `${ms / 1000} s`;
const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1);

function Section({ title, children }) {
  return (
    <Box component="section" sx={{ py: 2 }}>
      <Typography variant="overline" component="h3" sx={{ color: 'text.secondary', lineHeight: 2 }}>
        {title}
      </Typography>
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}

// The server address is checked and saved as one step, so a half-typed
// address never replaces the working one.
function ServerAddress({ serverUrl, onSave }) {
  const [draft, setDraft] = useState(serverUrl);
  const [status, setStatus] = useState(null); // null | 'checking' | 'ok' | 'unreachable' | 'invalid'

  useEffect(() => setDraft(serverUrl), [serverUrl]);

  const check = async (value = draft) => {
    const url = normalizeServerUrl(value);
    if (!url) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    const reachable = await checkServer(url);
    setStatus(reachable ? 'ok' : 'unreachable');
    if (reachable) onSave(url);
  };

  const messages = {
    checking: 'Checking…',
    ok: 'Connected. StepWrite will use this server.',
    unreachable: 'No StepWrite server answered at this address, so the old one is kept.',
    invalid: 'Enter an address that starts with https:// (or http:// on your own network).',
  };
  const isError = status === 'unreachable' || status === 'invalid';

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label="Server address"
          value={draft}
          onChange={event => { setDraft(event.target.value); setStatus(null); }}
          onKeyDown={event => { if (event.key === 'Enter') check(); }}
          error={isError}
          size="small"
          fullWidth
          inputProps={{ inputMode: 'url', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }}
        />
        <Button variant="outlined" onClick={() => check()} disabled={status === 'checking'} sx={{ flexShrink: 0, height: 40 }}>
          Check
        </Button>
      </Stack>
      {status && (
        <Typography
          variant="body2"
          role={isError ? 'alert' : 'status'}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: isError ? 'error.main' : status === 'ok' ? 'var(--sw-green)' : 'text.secondary' }}
        >
          {status === 'ok' && <CheckCircleIcon fontSize="small" />}
          {isError && <ErrorOutlineIcon fontSize="small" />}
          {messages[status]}
        </Typography>
      )}
      {serverUrl !== DEFAULT_SETTINGS.serverUrl && (
        <Button size="small" onClick={() => { setDraft(DEFAULT_SETTINGS.serverUrl); check(DEFAULT_SETTINGS.serverUrl); }} sx={{ alignSelf: 'flex-start' }}>
          Use this build's server ({DEFAULT_SETTINGS.serverUrl})
        </Button>
      )}
    </Stack>
  );
}

function SettingsDialog() {
  const { settings, updateSettings, isSettingsOpen, closeSettings } = useSettings();
  const fullScreen = useMediaQuery(theme => theme.breakpoints.down('sm'));
  const [isSampleLoading, setIsSampleLoading] = useState(false);
  const sampleRef = useRef(null);

  const stopSample = () => {
    sampleRef.current?.pause();
    sampleRef.current = null;
  };

  const playSample = async () => {
    stopSample();
    setIsSampleLoading(true);
    try {
      const audio = applyReadingSpeed(new Audio(await fetchSpeech(SAMPLE_TEXT)));
      sampleRef.current = audio;
      await audio.play();
    } catch (error) {
      console.warn('Voice sample failed:', error);
    } finally {
      setIsSampleLoading(false);
    }
  };

  const close = () => {
    stopSample();
    closeSettings();
  };

  return (
    <Dialog
      open={isSettingsOpen}
      onClose={close}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="settings-title"
      // Full screen on a phone, it takes the page's background, without the
      // lighter tint dark mode gives raised surfaces
      PaperProps={{ sx: fullScreen ? { backgroundImage: 'none', bgcolor: 'background.default' } : undefined }}
    >
      <DialogTitle id="settings-title" sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
        <Box component="span" sx={{ flex: 1, fontWeight: 600 }}>Settings</Box>
        <IconButton onClick={close} aria-label="Close settings">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ py: 0 }}>
        <Section title="Appearance">
          <ToggleButtonGroup
            value={settings.theme}
            exclusive
            fullWidth
            onChange={(event, theme) => theme && updateSettings({ theme })}
            aria-label="Theme"
          >
            <ToggleButton value="system" aria-label="Match the system"><SettingsBrightnessIcon sx={{ mr: 1 }} />System</ToggleButton>
            <ToggleButton value="light" aria-label="Light"><LightModeIcon sx={{ mr: 1 }} />Light</ToggleButton>
            <ToggleButton value="dark" aria-label="Dark"><DarkModeIcon sx={{ mr: 1 }} />Dark</ToggleButton>
          </ToggleButtonGroup>
        </Section>

        <Divider />
        <Section title="Answering">
          <RadioGroup
            value={settings.inputMode}
            onChange={event => updateSettings({ inputMode: event.target.value })}
            aria-label="How you answer"
          >
            {INPUT_MODE_CHOICES.map(choice => (
              <FormControlLabel
                key={choice.value}
                value={choice.value}
                control={<Radio />}
                sx={{ alignItems: 'flex-start', mb: 1, '& .MuiRadio-root': { pt: 0.5 } }}
                label={(
                  <Box>
                    <Typography>{choice.label}</Typography>
                    <Typography variant="body2" color="text.secondary">{choice.detail}</Typography>
                  </Box>
                )}
              />
            ))}
          </RadioGroup>
          {settings.inputMode === 'HANDS_FREE' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel id="answer-pause-label">Send my answer after a pause of</InputLabel>
                <Select
                  labelId="answer-pause-label"
                  label="Send my answer after a pause of"
                  value={settings.answerPause}
                  onChange={event => updateSettings({ answerPause: event.target.value })}
                >
                  {ANSWER_PAUSES.map(ms => <MenuItem key={ms} value={ms}>{seconds(ms)}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel id="repeat-after-label">Ask the question again after</InputLabel>
                <Select
                  labelId="repeat-after-label"
                  label="Ask the question again after"
                  value={settings.repeatAfter}
                  onChange={event => updateSettings({ repeatAfter: event.target.value })}
                >
                  {REPEAT_DELAYS.map(ms => (
                    <MenuItem key={ms} value={ms}>{ms ? `${seconds(ms)} of silence` : 'Never'}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </Section>

        <Divider />
        <Section title="Reading aloud">
          <FormControlLabel
            control={(
              <Switch
                checked={settings.readAloud}
                onChange={event => updateSettings({ readAloud: event.target.checked })}
              />
            )}
            label="Read questions and the finished text aloud"
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" fullWidth>
              <InputLabel id="voice-label">Voice</InputLabel>
              <Select
                labelId="voice-label"
                label="Voice"
                value={settings.voice}
                onChange={event => updateSettings({ voice: event.target.value })}
              >
                {VOICES.map(voice => <MenuItem key={voice} value={voice}>{capitalize(voice)}</MenuItem>)}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              onClick={playSample}
              disabled={isSampleLoading}
              sx={{ flexShrink: 0, height: 40 }}
            >
              Try it
            </Button>
          </Stack>
          <Box>
            <Typography id="reading-speed-label" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Reading speed
            </Typography>
            <ToggleButtonGroup
              value={settings.readingSpeed}
              exclusive
              fullWidth
              size="small"
              onChange={(event, readingSpeed) => readingSpeed && updateSettings({ readingSpeed })}
              aria-labelledby="reading-speed-label"
            >
              {READING_SPEEDS.map(speed => <ToggleButton key={speed} value={speed}>{speed}×</ToggleButton>)}
            </ToggleButtonGroup>
          </Box>
        </Section>

        <Divider />
        <Section title="Server">
          <Typography variant="body2" color="text.secondary">
            The StepWrite server that writes the text and does the speech. On a phone or watch,
            use the HTTPS address of your server or tunnel.
          </Typography>
          <ServerAddress serverUrl={settings.serverUrl} onSave={serverUrl => updateSettings({ serverUrl })} />
        </Section>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 1.5 }}>
        <Button color="inherit" onClick={() => updateSettings(DEFAULT_SETTINGS)}>
          Reset all
        </Button>
        <Button variant="contained" onClick={close}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SettingsDialog;

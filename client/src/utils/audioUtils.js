/**
 * Audio utility functions for consistent audio handling across all devices
 */

// Audio context singleton to ensure we reuse the same context
let audioContextInstance = null;

/**
 * Get or initialize the global AudioContext
 * @returns {AudioContext} The audio context instance
 */
export const getAudioContext = () => {
  if (!audioContextInstance) {
    // Use standard AudioContext with fallback
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContextInstance = new AudioContextClass();
  }
  return audioContextInstance;
};

/**
 * Initialize audio on the page - should be called on first user interaction
 * This helps with iOS/Safari requirements that audio must be started on user gesture
 * @returns {Promise<void>}
 */
export const initializeAudio = async () => {
  try {
    const audioContext = getAudioContext();
    
    // For iOS Safari, we need to resume the audio context on user interaction
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      console.log('AudioContext resumed successfully');
    }
    
    // Create a silent audio element and play it to unblock audio on iOS
    const silentSound = new Audio();
    silentSound.src = 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
    
    try {
      await silentSound.play();
      setTimeout(() => silentSound.pause(), 1);
      console.log('Silent sound played successfully to unblock audio');
    } catch (e) {
      console.warn('Failed to play silent sound', e);
    }
    
    return audioContext;
  } catch (error) {
    console.error('Failed to initialize audio:', error);
    throw error;
  }
};

/**
 * Play audio with mobile-friendly error handling
 * @param {string} url The URL of the audio to play
 * @param {Function} onEnded Callback when audio playback ends
 * @param {Function} onError Callback when error occurs
 * @returns {HTMLAudioElement} The audio element
 */
export const playAudio = async (url, onEnded = () => {}, onError = () => {}) => {
  try {
    // Ensure audio is initialized
    await initializeAudio();
    
    const audio = new Audio(url);
    
    // Set up event listeners
    audio.addEventListener('ended', () => {
      console.log('Audio playback ended');
      onEnded();
    });
    
    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      onError(e);
    });
    
    // Mobile browsers often require user interaction before playing audio
    // This code attempts to play the audio and handles the error if it fails
    try {
      await audio.play();
      console.log('Audio playback started successfully');
    } catch (error) {
      console.warn('Auto-play prevented:', error);
      // For mobile, we might want to show a play button to the user
      onError(error);
    }
    
    return audio;
  } catch (error) {
    console.error('Error in playAudio:', error);
    onError(error);
    return null;
  }
};

/**
 * Check if the device is mobile
 * @returns {boolean}
 */
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Check if the browser supports audio recording
 * @returns {Promise<boolean>}
 */
export const checkAudioRecordingSupport = async () => {
  try {
    // Check if MediaRecorder is available
    if (!window.MediaRecorder) {
      console.warn('MediaRecorder not supported');
      return false;
    }
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('getUserMedia not supported');
      return false;
    }
    
    // Try to get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Check supported formats
    const supportedFormats = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus'
    ];
    
    const foundSupportedFormat = supportedFormats.some(format => 
      MediaRecorder.isTypeSupported(format)
    );
    
    // Stop the stream we just created
    stream.getTracks().forEach(track => track.stop());
    
    if (!foundSupportedFormat) {
      console.warn('No supported recording formats found');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking audio recording support:', error);
    return false;
  }
}; 

/**
 * Filter and clean audio using noise reduction and gating.
 * @param {Float32Array} rawData - The raw audio data (single channel)
 * @param {Object} noiseConfig - Noise reduction config (floorMultiplier, maxNoisePercent, minSignificantPercent, sampleSize, volumeThreshold)
 * @returns {Float32Array|null} Cleaned audio data, or null if rejected as noise
 */
export function filterAndCleanAudio(rawData, noiseConfig) {
  // Calculate amplitudes
  const amplitudes = rawData.map(Math.abs);
  const sortedAmplitudes = [...amplitudes].sort((a, b) => a - b);

  // Noise floor (lowest 20%)
  const noiseFloorIndex = Math.floor(sortedAmplitudes.length * 0.2);
  const noiseFloor = sortedAmplitudes[noiseFloorIndex];
  const medianAmplitude = sortedAmplitudes[Math.floor(sortedAmplitudes.length * 0.5)];

  // Percent of samples likely noise
  const percentNoise = (amplitudes.filter(a => a <= noiseFloor * 2).length / amplitudes.length) * 100;
  if (percentNoise > noiseConfig.maxNoisePercent) {
    // Too much noise, reject
    return null;
  }

  // Clean the audio
  const cleanedData = rawData.map(sample => {
    const amplitude = Math.abs(sample);
    // Noise gate
    if (amplitude < noiseFloor * noiseConfig.floorMultiplier) {
      return 0;
    }
    // Noise reduction
    const scaledSample = sample * (1 - (noiseFloor / amplitude));
    return scaledSample;
  });

  // Check for enough significant sound
  const significantSamples = cleanedData.filter(sample =>
    Math.abs(sample) > noiseConfig.volumeThreshold
  ).length;
  const percentSignificant = (significantSamples / cleanedData.length) * 100;
  if (percentSignificant < noiseConfig.minSignificantPercent) {
    // Not enough speech, reject
    return null;
  }

  return Float32Array.from(cleanedData);
} 
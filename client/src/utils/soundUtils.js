/**
 * Sound utility functions for the application
 */

// Cache for the audio objects to prevent multiple instances
const audioCache = {};

/**
 * Play a sound effect
 * @param {string} soundName - The name of the sound file without extension
 * @param {number} volume - Volume level between 0 and 1 (default: 0.5)
 * @returns {Promise} - A promise that resolves when the sound has finished playing
 */
export const playSound = (soundName, volume = 0.5) => {
  return new Promise((resolve) => {
    try {
      // Check if we already have this audio in cache
      if (!audioCache[soundName]) {
        audioCache[soundName] = new Audio(`/${soundName}.mp3`);
      }
      
      const audio = audioCache[soundName];
      
      // Reset the audio to the beginning if it's already playing
      audio.currentTime = 0;
      
      // Set volume
      audio.volume = volume;
      
      // Play the sound
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Sound started playing successfully
            audio.addEventListener('ended', () => {
              resolve();
            }, { once: true });
          })
          .catch(error => {
            // Auto-play was prevented or there was another error
            console.warn(`Sound playback error for ${soundName}:`, error);
            resolve();
          });
      } else {
        // Older browsers might not return a promise
        audio.addEventListener('ended', () => {
          resolve();
        }, { once: true });
      }
    } catch (error) {
      console.error('Error playing sound:', error);
      resolve();
    }
  });
};

/**
 * Play the click sound effect
 * @param {number} volume - Volume level between 0 and 1 (default: 0.4)
 * @returns {Promise} - A promise that resolves when the sound has finished playing
 */
export const playClickSound = () => {
  console.log('🔊 SOUND [playClickSound]: Function called');
  
  try {
    // Create a new Audio instance each time
    const clickSound = new Audio('/click.mp3');
    
    console.log('🔊 SOUND [playClickSound]: Audio object created');
    
    // Add event listeners to track sound playback
    clickSound.addEventListener('play', () => {
      console.log('🔊 SOUND [playClickSound]: Sound STARTED playing');
    });
    
    clickSound.addEventListener('ended', () => {
      console.log('🔊 SOUND [playClickSound]: Sound FINISHED playing');
    });
    
    clickSound.addEventListener('error', (error) => {
      console.error('🔊 SOUND [playClickSound]: Error playing sound:', error);
    });
    
    // Play the sound
    console.log('🔊 SOUND [playClickSound]: Attempting to play sound');
    clickSound.play().then(() => {
      console.log('🔊 SOUND [playClickSound]: Play promise resolved successfully');
    }).catch(error => {
      console.error('🔊 SOUND [playClickSound]: Play promise rejected:', error);
    });
  } catch (error) {
    console.error('🔊 SOUND [playClickSound]: Exception caught:', error);
  }
}; 
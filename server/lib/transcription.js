// Whisper writes words even for audio with no speech in it: "Thank you for
// watching." for room noise, "you" for a knock or a sleeve brushing the mic.
// It also rates each segment's chance of holding no speech, which tells the
// two apart (spoken answers, even single words in loud noise, scored at most
// 0.2 in testing; noise at least 0.6), so segments rated above
// `noSpeechThreshold` are dropped. A transcription without segments, from a
// response format that has none, is kept whole.
export function spokenText(transcription, noSpeechThreshold) {
  if (!Array.isArray(transcription.segments)) {
    return transcription.text.trim();
  }
  return transcription.segments
    .filter(segment => (segment.no_speech_prob ?? 0) <= noSpeechThreshold)
    .map(segment => segment.text)
    .join('')
    .trim();
}

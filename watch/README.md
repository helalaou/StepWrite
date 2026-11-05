# StepWrite for Apple Watch

A native watchOS app for StepWrite's hands-free flow. It reads each question aloud, listens for
the answer through the watch's microphone and shows the finished text, which you can share or
have read back. It calls the same server endpoints as the web app (`/api/write`,
`/api/transcribe` and `/api/tts/generate`), so the server needs no changes.

## Requirements

- Xcode 16 or later with the watchOS platform installed
- An Apple Watch on watchOS 10 or later, or the watchOS simulator
- The StepWrite server, set up as in the [main README](../README.md#getting-started)

## Run in the simulator

1. Start the server: `npm start` in `server/`.
2. Open `watch/StepWrite.xcodeproj`, choose an Apple Watch simulator as the run destination and
   press **Run**.

The simulator uses the Mac's microphone and speakers and reaches the server at
`http://localhost:3001`.

## Install on your watch

1. **Make the server reachable over HTTPS.** A watch can't reach `localhost` on your Mac. Start
   the ngrok tunnel (see [Remote access with ngrok](../README.md#remote-access-with-ngrok)) and
   put its server address in [`StepWrite/ServerSettings.swift`](StepWrite/ServerSettings.swift).
   It ships with the address from `NGROK.SERVER_URL` in `client/src/config.js`.
2. **Sign the app.** In Xcode, select the **StepWrite** target, open **Signing & Capabilities**
   and choose your team. Any Apple ID works. If Xcode reports that the bundle identifier
   `io.github.helalaou.stepwrite.watch` is taken, change it to one of your own.
3. **Connect the watch.** Pair the watch with an iPhone, connect the iPhone to the Mac and keep
   both unlocked. The first time, turn on Developer Mode on both the iPhone and the watch when
   asked (**Settings > Privacy & Security > Developer Mode**).
4. Choose the watch as the run destination and press **Run**. The first time it runs, allow
   microphone access.

The app runs on the watch alone; no iPhone app is needed. An app signed with a free Apple ID stops
opening after 7 days, after which you run it from Xcode again. With a paid Apple Developer Program
membership the signature lasts a year, and you can share the app through TestFlight.

## Using it

Like the web app's hands-free mode, it needs neither your hands nor your eyes. Writing starts when
the app opens: it reads the first question, taps your wrist and listens. Answer out loud and pause
for a moment to end the answer. If nobody answers for 12 seconds, it reads the question again.

Say any of the web app's commands instead of an answer:

| Say | To |
| --- | --- |
| "previous question", "next question", "skip this question" | Move between questions |
| "change my answer", then the new answer | Replace the current question's answer |
| "repeat the question" | Hear the question again |
| "pause writing", then "continue writing" | Pause and resume |
| "show draft" | Hear the draft written so far, once there is one |
| "finish writing" | Get the finished text, read aloud |
| "read it again", "go back to questions", "end writing" | On the text: hear it again, change answers or finish |
| "go to home page" | Stop writing |

A click confirms each command, and the watch says what it did. On the screen, the bars at the
bottom move blue while the watch speaks and green while it hears you. The progress dots show
answered, skipped and remaining questions, and a **Draft** badge appears once a draft is ready.
The watch listens once it has finished speaking, and the small buttons under each question do the
same as the commands, including stopping a reading early. The finished text can be shared from
the watch.

## Code

| File | Role |
| --- | --- |
| `StepWriteApp.swift`, `ContentView.swift` | The app and its screens |
| `Indicators.swift` | The level bars, status, progress dots and other indicators |
| `ConversationModel.swift` | The question-and-answer loop, the same flow as the web app's hands-free mode |
| `SpeechRecorder.swift` | Records an answer and ends it once speech stops rising above the room's noise floor |
| `SpeechPlayer.swift` | Plays the server's voice, falling back to the watch's own voice |
| `Cues.swift` | The click and wrist taps that confirm what happened |
| `VoiceCommand.swift` | Recognizes spoken commands |
| `StepWriteAPI.swift` | Calls the server |
| `ServerSettings.swift` | The server address |

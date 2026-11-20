# Dictation (Ditado)

Every note field has a mic button in the textarea's top-right corner: an Exercise's note in a session (`Nota de <exercise>`, after `Nota`), `Notas do treino`, and the After-effects in `Treinos anteriores` (`Como está o corpo`, and `Nota de <exercise>` after `Nota`). The user taps it, speaks European Portuguese, taps again, and the transcription is appended to the note. Transcription runs on the device with Whisper small (Transformers.js in a Web Worker). Audio never leaves the device; only the model files (about 250 MB, once, then browser-cached) are downloaded, and only when the user first dictates. The button is absent where `MediaRecorder` or `getUserMedia` is missing.

## Sub-features

- `dictation-record` toggles `Ditar nota` and `Parar ditado` (`aria-pressed`). The status line under the field (`.dictate-status`, `role=status`) reads `A ouvir…`.
- `dictation-load` shows, after stopping and while the audio decodes, `A descarregar o modelo de voz: <loaded> / <total> MB (só da primeira vez)` when download progress has arrived, or `A preparar o modelo de voz…` (a brief flash once the model is ready). The button is disabled meanwhile. It starts loading when recording starts, so the wait overlaps with talking.
- `dictation-transcribe` shows `A transcrever…` with the button disabled, then appends the text: an empty note becomes the text, otherwise one space, or none after a newline. A blank transcription changes nothing.
- `dictation-error` shows `Sem acesso ao microfone.` when permission is refused, or `Não foi possível transcrever. Tenta outra vez.`

## How to get to it (user POV)

- `Treino` view, `Registo`, on a started session (`Começar <day>`, a day button or `Treino livre`): `Notas do treino`, and `Nota de <exercise>` after `Nota`.
- `Treino` view, `Treinos anteriores` (on a date one to three days after a session): `Como está o corpo`, and `Nota de <exercise>` after `Nota`.

## Driving it with session.mjs

Preconditions: `openApp` launches chromium without these flags, so a dictation drive opens its own browser: launch chromium with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<abs>/e2e/fixtures/nota.wav%noloop` and the `microphone` permission. `e2e/dictation.mjs` does this and caches the model under `e2e/.cache/whisper` (gitignored), so only the first run downloads it.

- **Dictate.** Click `Treino livre`, fill `Notas do treino` with `Bom treino.`, click the `Ditar nota` beside it, wait 11 s (the clip is 8 s of speech plus 5 s of silence), click `Parar ditado`. Within about 10 s the note starts with `Bom treino. ` and holds the clip's words (`supino`). `readStored(page)['workout-sessions'].sessions[0].note.text` (`readStored` from `e2e/_driver.mjs`) equals the field.
- **Mic on the other notes.** An opened Exercise note has one too (`e2e/workout.mjs`).
- **Proof.** Screenshots at 390 px and 1280 px, light and dark (switch the theme with the header button, not `emulateMedia`).

## Gotchas

- The fake microphone track ends when the file ends, and that stops the recorder by itself. Stop before the file ends, which is why the fixture has 5 s of trailing silence.
- Transformers.js sizes each file with a one-byte `Range` request. A request cache must answer ranges, and a fulfilled response over about 90 MB crashes Chromium's devtools pipe, so serve cached files from a local HTTP server and redirect to it.
- The model runtime (onnxruntime wasm) comes from jsdelivr and the model from huggingface.co. Do not drive this over a network you do not want to hit.
- The status line is `display: none` while empty, so read it with `.dictate-status`, not by role.
- An Exercise or After-effect note's toggle button and its textarea share the name `Nota de <exercise>`. Reach the field with `getByRole('textbox', { name })`, as `e2e/workout.mjs` does.

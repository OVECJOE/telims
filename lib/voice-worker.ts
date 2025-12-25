import { pipeline } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recognizer: any = null;

self.addEventListener("message", async (event) => {
    const { type, audio } = event.data;

    if (type === "load") {
        try {
            self.postMessage({ type: "status", status: "loading" });
            // Use a larger, more accurate model for voice sync
            recognizer = await pipeline("automatic-speech-recognition", "Xenova/whisper-medium.en", {
                progress_callback: (progress: unknown) => {
                    self.postMessage({ type: "progress", progress });
                },
            });
            self.postMessage({ type: "status", status: "ready" });
        } catch (error) {
            self.postMessage({ type: "error", error: String(error) });
        }
    }

    if (type === "transcribe" && recognizer && audio) {
        try {
            const result = await recognizer(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
            });
            self.postMessage({ type: "result", result });
        } catch (error) {
            self.postMessage({ type: "error", error: String(error) });
        }
    }
});

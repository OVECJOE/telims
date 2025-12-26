import { 
  pipeline, 
  AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

let recognizer: AutomaticSpeechRecognitionPipeline | null = null;

self.addEventListener("message", async (event) => {
    const { type, audio } = event.data;

    if (type === "load") {
        try {
            self.postMessage({ type: "status", status: "loading" });
            
            // Use Whisper Tiny English model - optimized for browser use
            const model = await pipeline(
                "automatic-speech-recognition",
                "Xenova/whisper-tiny.en",
                {
                    progress_callback: (progress: unknown) => {
                        self.postMessage({ type: "progress", progress });
                    },
                }
            );
            
            recognizer = model as AutomaticSpeechRecognitionPipeline;
            
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
                language: "english",
                task: "transcribe",
            });
            
            self.postMessage({ type: "result", result });
        } catch (error) {
            self.postMessage({ type: "error", error: String(error) });
        }
    }
});

export {};
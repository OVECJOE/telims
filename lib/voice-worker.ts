import { 
  pipeline, 
  AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

let recognizer: AutomaticSpeechRecognitionPipeline | null = null;

self.addEventListener("message", async (event) => {
    const { type, audio, model } = event.data;

    if (type === "load") {
        try {
            self.postMessage({ type: "status", status: "loading" });
            let modelName = "Xenova/whisper-tiny";
            if (model === "small") modelName = "Xenova/whisper-small";
            else if (model === "medium") modelName = "Xenova/whisper-medium";
            else if (model === "large") modelName = "distil-whisper/distil-large-v3";

            const loadedModel = await pipeline(
                "automatic-speech-recognition",
                modelName,
                {
                    progress_callback: (progress: unknown) => {
                        self.postMessage({ type: "progress", progress });
                    },
                }
            );
            recognizer = loadedModel as AutomaticSpeechRecognitionPipeline;
            self.postMessage({ type: "status", status: "ready" });
        } catch (error) {
            self.postMessage({ type: "error", error: String(error) });
            recognizer = null;
        }
    }

    if (type === "transcribe") {
        if (!recognizer) {
            self.postMessage({ type: "error", error: "Model not loaded" });
            return;
        }
        if (!audio) {
            self.postMessage({ type: "error", error: "No audio data provided" });
            return;
        }
        try {
            const result = await recognizer(audio, {
                chunk_length_s: 30,
                max_length: 30000,
                temperature: 0.0,
                top_k: 50,
                top_p: 0.95,
                num_beams: 5,
                return_timestamps: "word",
                task: "transcribe",
            });
            self.postMessage({ type: "result", result });
        } catch (error) {
            self.postMessage({ type: "error", error: String(error) });
        }
    }
});

export {};
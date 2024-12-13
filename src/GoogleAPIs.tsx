export const fetchTTSAudio = async (
    text: string,
    apiKey: string
): Promise<Blob | null> => {
    const payload = {
        input: { text },
        voice: {
            name: "en-GB-neural2-B",
            languageCode: "en-GB",
        },
        audioConfig: {
            audioEncoding: "LINEAR16",
        },
    };

    try {
        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }
        );

        const data = await response.json();
        if (data.audioContent) {
            const base64 = data.audioContent;
            const byteCharacters = atob(base64);
            const byteNumbers = new Uint8Array(
                Array.from(byteCharacters, (char) => char.charCodeAt(0))
            );
            return new Blob([byteNumbers], { type: "audio/wav" });
        } else {
            console.error("TTS API error:", data);
            return null;
        }
    } catch (error) {
        console.error("Error fetching TTS audio:", error);
        return null;
    }
};

export const sendAudioToSTT = async (
    audioBlob: Blob,
    apiKey: string
): Promise<string | null> => {
    try {
        const audioArrayBuffer = await audioBlob.arrayBuffer();
        const audioBase64 = btoa(
            String.fromCharCode(...new Uint8Array(audioArrayBuffer))
        );

        const payload = {
            config: {
                encoding: "LINEAR16",
                sampleRateHertz: 16000,
                languageCode: "en-US",
            },
            audio: {
                content: audioBase64,
            },
        };

        const response = await fetch(
            `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        const data = await response.json();
        if (data.results) {
            return data.results
                .map((result: any) => result.alternatives[0]?.transcript || "")
                .join(" ");
        } else {
            console.error("STT API error:", data);
            return null;
        }
    } catch (error) {
        console.error("Error sending audio to STT API:", error);
        return null;
    }
};



import React, { useEffect, useRef } from "react";

type AudioAnalyzerProps = {
    stream: MediaStream | null;
    isMuted: boolean;
    onUserSpeechDetected: (audioBlob: Blob) => void | Promise<void>; // Support async
    onHeadphonesDetected?: () => void;
};


const AudioAnalyzer: React.FC<AudioAnalyzerProps> = ({
    stream,
    isMuted,
    onUserSpeechDetected,
    onHeadphonesDetected,
}) => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const noiseThresholdRef = useRef<number>(0); // Dynamic noise floor
    const speakingRef = useRef<boolean>(false); // To prevent multiple triggers for continuous speech
    const isAnalyzingRef = useRef<boolean>(false); // Tracks if audio analysis is active

    useEffect(() => {
        if (stream) {
            setupAudioAnalysis(stream);
        }
        return () => {
            cleanupAudioAnalysis();
        };
    }, [stream]);

    const setupAudioAnalysis = async (stream: MediaStream) => {
        console.log("Setting up audio analysis...");
        const audioTrack = stream.getAudioTracks()[0];

        if (!audioTrack || audioTrack.readyState !== "live") {
            console.error("Audio track is not live. Aborting setup.");
            return;
        }

        const AudioContext =
            window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContext();

        if (audioContext.state === "suspended") {
            console.log("Resuming AudioContext...");
            await audioContext.resume();
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyserRef.current = analyser;
        audioContextRef.current = audioContext;

        console.log("Waiting for microphone to stabilize...");
        setTimeout(() => {
            console.log("Starting calibration...");
            calibrateNoiseFloor();
        }, 500); // Adjust delay as needed
    };

    const cleanupAudioAnalysis = () => {
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        isAnalyzingRef.current = false;
    };

    const detectHeadphones = async () => {
        console.log("Checking headphones...");
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((device) => device.kind === "audioinput");
        const externalDevices = devices.filter(
            (device) =>
                device.label.toLowerCase().includes("headphone") ||
                device.label.toLowerCase().includes("earbud") ||
                device.label.toLowerCase().includes("usb") ||
                device.label.toLowerCase().includes("external") ||
                device.label.toLowerCase().includes("airpods") ||
                device.groupId !== audioInputs[0]?.groupId
        );

        if (externalDevices.length > 0) {
            console.log("Headphones detected:", externalDevices);
            // Start analyzing audio after calibration
            isAnalyzingRef.current = true;
            analyzeAudio();
            if (onHeadphonesDetected) onHeadphonesDetected();
        } else {
            console.log("No external devices detected.");
        }
    };

    const calibrateNoiseFloor = () => {
        const analyser = analyserRef.current;
        if (!analyser) {
            console.error("Analyzer is not initialized.");
            return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let totalEnergy = 0;
        const samples = 500; // Number of calibration samples
        let validSamples = 0;

        for (let i = 0; i < samples; i++) {
            analyser.getByteFrequencyData(dataArray);

            const sampleEnergy = dataArray.reduce((sum, value) => sum + value, 0);
            if (sampleEnergy > 0) {
                validSamples++;
                totalEnergy += sampleEnergy;
            }

            console.log(`Calibration Sample ${i + 1}: Energy = ${sampleEnergy}`);
        }

        if (validSamples === 0) {
            console.error("No valid audio samples detected during calibration.");
            detectHeadphones(); // Attempt to detect headphones
            noiseThresholdRef.current = 0; // Fallback
            return;
        }

        // Set threshold slightly above average noise
        noiseThresholdRef.current = (totalEnergy / validSamples) * 1.2; // Adjust multiplier as needed
        console.log("Calibrated noise threshold:", noiseThresholdRef.current);

        // Start analyzing audio after calibration
        console.log("Starting audio analysis...");
        isAnalyzingRef.current = true;
        analyzeAudio();
    };

    const analyzeAudio = () => {
        const analyser = analyserRef.current;
        if (!analyser || isMuted || !isAnalyzingRef.current) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const energy = dataArray.reduce((sum, value) => sum + value, 0);

        console.log(energy, '>', noiseThresholdRef.current, speakingRef.current)
        if (energy > noiseThresholdRef.current) {
            if (!speakingRef.current) {
                speakingRef.current = true;
                console.log("User speech detected. Energy:", energy);
                const audioDataBuffer = dataArray; // Replace with actual audio buffer
                const audioBlob = new Blob([audioDataBuffer], { type: "audio/wav" });

                if (onUserSpeechDetected) {
                    onUserSpeechDetected(audioBlob); // Call the async handler
                }
            }
        } else {
            speakingRef.current = false; // Reset when below threshold
        }

        if (isAnalyzingRef.current) {
            requestAnimationFrame(analyzeAudio); // Continuously analyze audio
        }
    };

    return null; // This component doesn't render anything
};

export default AudioAnalyzer;

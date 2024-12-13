import React, { useState, useRef } from "react";
import AudioAnalyzer from "./src/AudioAnalyser";
import { fetchTTSAudio, sendAudioToSTT } from "./src/GoogleAPIs";

const App = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechApiKey = "AIzaSyB8_hZZdNhcH2A1KYt2EsdVT41sjteeX8A";

  const handleStartListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack || audioTrack.readyState !== "live" || audioTrack.muted) {
        console.error("Audio track is not ready. Delaying setup...");
        return;
      }

      console.log("MediaStream is ready. Passing to AudioAnalyzer...");
      handlePlayTTS();
      setMediaStream(stream);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const handleStopListening = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
  };

  const handleUserSpeechDetected = async (audioBlob: Blob) => {
    console.log("Audio Blob Info:", {
      size: audioBlob.size,
      type: audioBlob.type,
    });
  
    // Confirm that audioBlob contains data
    if (audioBlob.size === 0) {
      console.error("Audio blob is empty!");
      return;
    }
  
    console.log("User speech detected! Sending to STT API...");
    const transcript = await sendAudioToSTT(audioBlob, speechApiKey);
    if (transcript) {
      console.log("Transcript received:", transcript);
      setFinalTranscript(transcript);
    } else {
      console.error("No transcript received.");
    }
  };
  

  const handleHeadphonesDetected = () => {
    console.log("Headphones detected");
  };

  const interruptTTS = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      console.log("TTS playback paused.");
    }
  };

  const handlePlayTTS = async () => {
    const text = "This is a sample TTS audio.";
    const ttsAudioBlob = await fetchTTSAudio(text, speechApiKey);
    if (ttsAudioBlob) {
      const audioURL = URL.createObjectURL(ttsAudioBlob);
      audioRef.current = new Audio(audioURL);
      audioRef.current.play();
      console.log("TTS playback started.");
    }
  };

  return (
    <div style={styles.container}>
      {!mediaStream && (
        <button style={styles.button} onClick={handleStartListening}>
          Start Listening
        </button>
      )}
      {mediaStream && (
        <button style={styles.button} onClick={handleStopListening}>
          Stop Listening
        </button>
      )}
      <button style={styles.button} onClick={() => setIsMuted(!isMuted)}>
        {isMuted ? "Unmute" : "Mute"}
      </button>
      <button style={styles.button} onClick={handlePlayTTS}>
        Play TTS
      </button>
      <AudioAnalyzer
    stream={mediaStream}
    isMuted={isMuted}
    onUserSpeechDetected={handleUserSpeechDetected} // This can now be async
    onHeadphonesDetected={handleHeadphonesDetected}
/>

      <p style={styles.text}>Transcript: {finalTranscript}</p>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    backgroundColor: "#f5f5f5",
  },
  button: {
    backgroundColor: "#007BFF",
    color: "white",
    border: "none",
    padding: "10px 20px",
    margin: "10px",
    borderRadius: "5px",
    cursor: "pointer",
  },
  text: {
    fontSize: "16px",
    color: "black",
    marginTop: "20px",
  },
};

export default App;

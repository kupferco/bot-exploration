import React, { useState, useEffect, useRef } from 'react';
import { View, Button, StyleSheet, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Dropdown for voice options

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [isPlaying, setIsPlaying] = useState(false); // Track if audio is playing
  const [isLoading, setIsLoading] = useState(false); // Track if playback request is in progress
  const audioRef = useRef<HTMLAudioElement | null>(null); // Reference for audio playback
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const apiKey = 'AIzaSyB8_hZZdNhcH2A1KYt2EsdVT41sjteeX8A'; // Your API Key

  useEffect(() => {
    // Fetch available voices from Google TTS API
    const fetchVoices = async () => {
      try {
        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`
        );
        const data = await response.json();
        if (data.voices) {
          // Filter voices to include only English-speaking ones
          const englishVoices = data.voices.filter((voice) =>
            voice.languageCodes.some((lang) => lang.startsWith('en'))
          );
          setVoices(englishVoices);
          setSelectedVoice(englishVoices[0]?.name || ''); // Set default voice to the first English voice

        }
      } catch (error) {
        console.error('Error fetching voices:', error);
      }
    };

    fetchVoices();
  }, []);

  useEffect(() => {
    // Initialize SpeechRecognition
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech Recognition is not supported in this browser.');
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          setFinalTranscript((prev) => prev + event.results[i][0].transcript + ' ');
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onerror = (event) => {
      console.error('Speech Recognition Error:', event.error);
      if (['no-speech', 'audio-capture', 'not-allowed'].includes(event.error)) {
        recognition.stop();
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    // Cleanup on unmount
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleStartListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handlePlayStop = async () => {
    if (isPlaying) {
      // Stop playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Reset audio to the beginning
      }
      setIsPlaying(false);
      return;
    }

    if (isLoading) {
      // Prevent multiple simultaneous playback requests
      console.warn('Playback is already in progress.');
      return;
    }

    if (!finalTranscript.trim()) {
      alert('No text available to speak!');
      return;
    }

    try {
      setIsLoading(true); // Indicate playback request is in progress

      const selectedVoiceData = voices.find((voice) => voice.name === selectedVoice);
      console.log(voices)
      console.log(selectedVoice)
      console.log(selectedVoiceData)


      if (!selectedVoiceData) {
        alert('Selected voice is invalid!');
        console.error('Invalid selected voice:', selectedVoice);
        return;
      }

      const payload = {
        input: { text: finalTranscript },
        voice: {
          name: selectedVoice,
          languageCode: selectedVoiceData.languageCodes[0], // Use the correct language code
        },
        audioConfig: { audioEncoding: 'MP3' },
      };

      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (data.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audioRef.current = audio; // Save the audio element reference
        setIsPlaying(true); // Set playing state

        audio.play();

        // Automatically reset playing state when audio ends
        audio.onended = () => {
          setIsPlaying(false);
        };
      } else {
        console.error('Error: No audioContent received from API');
        console.error('Response:', data);
      }
    } catch (error) {
      console.error('Error with Google TTS API:', error);
    } finally {
      setIsLoading(false); // Reset loading state
    }
  };

  return (
    <View style={styles.container}>
      <Button
        title={isListening ? 'Stop Listening' : 'Start Listening'}
        onPress={isListening ? handleStopListening : handleStartListening}
      />
      <Text style={styles.text}>
        <Text style={styles.boldText}>Microphone is: </Text>
        {isListening ? 'ON' : 'OFF'}
      </Text>
      <Text style={styles.text}>
        <Text style={styles.boldText}>Interim Transcript: </Text>
        {interimTranscript}
      </Text>
      <Text style={styles.text}>
        <Text style={styles.boldText}>Final Transcript: </Text>
        {finalTranscript}
      </Text>
      {voices.length > 0 && (
        <Picker
          selectedValue={selectedVoice}
          onValueChange={(itemValue) => setSelectedVoice(itemValue)}
          style={styles.picker}
        >
          {voices.map((voice) => (
            <Picker.Item
              key={voice.name}
              label={`${voice.name} (${voice.languageCodes.join(', ')})`}
              value={voice.name}
            />
          ))}
        </Picker>
      )}
      <Button
        title={isPlaying ? 'Stop' : isLoading ? 'Loading...' : 'Play with Google TTS'}
        onPress={handlePlayStop}
        disabled={isLoading} // Disable button while loading
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5fcff',
    padding: 20,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: 'black',
    textAlign: 'center',
  },
  boldText: {
    fontWeight: 'bold',
  },
  picker: {
    width: '80%',
    marginVertical: 20,
  },
});

export default App;

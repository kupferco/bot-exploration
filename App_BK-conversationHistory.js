import React, { useState, useEffect, useRef } from 'react';
import { View, Button, StyleSheet, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';

type Voice = {
  name: string;
  languageCodes: string[]; // Array of language codes, e.g., ['en-US', 'en-GB']
  gender?: string;  // Optional gender
};

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(''); // Set initial value of selectedVoice
  const [isPlaying, setIsPlaying] = useState(false); // Track if audio is playing
  const [isLoading, setIsLoading] = useState(false); // Track if playback request is in progress
  const audioRef = useRef<HTMLAudioElement | null>(null); // Reference for audio playback
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const ttsApiKey = 'AIzaSyB8_hZZdNhcH2A1KYt2EsdVT41sjteeX8A'; // Google TTS API Key
  const aiApiKey = 'AIzaSyB8_hZZdNhcH2A1KYt2EsdVT41sjteeX8A'; // Generative Language API Key

  // Initialize conversation history with the initial prompt
  const [conversationHistory, setConversationHistory] = useState<{ role: string; text: string }[]>([
    { role: 'assistant', text: "You are a helpful and concise AI assistant (giving spoken answers). Your responses should be short, informative, and avoid unnecessary details. Ask one question at a time and provide actionable advice. If possible, avoid asking the user to search for information that you can provide directly. Be aware that your answers will be played out loud using text-to-speech API and therefore should not have any element, (like *, for example) that can't be read for the user or interrupt the conversation flow." }
  ]);

  useEffect(() => {
    // console.log(`conversationHistory changed!!`, conversationHistory);
  }, [conversationHistory]);


  useEffect(() => {
    // Fetch available voices from Google TTS API
    const fetchVoices = async () => {
      try {
        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/voices?key=${ttsApiKey}`
        );
        const data = await response.json();
        if (data.voices) {
          // Filter voices to include only English-speaking ones
          const englishVoices = data.voices.filter((voice: Voice) =>
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
          const finalText = event.results[i][0].transcript + ' ';
          setInterimTranscript(''); // Clear interim transcript after processing
          sendToAI(finalText); // Send to Gemini API for response
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

    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, [voices, selectedVoice, conversationHistory]);

  const handleStartListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Interrupt the TTS and restart the listening
  const interruptTTS = () => {
    setIsPlaying(false); // Stop playback
    handleStartListening(); // Start the mic when interrupting
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  // Send AI request with conversation history
  const sendToAI = async (userText: string) => {
    try {
      setIsLoading(true);
      setFinalTranscript('AI Response...'); // Temporarily display loading message
      handleStopListening();

      // Add the new user message to the conversation history
      const updatedConversation = [
        ...conversationHistory,
        { role: 'user', text: userText }
      ];

      setConversationHistory((prevHistory) => [
        ...prevHistory,
        { role: 'user', text: userText }  // Returning the updated history
      ]);

      // Prepare the conversation history to be sent to Gemini
      const conversationString = updatedConversation.map(entry => `${entry.role}: ${entry.text}`).join('\n');

      const payload = {
        contents: [
          {
            parts: [
              {
                text: conversationString
              }
            ]
          }
        ]
      };

      console.log(`conversationHistory just before stringify!!`, conversationHistory);
      console.log(`SENDING TO AI ====\n`, JSON.stringify(payload).replace(/\\n/g, '\n'));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
        const aiResponse = data.candidates[0].content.parts[0].text;

        // Add the AI response to the conversation history
        setConversationHistory((prevHistory) => [
          ...prevHistory,
          { role: 'assistant', text: aiResponse }  // Returning the updated history
        ]);

        setFinalTranscript(aiResponse); // Update final transcript with AI response
        playTTS(aiResponse); // Automatically play AI response
      } else {
        setFinalTranscript('Error: No AI response received');
        console.error('Error: No AI response received');
      }
    } catch (error) {
      setFinalTranscript('Error: Unable to connect to AI');
      console.error('Error with Generative Language API:', error);
    } finally {
      setIsLoading(false);
    }
  };



  const playTTS = async (text: string) => {
    try {
      const selectedVoiceData = voices.find((voice) => voice.name === selectedVoice);

      if (!selectedVoiceData) {
        alert('Selected voice is invalid!');
        console.error('Invalid selected voice:', selectedVoice);
        return;
      }

      const languageCode = selectedVoiceData.languageCodes[0];

      const payload = {
        input: { text },
        voice: {
          name: selectedVoice,
          languageCode: languageCode,
        },
        audioConfig: { audioEncoding: 'MP3' },
      };

      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsApiKey}`,
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

        // Automatically reset playing state and restore microphone when audio ends
        audio.onended = () => {
          setIsPlaying(false);
          handleStartListening(); // Restore microphone
        };
      } else {
        console.error('Error: No audioContent received from TTS API');
        console.error('Response:', data);
      }
    } catch (error) {
      console.error('Error with Google TTS API:', error);
    }
  };

  // Set button title based on current state
  const getButtonTitle = () => {
    if (isPlaying) return 'Tap to interrupt'; // If TTS is playing
    if (isLoading) return 'Loading...'; // If AI is being loaded
    if (isListening) return 'Listening...'; // If mic is on
    return 'Tap to start'; // Default
  };

  return (
    <View style={styles.container}>
      <Button
        title={getButtonTitle()}
        onPress={isPlaying ? interruptTTS : isLoading ? () => { } : handleStartListening} // Disable during loading
        disabled={isLoading || isListening} // Disable button when loading
      />
      <Text style={styles.text}>
        <Text style={styles.boldText}>Microphone is: </Text>
        {isListening ? 'ON' : 'OFF'}
      </Text>
      <Text style={styles.text}>
        <Text style={styles.boldText}>User said: </Text>
        {interimTranscript}
      </Text>
      <Text style={styles.text}>
        <Text style={styles.boldText}>Gemini response: </Text>
        {finalTranscript}
      </Text>
      {voices.length > 0 && (
        <Picker
          selectedValue={selectedVoice}
          onValueChange={(itemValue) => setSelectedVoice(itemValue)} // Update selectedVoice based on Picker selection
          style={styles.picker}
        >
          {voices.map((voice) => (
            <Picker.Item
              key={voice.name}
              label={`${voice.name} (${voice.languageCodes.join(', ')})`}
              value={voice.name} // Set the value of the Picker Item to the voice name
            />
          ))}
        </Picker>
      )}
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

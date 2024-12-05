import React, { useState, useEffect, useRef } from 'react';
import { View, Button, StyleSheet, Text, TextInput, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { instruction_prompt } from './src/data/instruction_prompt'; // This can be your default prompt

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
  const [instructionText, setInstructionText] = useState<string>(instruction_prompt);
  const [modalVisible, setModalVisible] = useState(false); // Control modal visibility
  const [queryCount, setQueryCount] = useState<number>(0); // Control modal visibility
  const audioRef = useRef<HTMLAudioElement | null>(null); // Reference for audio playback
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const ttsApiKey = 'AIzaSyB8_hZZdNhcH2A1KYt2EsdVT41sjteeX8A'; // Google TTS API Key
  const aiApiKey = 'AIzaSyB8_hZZdNhcH2A1KYt2EsdVT41sjteeX8A'; // Generative Language API Key

  // Initialize conversation history with the initial prompt
  const [conversationHistory, setConversationHistory] = useState<{ role: string; text: string }[]>([
    { role: 'assistant', text: instructionText }
  ]);

  useEffect(() => {
    // console.log(`conversationHistory changed!!`, conversationHistory);
  }, [conversationHistory]);

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/voices?key=${ttsApiKey}`
        );
        const data = await response.json();
        if (data.voices) {
          const englishVoices = data.voices.filter((voice: Voice) =>
            voice.languageCodes.some((lang) => lang.startsWith('en'))
          );
          setVoices(englishVoices);
          setSelectedVoice(englishVoices[0]?.name || '');
        }
      } catch (error) {
        console.error('Error fetching voices:', error);
      }
    };
    fetchVoices();
  }, []);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech Recognition is not supported in this browser.');
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    // console.log(33, isLoading)
    recognition.onresult = (event) => {
      // console.log(44, isLoading)
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const finalText = event.results[i][0].transcript + ' ';
          // console.log(55, isLoading)
          setInterimTranscript('');
          if (!isLoading) {
            sendToAI(finalText);
          }
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
  }, [voices, selectedVoice, conversationHistory, queryCount, isLoading]);

  const handleStartListening = () => {
    console.log('START MIC');
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleStopListening = () => {
    console.log('STOP MIC');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Interrupt the TTS and restart the listening
  const interruptTTS = () => {
    setIsPlaying(false);
    handleStartListening();
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const sendToAI = async (userText: string) => {
    try {
      setIsLoading(true);
      setFinalTranscript('AI Response...');
      handleStopListening();

      const updatedConversation = [
        ...conversationHistory,
        { role: 'user', text: userText }
      ];

      setConversationHistory((prevHistory) => [
        ...prevHistory,
        { role: 'user', text: userText }
      ]);

      const conversationString = updatedConversation.map(entry => `${entry.role}: ${entry.text}`).join('\n');

      const payload = {
        contents: [
          {
            parts: [
              { text: conversationString }
            ]
          }
        ]
      };

      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');

      setQueryCount(prevCount => prevCount + 1);

      console.log(queryCount, `${hours}:${minutes}:${seconds}`, "SENDING TO AI ====\n");
      console.log(JSON.stringify(payload).replace(/\\n/g, '\n'));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      console.log(data.candidates)
      if (data.candidates && data.candidates.length > 0) {
        const aiResponse = data.candidates[0].content.parts[0].text;

        setConversationHistory((prevHistory) => [
          ...prevHistory,
          { role: 'assistant', text: aiResponse }
        ]);

        setFinalTranscript(aiResponse);
        playTTS(aiResponse);
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
          name: 'en-GB-neural2-B',
          languageCode: 'en-GB'
          // name: selectedVoice,
          // languageCode: languageCode
        },
        audioConfig: { audioEncoding: 'MP3' }
      };

      console.log('PLAY!!', text);
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (data.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audioRef.current = audio;
        setIsPlaying(true);

        audio.play();

        audio.onended = () => {
          setIsPlaying(false);
          handleStartListening();
        };
      } else {
        console.error('Error: No audioContent received from TTS API');
        console.error('Response:', data);
      }
    } catch (error) {
      console.error('Error with Google TTS API:', error);
    }
  };

  // Function to open modal
  const openModal = () => {
    setModalVisible(true);
  };

  // Function to close modal
  const closeModal = () => {
    setModalVisible(false);
  };

  const handleInstructionChange = (text: string) => {
    setInstructionText(text); // Update the instruction text
  };

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
        onPress={isPlaying ? interruptTTS : isLoading ? () => { } : handleStartListening}
        disabled={isLoading || isListening}
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

      {/* Picker for voice selection */}
      {voices.length > 0 && false && (
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

      {/* Button to open the modal */}
      <Button title="Edit Instruction Prompt" onPress={openModal} />

      {/* Modal for editing the instruction prompt */}
      <Modal
        visible={modalVisible}
        onRequestClose={closeModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Edit Instruction Prompt"
            value={instructionText}
            onChangeText={handleInstructionChange}
            multiline // Enables multiple lines and wrapping
            numberOfLines={10} // Adjust the number of visible lines as needed
          />
          <Button title="Save" onPress={() => {
            setConversationHistory([{ role: 'assistant', text: instructionText }]);
            closeModal();
          }} />
          <Button title="Cancel" onPress={closeModal} />
        </View>
      </Modal>
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  textInput: {
    width: '80%',
    height: '80%',
    padding: 10,
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 5,
    overflow: 'scroll', // Add scrollbars when content overflows
  },
  button: {
    color: 'ff00ff',
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

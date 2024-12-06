import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, View, Button, StyleSheet, Text, TextInput, Modal, ImageBackground } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { instruction_prompt } from './src/data/instruction_prompt'; // This can be your default prompt

type Voice = {
  name: string;
  languageCodes: string[]; // Array of language codes, e.g., ['en-US', 'en-GB']
  gender?: string;  // Optional gender
};

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
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
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
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
          setInterimTranscript('');
          if (!isLoading && !isMutedRef.current) {
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
        // recognition.stop();
        // setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      console.log('RETURN')
      //   recognitionRef.current?.stop();
      //   recognitionRef.current = null;
    };
  }, [voices, selectedVoice, conversationHistory, queryCount, isLoading]);

  const handleStartListening = () => {
    console.log('START MIC');
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      setIsMuted(false)
      recognitionRef.current.start();
    }
  };

  const handleStopListening = () => {
    console.log('STOP MIC');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleMuteListening = () => {
    console.log('MUTE MIC');
    setIsListening(false);
    setIsMuted(true);
  };

  const handleUnMuteListening = () => {
    setTimeout(() => {
      console.log('UNMUTE MIC');
      setIsListening(true);
      setIsMuted(false);
    }, 2000);
  };

  // Interrupt the TTS and restart the listening
  const interruptTTS = () => {
    setIsPlaying(false);
    handleUnMuteListening();
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const sendToAI = async (userText: string) => {
    try {
      setIsLoading(true);
      setFinalTranscript('AI Response...');
      // handleStopListening();
      handleMuteListening();

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
          handleUnMuteListening();
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

      {/* <ImageBackground
        source={require('./assets/iphone.svg')}
        style={styles.background}
        resizeMode="contain" // Resize the image to fit within the view
      /> */}
      {/* Main Button */}
      <TouchableOpacity
        style={[
          styles.mainButton,
          (isListening || isLoading) && styles.disabledButton, // Apply the disabled style if the button is disabled
        ]}
        onPress={isPlaying ? interruptTTS : isLoading ? () => { } : handleStartListening}
        disabled={isLoading || isListening}
      >
        <Text style={styles.buttonText}>{getButtonTitle()}</Text>
      </TouchableOpacity>
      {/* <TouchableOpacity
        style={[
          styles.mainButton,
          (isMuted && false) && styles.disabledButton, // Apply the disabled style if the button is disabled
        ]}
        onPress={isMuted ? handleUnMuteListening : handleMuteListening}
      // disabled={!isMuted}
      >
        <Text style={styles.buttonText}>{isMuted ? "Mic is muted" : "Mic is open"}</Text>
      </TouchableOpacity> */}

      {/* Fixed Position Text Elements */}
      <View style={styles.fixedContainer}>
        {/* <Text style={styles.text}>
          <Text style={styles.boldText}>User said: </Text>
          {interimTranscript}
        </Text> */}
        <Text style={styles.text}>
          <Text style={styles.boldText}>Gemini response: </Text>
          {finalTranscript}
        </Text>
      </View>

      {/* Button to open modal */}
      <TouchableOpacity style={styles.editButton} onPress={openModal}>
        <Text style={styles.buttonText}>Edit Instruction Prompt</Text>
      </TouchableOpacity>

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
            multiline
            numberOfLines={10}
          />
          <TouchableOpacity
            style={styles.customButton}
            onPress={() => {
              setConversationHistory([{ role: 'assistant', text: instructionText }]);
              closeModal();
            }}
          >
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.customButton} onPress={closeModal}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );

};

const styles = StyleSheet.create({
  background: {
    flex: 1, // Fill the entire screen
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
  },
  container: {
    flex: 1,
    justifyContent: 'space-between', // Space elements evenly
    alignItems: 'center',
    backgroundColor: '#f5fcff',
    padding: 20,
  },
  fixedContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center', // Center items vertically
    flex: 1, // Take up remaining vertical space
  },
  text: {
    width: '90%', // Fixed width for consistency
    fontSize: 16,
    color: 'black',
    textAlign: 'center', // Align text to the left
    // height: 50, // Fixed height to prevent shifting
    lineHeight: 20, // Adjust for readability
    overflow: 'hidden', // Prevent overflowing content
    marginTop: 50,
  },
  boldText: {
    fontWeight: 'bold',
  },
  mainButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 80,
  },
  customButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
  },
  disabledButton: {
    backgroundColor: '#A9A9A9',
  },
  editButton: {
    paddingHorizontal: 20,
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{ translateX: -120 }],
    width: 240,
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(100,100,100,0.95)',
  },
  textInput: {
    width: '80%',
    height: '80%',
    padding: 10,
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 5,
  },
});

export default App;



import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse, LiveSession, Modality, Type, LiveServerMessage, GroundingChunk, VideosOperation, GenerateContentCandidate, WebChunk, VideoGenerationReferenceImage, VideoGenerationReferenceType } from "@google/genai";
import { Tool, ChatMessage, AspectRatio, VideoAspectRatio, Contact, ContactList, Campaign } from './types';
import { TOOLS } from './constants';
import { disposableDomains, roleBasedEmails } from './data/disposable-domains';
import { fileToBase64, decode, encode, decodeAudioData, createAudioBlob } from './utils/helpers';

// --- Reusable UI Components ---

const Spinner: React.FC<{message?: string}> = ({ message }) => (
  <div className="flex flex-col justify-center items-center gap-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
    {message && <p className="text-purple-300">{message}</p>}
  </div>
);

interface FileUploaderProps {
  onFileSelect?: (file: File) => void;
  onFilesSelect?: (files: FileList) => void;
  accept: string;
  label: string;
  multiple?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, onFilesSelect, accept, label, multiple = false }) => {
  const [displayText, setDisplayText] = useState<string>(label);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      // Only reset if the label prop changes and the input is not holding a file value
      if (fileInputRef.current && !fileInputRef.current.value) {
          setDisplayText(label);
      }
  }, [label]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      if (multiple && onFilesSelect) {
        onFilesSelect(files);
        setDisplayText(`${files.length} file(s) selected`);
      } else if (!multiple && onFileSelect && files[0]) {
        onFileSelect(files[0]);
        setDisplayText(files[0].name);
      }
    } else {
        // If user cancels file selection, reset to original label
        setDisplayText(label);
    }
     // Manually clear the input value so the same file can be selected again
     if (event.target) {
        event.target.value = '';
    }
  };

  return (
    <div className="w-full">
      <label className="w-full flex flex-col items-center px-4 py-6 bg-gray-800 rounded-lg shadow-md tracking-wide uppercase border border-dashed border-gray-600 cursor-pointer hover:bg-gray-700 hover:border-purple-400 transition">
        <svg className="w-8 h-8 text-purple-400" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4 4-4-4h3V3h2v8z" />
        </svg>
        <span className="mt-2 text-base leading-normal text-center">{displayText}</span>
        <input ref={fileInputRef} type='file' className="hidden" accept={accept} onChange={handleFileChange} multiple={multiple} />
      </label>
    </div>
  );
};

// --- Zoomable Image Component ---
const ZoomableImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left; // Mouse position relative to container
        const y = e.clientY - rect.top;

        const zoomFactor = 1.1;
        const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
        const clampedZoom = Math.max(0.5, Math.min(newZoom, 5));

        const newX = x - (x - position.x) * (clampedZoom / zoom);
        const newY = y - (y - position.y) * (clampedZoom / zoom);

        setZoom(clampedZoom);
        setPosition({ x: newX, y: newY });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setStartDrag({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        setPosition({
            x: e.clientX - startDrag.x,
            y: e.clientY - startDrag.y,
        });
    };

    const handleMouseUpOrLeave = () => {
        setIsDragging(false);
    };

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev * 1.2, 5));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev / 1.2, 0.5));
    };

    const handleReset = () => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    };

    return (
        <div className="relative w-full h-full group">
            <div
                ref={containerRef}
                className="w-full h-full rounded-lg overflow-hidden"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                <img
                    src={src}
                    alt={alt}
                    className="w-full h-full object-contain"
                    style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`, transformOrigin: '0 0', willChange: 'transform' }}
                />
            </div>
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-gray-800/70 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={handleZoomOut} className="p-1.5 hover:bg-gray-700 rounded-md" title="Zoom Out">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                </button>
                <button onClick={handleZoomIn} className="p-1.5 hover:bg-gray-700 rounded-md" title="Zoom In">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                </button>
                <button onClick={handleReset} className="p-1.5 hover:bg-gray-700 rounded-md" title="Reset View">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                </button>
            </div>
        </div>
    );
};

// --- Main Feature Components ---

// --- Chatbot Component ---
const Chatbot: React.FC = () => {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const chatInstance = ai.chats.create({ model: 'gemini-2.5-flash' });
    setChat(chatInstance);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [history]);

  const handleSend = async () => {
    if (!input.trim() || !chat || loading) return;
    setLoading(true);
    const userMessage: ChatMessage = { role: 'user', parts: [{ text: input }] };
    setHistory(prev => [...prev, userMessage]);
    setInput('');

    try {
      let fullResponseText = "";
      const result = await chat.sendMessageStream({ message: input });
      let firstChunk = true;
      for await (const chunk of result) {
          const chunkText = chunk.text;
          fullResponseText += chunkText;
          if(firstChunk){
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: fullResponseText }] }]);
            firstChunk = false;
          } else {
            setHistory(prev => {
              const newHistory = [...prev];
              newHistory[newHistory.length-1] = { role: 'model', parts: [{ text: fullResponseText }]};
              return newHistory;
            });
          }
      }
    } catch (error) {
      console.error(error);
      setHistory(prev => [...prev, { role: 'model', parts: [{ text: 'Sorry, something went wrong.' }] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded-lg p-4">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-2 space-y-4">
        {history.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-lg p-3 rounded-xl ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-700'}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.parts[0].text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-lg p-3 rounded-xl bg-gray-700">
              <Spinner />
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your message..."
          className="flex-1 p-3 bg-gray-700 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading} className="p-3 bg-purple-600 rounded-r-lg hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </button>
      </div>
    </div>
  );
};

// --- Live Conversation Component ---
const LiveConversation: React.FC = () => {
    const [isLive, setIsLive] = useState(false);
    const [transcription, setTranscription] = useState<{ user: string; model: string }[]>([]);
    const [currentInput, setCurrentInput] = useState("");
    const [currentOutput, setCurrentOutput] = useState("");
    const currentInputRef = useRef('');
    const currentOutputRef = useRef('');

    const sessionRef = useRef<LiveSession | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const [isMusicPlaying, setIsMusicPlaying] = useState(false);
    const musicAudioRef = useRef<HTMLAudioElement | null>(null);
    const MUSIC_URL = 'https://www.chosic.com/wp-content/uploads/2021/04/purrple-cat-creek.mp3';

    // This effect handles the creation and cleanup of the audio element.
    // It runs only on component mount and unmount.
    useEffect(() => {
        const audio = new Audio(MUSIC_URL);
        audio.loop = true;
        audio.volume = 0.15;
        musicAudioRef.current = audio;

        // The cleanup function is called when the component unmounts.
        return () => {
            audio.pause();
        };
    }, []); // Empty dependency array ensures it runs once.

    // This effect handles the play/pause logic based on user interaction.
    useEffect(() => {
        if (musicAudioRef.current) {
            if (isMusicPlaying) {
                musicAudioRef.current.play().catch(e => console.error("Error playing music:", e));
            } else {
                musicAudioRef.current.pause();
            }
        }
    }, [isMusicPlaying]); // Reruns whenever isMusicPlaying changes.


    const stopConversation = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        outputSourcesRef.current.forEach(source => source.stop());
        outputSourcesRef.current.clear();
        setIsLive(false);
    }, []);

    const startConversation = useCallback(async () => {
        setIsLive(true);
        setCurrentInput("");
        setCurrentOutput("");
        currentInputRef.current = "";
        currentOutputRef.current = "";
        setTranscription([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        console.log('Session opened.');
                        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const inputAudioContext = inputAudioContextRef.current!;
                        sourceRef.current = inputAudioContext.createMediaStreamSource(streamRef.current);
                        scriptProcessorRef.current = inputAudioContext.createScriptProcessor(4096, 1, 1);

                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createAudioBlob(inputData);
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        sourceRef.current.connect(scriptProcessorRef.current);
                        // The ScriptProcessorNode needs to be connected to the destination for the `onaudioprocess` event to fire.
                        // This won't cause feedback, as we are not copying the input to the output buffer.
                        scriptProcessorRef.current.connect(inputAudioContext.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            currentOutputRef.current += text;
                            setCurrentOutput(currentOutputRef.current);
                        }
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            currentInputRef.current += text;
                            setCurrentInput(currentInputRef.current);
                        }
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputRef.current;
                            const fullOutput = currentOutputRef.current;
                            if (fullInput.trim() || fullOutput.trim()) {
                                setTranscription(prev => [...prev, { user: fullInput, model: fullOutput }]);
                            }
                            currentInputRef.current = "";
                            currentOutputRef.current = "";
                            setCurrentInput("");
                            setCurrentOutput("");
                        }
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            const outputAudioContext = outputAudioContextRef.current!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContext.destination);
                            source.addEventListener('ended', () => {
                                outputSourcesRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            outputSourcesRef.current.add(source);
                        }
                        if (message.serverContent?.interrupted) {
                            outputSourcesRef.current.forEach(source => source.stop());
                            outputSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        stopConversation();
                    },
                    onclose: () => {
                        console.log('Session closed.');
                        stopConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
            });
            sessionRef.current = await sessionPromise;
        } catch (error) {
            console.error("Failed to start conversation:", error);
            setIsLive(false);
        }
    }, [stopConversation]);

    useEffect(() => {
        return () => stopConversation();
    }, [stopConversation]);
    
    return (
        <div className="h-full flex flex-col items-center justify-center p-4 bg-gray-800/50 rounded-lg space-y-4">
            <button
                onClick={isLive ? stopConversation : startConversation}
                className={`px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 flex items-center gap-3 ${
                    isLive 
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/50' 
                    : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/50'
                }`}
            >
                {isLive ? (
                    <>
                        <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path></svg>
                        Stop Conversation
                    </>
                ) : (
                    <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                        Start Conversation
                    </>
                )}
            </button>
            <button onClick={() => setIsMusicPlaying(!isMusicPlaying)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-sm">
                {isMusicPlaying ? "Stop Background Music" : "Play Background Music"}
            </button>
            {isLive && (
                <div className="w-full h-64 flex-grow bg-gray-900/50 rounded-lg p-4 overflow-y-auto space-y-3">
                    {transcription.map((t, i) => (
                        <div key={i}>
                            <p className="text-purple-300 font-semibold">You:</p>
                            <p className="text-gray-200 pl-2">{t.user || "..."}</p>
                            <p className="text-teal-300 font-semibold mt-1">Gemini:</p>
                            <p className="text-gray-200 pl-2">{t.model || "..."}</p>
                        </div>
                    ))}
                    {currentInput && (
                        <div>
                            <p className="text-purple-300 font-semibold">You:</p>
                            <p className="text-gray-200 pl-2">{currentInput}</p>
                        </div>
                    )}
                    {currentOutput && (
                        <div>
                            <p className="text-teal-300 font-semibold">Gemini:</p>
                            <p className="text-gray-200 pl-2">{currentOutput}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Image Generation Component ---
const ImageGeneration: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
    const [numberOfImages, setNumberOfImages] = useState<number>(4);
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const generateImages = async () => {
        if (!prompt) {
            setError('Please enter a prompt.');
            return;
        }
        setLoading(true);
        setError('');
        setImages([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                    numberOfImages: numberOfImages,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: aspectRatio,
                },
            });
            
            const generatedImages = response.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
            setImages(generatedImages);
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to generate images: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter a prompt, e.g., 'A vibrant coral reef with bioluminescent fish'"
                className="w-full h-24 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                 <div>
                    <label htmlFor="aspect-ratio" className="block text-sm font-medium text-gray-300 mb-1">Aspect Ratio</label>
                    <select 
                        id="aspect-ratio"
                        value={aspectRatio} 
                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3 (Standard)</option>
                        <option value="3:4">3:4 (Tall)</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="num-images" className="block text-sm font-medium text-gray-300 mb-1">Number of Images: <span className="font-bold text-purple-300">{numberOfImages}</span></label>
                    <input
                        id="num-images"
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        value={numberOfImages}
                        onChange={(e) => setNumberOfImages(Number(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                </div>
                <button onClick={generateImages} disabled={loading} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
                    {loading ? 'Generating...' : 'Generate'}
                </button>
            </div>
            {loading && <div className="flex justify-center"><Spinner message="Generating images..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((img, index) => (
                        <a href={img} download={`generated-image-${index}.jpg`} key={index}>
                           <img src={img} alt={`Generated image ${index + 1}`} className="rounded-lg hover:opacity-80 transition-opacity" />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Image Editing Component ---
const ImageEditing: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [prompt, setPrompt] = useState<string>('');
    const [editedImage, setEditedImage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleFileSelect = (file: File) => {
        setImageFile(file);
        setEditedImage('');
        setError('');
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const editImage = async () => {
        if (!imageFile || !prompt) {
            setError('Please upload an image and provide an editing instruction.');
            return;
        }
        setLoading(true);
        setError('');
        setEditedImage('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const base64Image = await fileToBase64(imageFile);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Image, mimeType: imageFile.type } },
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                setEditedImage(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
            } else {
                 // If the model replies with text, it's usually an error or refusal.
                const textResponse = response.text;
                if (textResponse) {
                     throw new Error(`Model returned a text response: ${textResponse}`);
                } else {
                     throw new Error('Model did not return an edited image.');
                }
            }
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to edit image: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                 <div className="space-y-2">
                    <label className="font-semibold">1. Upload Image</label>
                    <FileUploader onFileSelect={handleFileSelect} accept="image/*" label="Click to upload" />
                 </div>
                 <div className="space-y-2">
                    <label className="font-semibold">2. Provide Instructions</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., 'Add a birthday hat to the cat'"
                        className="w-full h-24 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                 </div>
            </div>
             <button onClick={editImage} disabled={loading || !imageFile || !prompt} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
                {loading ? 'Editing...' : '3. Edit Image'}
            </button>
            
            {/* Image Previews */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mt-6">
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-center mb-2">Original</h3>
                    {imagePreview ? (
                        <div className="w-full h-96 relative">
                            <ZoomableImage src={imagePreview} alt="Original preview" />
                        </div>
                    ) : (
                        <div className="w-full h-96 bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-600">
                            <p className="text-center">Upload an image to see it here</p>
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-center mb-2">Edited</h3>
                    <div className="w-full h-96 bg-gray-800 rounded-lg flex items-center justify-center relative border-2 border-dashed border-gray-600 p-4">
                        {loading && <Spinner message="Applying edits..." />}
                        {!loading && error && <p className="text-red-400 text-center">{error}</p>}
                        {!loading && !error && editedImage && <ZoomableImage src={editedImage} alt="Edited result" />}
                        {!loading && !error && !editedImage && <p className="text-gray-500 text-center">Your edited image will appear here</p>}
                    </div>
                    {!loading && editedImage && (
                        <a href={editedImage} download="edited-image.png" className="mt-2 w-full text-center inline-block px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                            Download Edited Image
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Nano Banana Studio Component ---
const NanoBananaStudio: React.FC = () => {
    const [history, setHistory] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);
    const [prompt, setPrompt] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const initialFile = useRef<File | null>(null);

    const dataUrlToParts = (dataUrl: string) => {
        const [meta, data] = dataUrl.split(',');
        const mimeType = meta.substring(meta.indexOf(':') + 1, meta.indexOf(';'));
        return { data, mimeType };
    };

    const handleFileSelect = (file: File) => {
        initialFile.current = file;
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setHistory([result]);
            setCurrentIndex(0);
            setError('');
        };
        reader.readAsDataURL(file);
    };

    const handleGenerate = async () => {
        if (!prompt || currentIndex < 0) {
            setError('Please provide instructions.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const currentImageUrl = history[currentIndex];
            const { data: base64Image, mimeType } = dataUrlToParts(currentImageUrl);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Image, mimeType: mimeType } },
                        { text: prompt },
                    ],
                },
                config: { responseModalities: [Modality.IMAGE] },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                const newImageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                const newHistory = history.slice(0, currentIndex + 1);
                newHistory.push(newImageUrl);
                setHistory(newHistory);
                setCurrentIndex(newHistory.length - 1);
            } else {
                 const textResponse = response.text;
                if (textResponse) {
                     throw new Error(`Model returned a text response: ${textResponse}`);
                } else {
                     throw new Error('Model did not return an image.');
                }
            }
        } catch (err) {
            console.error(err);
            setError(`Failed to edit: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };
    
    const handleReset = () => {
      if (initialFile.current) {
        handleFileSelect(initialFile.current);
      }
    };

    const presetPrompts = [
        "Remove the background, making it transparent.",
        "Turn this into a cartoon.",
        "Add cool sunglasses to the main subject.",
        "Convert this image into a pencil sketch.",
        "Make the colors more vibrant and cinematic."
    ];

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <FileUploader onFileSelect={handleFileSelect} accept="image/*" label="Upload an image to start editing" />
            </div>
        );
    }
    
    return (
        <div className="flex h-full gap-6">
            <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex <= 0 || loading} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50 hover:bg-gray-600">Undo</button>
                    <button onClick={() => setCurrentIndex(i => Math.min(history.length - 1, i + 1))} disabled={currentIndex >= history.length - 1 || loading} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50 hover:bg-gray-600">Redo</button>
                    <button onClick={handleReset} disabled={loading} className="px-4 py-2 bg-red-800 rounded-md hover:bg-red-700">Reset to Original</button>
                </div>
                <div className="flex-1 bg-gray-800 rounded-lg flex items-center justify-center p-2 relative min-h-0">
                    <ZoomableImage src={history[currentIndex]} alt={`Version ${currentIndex + 1}`} />
                    {loading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg"><Spinner message="Generating..." /></div>}
                </div>
                 {error && <p className="text-red-400 text-center">{error}</p>}
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                        {presetPrompts.map(p => (
                            <button key={p} onClick={() => setPrompt(p)} className="px-3 py-1.5 bg-gray-700 text-sm rounded-full hover:bg-purple-600 transition-colors">{p}</button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                            placeholder="Describe your edit..."
                            className="flex-1 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            disabled={loading}
                        />
                        <button onClick={handleGenerate} disabled={loading || !prompt} className="p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">Generate</button>
                    </div>
                </div>
            </div>
            <aside className="w-40 flex-shrink-0 bg-gray-800/50 rounded-lg p-2 flex flex-col">
                <h3 className="font-bold text-center mb-2 flex-shrink-0">History</h3>
                <div className="overflow-y-auto h-full space-y-2 pr-1">
                    {history.map((imgSrc, index) => (
                        <div key={index} className={`relative cursor-pointer rounded-md overflow-hidden ${index === currentIndex ? 'ring-2 ring-purple-500' : ''}`} onClick={() => !loading && setCurrentIndex(index)}>
                            <img src={imgSrc} alt={`Version ${index + 1}`} className="w-full h-auto" />
                            <div className="absolute bottom-0 left-0 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-tr-md">{index + 1}</div>
                        </div>
                    ))}
                </div>
            </aside>
        </div>
    );
};


// --- Image Background Remover Component ---
const ImageBackgroundRemover: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [resultImage, setResultImage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleFileSelect = (file: File) => {
        setImageFile(file);
        setResultImage('');
        setError('');
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveBackground = async () => {
        if (!imageFile) {
            setError('Please upload an image first.');
            return;
        }
        setLoading(true);
        setError('');
        setResultImage('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const base64Image = await fileToBase64(imageFile);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Image, mimeType: imageFile.type } },
                        { text: 'Task: Background Removal. Identify the main subject in the image. Remove the background completely, making it transparent. The output should be a PNG image containing only the subject.' },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                setResultImage(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
            } else {
                 const textResponse = response.text;
                if (textResponse) {
                     throw new Error(`Model returned a text response: ${textResponse}`);
                } else {
                     throw new Error('Model did not return an image.');
                }
            }
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to remove background: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <p className="text-gray-400">Upload an image and the AI will automatically remove the background, leaving a transparent result perfect for any project.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                 <div className="md:col-span-2">
                    <FileUploader onFileSelect={handleFileSelect} accept="image/*" label="Click to upload an image" />
                 </div>
                 <button onClick={handleRemoveBackground} disabled={loading || !imageFile} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
                    {loading ? 'Removing...' : 'Remove Background'}
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mt-6">
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-center mb-2">Original</h3>
                    {imagePreview ? (
                        <div className="w-full h-96 relative bg-gray-800 rounded-lg">
                            <ZoomableImage src={imagePreview} alt="Original preview" />
                        </div>
                    ) : (
                        <div className="w-full h-96 bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-600">
                            <p className="text-center">Upload an image to see it here</p>
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-center mb-2">Result</h3>
                    <div 
                        className="w-full h-96 rounded-lg flex items-center justify-center relative border-2 border-dashed border-gray-600 p-4"
                        style={{
                            backgroundImage: 'repeating-conic-gradient(#4b5563 0% 25%, transparent 0% 50%)',
                            backgroundSize: '20px 20px'
                        }}
                    >
                        {loading && <Spinner message="Processing image..." />}
                        {!loading && error && <p className="text-red-400 text-center">{error}</p>}
                        {!loading && !error && resultImage && <ZoomableImage src={resultImage} alt="Background removed result" />}
                        {!loading && !error && !resultImage && <p className="text-gray-500 text-center">Your result will appear here</p>}
                    </div>
                    {!loading && resultImage && (
                        <a href={resultImage} download="background-removed.png" className="mt-2 w-full text-center inline-block px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                            Download Result
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Image Animation Component ---
const ImageAnimation: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [prompt, setPrompt] = useState<string>('');
    const [outputUrl, setOutputUrl] = useState<string>('');
    const [outputType, setOutputType] = useState<'video' | 'gif'>('video');
    const [selectedFormat, setSelectedFormat] = useState<'video' | 'gif'>('video');
    const [loading, setLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [apiKeySelected, setApiKeySelected] = useState<boolean>(true); // Assume true initially

    const checkApiKey = useCallback(async () => {
        if (window.aistudio?.hasSelectedApiKey) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
            return hasKey;
        }
        // If the aistudio object is not available, assume we can proceed
        return true;
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    const handleSelectKey = async () => {
        if (window.aistudio?.openSelectKey) {
            await window.aistudio.openSelectKey();
            // Assume key selection is successful and let the user retry
            setApiKeySelected(true);
        }
    };
    
    const animateImage = async () => {
        if (!imageFile) {
            setError('Please upload an image first.');
            return;
        }

        setLoading(true);
        setError('');
        setOutputUrl('');
        
        if (selectedFormat === 'video') {
            const hasKey = await checkApiKey();
            if (!hasKey) {
                setLoading(false);
                return; // Stop execution if key is not selected
            }
            setLoadingMessage("Initializing video generation... This may take a few minutes.");

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const base64Image = await fileToBase64(imageFile);
                let operation: VideosOperation = await ai.models.generateVideos({
                    model: 'veo-3.1-fast-generate-preview',
                    prompt: prompt || 'Animate this image subtly.',
                    image: { imageBytes: base64Image, mimeType: imageFile.type },
                    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
                });

                setLoadingMessage("Processing video... Your animation is being created.");
                while (!operation.done) {
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    operation = await ai.operations.getVideosOperation({ operation: operation });
                }

                const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (downloadLink) {
                    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                    const blob = await response.blob();
                    setOutputUrl(URL.createObjectURL(blob));
                    setOutputType('video');
                } else {
                    throw new Error('Video generation finished but no download link was provided.');
                }
            } catch (err) {
                console.error(err);
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                if (errorMessage.includes("Requested entity was not found")) {
                    setError("API Key error. Please select a valid API key and try again.");
                    setApiKeySelected(false);
                } else {
                    setError(`Failed to generate video: ${errorMessage}`);
                }
            } finally {
                setLoading(false);
                setLoadingMessage('');
            }
        } else { // GIF generation
            setLoadingMessage("Generating animated GIF...");
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const base64Image = await fileToBase64(imageFile);
                
                const response = await ai.models.generateContent({
                  model: 'gemini-2.5-flash-image',
                  contents: {
                    parts: [
                      { inlineData: { data: base64Image, mimeType: imageFile.type } },
                      { text: prompt || 'Turn this image into a short, looping animated GIF.' },
                    ],
                  },
                  config: {
                      responseModalities: [Modality.IMAGE],
                  },
                });

                const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                if (imagePart?.inlineData && imagePart.inlineData.mimeType.startsWith('image/')) {
                    setOutputUrl(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
                    setOutputType('gif');
                } else {
                    throw new Error('Model did not return a valid animated image.');
                }
            } catch (err) {
                console.error(err);
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                setError(`Failed to generate GIF: ${errorMessage}`);
            } finally {
                setLoading(false);
                setLoadingMessage('');
            }
        }
    };
    
    return (
        <div className="space-y-6">
            <FileUploader 
                onFileSelect={(file) => {
                    setImageFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => setImagePreview(reader.result as string);
                    reader.readAsDataURL(file);
                }} 
                accept="image/*" 
                label="Upload an image to animate"
            />
            {imagePreview && <img src={imagePreview} alt="Preview" className="rounded-lg max-w-sm mx-auto" />}
            
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Animation prompt (optional), e.g., 'Make the clouds move'"
                className="w-full h-20 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
             <div className="flex items-center justify-center space-x-4">
                <span className="text-lg font-semibold">Output Format:</span>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="format" value="video" checked={selectedFormat === 'video'} onChange={() => setSelectedFormat('video')} className="form-radio h-5 w-5 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500"/>
                    <span>Video</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" name="format" value="gif" checked={selectedFormat === 'gif'} onChange={() => setSelectedFormat('gif')} className="form-radio h-5 w-5 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500"/>
                    <span>GIF</span>
                </label>
            </div>

            {!apiKeySelected && selectedFormat === 'video' ? (
                <div className="text-center p-4 bg-yellow-900/50 rounded-lg">
                    <p className="mb-2 text-yellow-300">An API key is required for video generation.</p>
                    <button onClick={handleSelectKey} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold">
                        Select API Key
                    </button>
                    <p className="text-xs mt-2 text-gray-400">For more information, see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">billing documentation</a>.</p>
                </div>
            ) : (
                <button onClick={animateImage} disabled={loading || !imageFile} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
                    {loading ? 'Animating...' : 'Animate Image'}
                </button>
            )}

            {loading && <div className="flex justify-center"><Spinner message={loadingMessage} /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            
            {outputUrl && (
                <div className="text-center">
                    <h3 className="text-xl font-bold mb-2">Animated Result</h3>
                    {outputType === 'video' ? (
                        <video src={outputUrl} controls autoPlay loop className="rounded-lg mx-auto max-w-full" />
                    ) : (
                        <img src={outputUrl} alt="Animated GIF result" className="rounded-lg mx-auto max-w-full" />
                    )}
                     <a href={outputUrl} download={`animated-result.${outputType}`} className="mt-4 inline-block px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                        Download Result
                    </a>
                </div>
            )}
        </div>
    );
};

// --- Image Understanding Component ---
const ImageUnderstanding: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [prompt, setPrompt] = useState<string>('Describe this image in detail.');
    const [response, setResponse] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleFileSelect = (file: File) => {
        setImageFile(file);
        setResponse('');
        setError('');
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const understandImage = async () => {
        if (!imageFile) {
            setError('Please upload an image to analyze.');
            return;
        }
        setLoading(true);
        setError('');
        setResponse('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const base64Image = await fileToBase64(imageFile);
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [
                    { inlineData: { data: base64Image, mimeType: imageFile.type } },
                    { text: prompt }
                ]}
            });
            setResponse(result.text);
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed to understand image: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <FileUploader onFileSelect={handleFileSelect} accept="image/*" label="Upload an image to analyze" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {imagePreview && <img src={imagePreview} alt="Preview" className="rounded-lg max-w-full h-auto" />}
                <div className="space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ask a question about the image..."
                        className="w-full h-24 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button onClick={understandImage} disabled={loading || !imageFile} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
                        {loading ? 'Analyzing...' : 'Analyze Image'}
                    </button>
                </div>
            </div>

            {loading && <div className="flex justify-center pt-4"><Spinner message="Thinking..." /></div>}
            {error && <p className="text-red-400 text-center mt-4">{error}</p>}
            {response && (
                <div className="mt-6 p-4 bg-gray-800 rounded-lg">
                    <h3 className="text-xl font-bold mb-2">Analysis Result</h3>
                    <p className="text-gray-300 whitespace-pre-wrap">{response}</p>
                </div>
            )}
        </div>
    );
};

// --- YouTube Thumbnail Component ---
const YouTubeThumbnail: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [title, setTitle] = useState<string>('');
    const [subtitle, setSubtitle] = useState<string>('');
    const [textStyle, setTextStyle] = useState<string>('Bold & Punchy');
    const [textColor, setTextColor] = useState<string>('High Contrast (Bright Yellow/White)');
    const [generatedThumbnail, setGeneratedThumbnail] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    
    const textStyleOptions = ['Bold & Punchy', 'Elegant & Clean', 'Modern & Minimalist', 'Fun & Playful', 'Horror & Gritty'];

    const handleFileSelect = (file: File) => {
        setImageFile(file);
        setGeneratedThumbnail('');
        setError('');
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const generateThumbnail = async () => {
        if (!imageFile || !title) {
            setError('Please upload a background image and provide a title.');
            return;
        }
        setLoading(true);
        setError('');
        setGeneratedThumbnail('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const base64Image = await fileToBase64(imageFile);

            const prompt = `
                Act as an expert graphic designer specializing in high-click-through-rate YouTube thumbnails. Your task is to transform the provided user image into a professional thumbnail.

                **Follow these steps precisely:**
                1.  **Isolate the Subject:** Identify the main subject (e.g., person, object) in the uploaded image and perfectly cut it out from its original background.
                2.  **Generate a New Background:** Create a completely new, visually stunning background that is thematically relevant to the video's title: "${title}". The background should be dynamic, eye-catching, and make the subject pop. Avoid cluttered or distracting backgrounds. Think bold gradients, abstract lighting, or clean, graphic environments.
                3.  **Composite the Image:** Place the isolated subject seamlessly onto the newly generated background. Ensure the lighting on the subject matches the new environment.
                4.  **Add Text:**
                    - **Main Title**: "${title}"
                    ${subtitle ? `- **Subtitle (smaller)**: "${subtitle}"` : ''}
                    - **Text Style**: Apply a ${textStyle} style to all text.
                    - **Text Color**: Use ${textColor} for the text. Add a strong outline or drop shadow to ensure it is perfectly readable against any background.
                
                **Final Output Requirements**:
                - The final image MUST be in a 16:9 widescreen aspect ratio.
                - The composition must be professional, with a clear focal point.
                - Text must be large, bold, and instantly readable.
                - The overall aesthetic should be vibrant and designed to grab a viewer's attention immediately.
            `;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Image, mimeType: imageFile.type } },
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                setGeneratedThumbnail(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
            } else {
                const textResponse = response.text;
                if (textResponse) {
                     throw new Error(`Model returned a text response: ${textResponse}`);
                } else {
                     throw new Error('Model did not return a thumbnail image.');
                }
            }
        } catch (err) {
            console.error(err);
            setError(`Failed to generate thumbnail: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <p className="text-gray-400">Creates professional 16:9 thumbnails by automatically replacing the background with an AI-generated, eye-catching design and adding custom text.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left Column: Inputs */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-300">1. Upload Subject Image</h3>
                    <FileUploader onFileSelect={handleFileSelect} accept="image/*" label="Click to upload main subject" />
                    
                    <h3 className="text-lg font-semibold text-gray-300 pt-2">2. Customize Text</h3>
                     <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Main Title (e.g., 'My Craziest Adventure!')"
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                     <input
                        type="text"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="Subtitle (optional, e.g., 'You Won't Believe This')"
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                        value={textStyle}
                        onChange={(e) => setTextStyle(e.target.value)}
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        {textStyleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                     <input
                        type="text"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        placeholder="Text Color (e.g., 'Bright Yellow with Black Outline')"
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button onClick={generateThumbnail} disabled={loading || !imageFile || !title} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
                       {loading ? 'Generating...' : '3. Generate Thumbnail'}
                    </button>
                </div>

                {/* Right Column: Previews */}
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-center text-gray-300">Original Subject</h3>
                        <div className="w-full aspect-video bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 border border-dashed border-gray-600">
                            {imagePreview ? <img src={imagePreview} alt="Original preview" className="max-w-full max-h-full" /> : <p>Original appears here</p>}
                        </div>
                    </div>
                     <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-center text-gray-300">Generated Thumbnail</h3>
                        <div className="w-full aspect-video bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 border border-dashed border-gray-600">
                             {loading && <Spinner />}
                             {!loading && error && <p className="text-red-400 p-2 text-center">{error}</p>}
                             {!loading && !error && generatedThumbnail && <img src={generatedThumbnail} alt="Generated thumbnail" className="max-w-full max-h-full" />}
                             {!loading && !error && !generatedThumbnail && <p>Result appears here</p>}
                        </div>
                        {!loading && generatedThumbnail && (
                             <a href={generatedThumbnail} download="youtube-thumbnail.png" className="w-full text-center inline-block px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">
                                Download Thumbnail
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Video Generation Component ---
const VideoGeneration: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
    const [videoUrl, setVideoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');
    const [apiKeySelected, setApiKeySelected] = useState(true);

    const checkApiKey = useCallback(async () => {
        if (window.aistudio?.hasSelectedApiKey) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
            return hasKey;
        }
        return true;
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    const handleSelectKey = async () => {
        if (window.aistudio?.openSelectKey) {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
        }
    };

    const handleFileSelect = (file: File) => {
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const generateVideo = async () => {
        if (!prompt && !imageFile) {
            setError('Please provide a prompt or an image.');
            return;
        }
        const hasKey = await checkApiKey();
        if (!hasKey) return;

        setLoading(true);
        setError('');
        setVideoUrl('');
        setLoadingMessage('Initializing video generation...');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const base64Image = imageFile ? await fileToBase64(imageFile) : undefined;

            let operation: VideosOperation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt,
                ...(base64Image && imageFile && { image: { imageBytes: base64Image, mimeType: imageFile.type } }),
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: aspectRatio,
                }
            });

            setLoadingMessage('Generating video... This may take a few minutes.');
            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                const blob = await response.blob();
                setVideoUrl(URL.createObjectURL(blob));
            } else {
                throw new Error('Video generation did not return a valid video URI.');
            }
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            if (errorMessage.includes("Requested entity was not found")) {
                setError("API Key error. Please select a valid API key and try again.");
                setApiKeySelected(false);
            } else {
                setError(`Failed to generate video: ${errorMessage}`);
            }
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    };

    return (
        <div className="space-y-6">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Enter a prompt for your video..." className="w-full h-24 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"/>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <FileUploader onFileSelect={handleFileSelect} accept="image/*" label="Upload a starting image (optional)" />
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Aspect Ratio</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as VideoAspectRatio)} className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait / Shorts)</option>
                    </select>
                </div>
            </div>
            {imagePreview && <img src={imagePreview} alt="Preview" className="rounded-lg max-w-sm mx-auto" />}
            
            {!apiKeySelected ? (
                <div className="text-center p-4 bg-yellow-900/50 rounded-lg">
                    <p className="mb-2 text-yellow-300">An API key is required for video generation.</p>
                    <button onClick={handleSelectKey} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold">Select API Key</button>
                    <p className="text-xs mt-2 text-gray-400">For more information, see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">billing documentation</a>.</p>
                </div>
            ) : (
                <button onClick={generateVideo} disabled={loading} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
                    {loading ? 'Generating...' : 'Generate Video'}
                </button>
            )}

            {loading && <div className="flex justify-center"><Spinner message={loadingMessage} /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            
            {videoUrl && (
                <div className="text-center">
                    <h3 className="text-xl font-bold mb-2">Generated Video</h3>
                    <video src={videoUrl} controls autoPlay loop className="rounded-lg mx-auto max-w-full" />
                    <a href={videoUrl} download="generated-video.mp4" className="mt-4 inline-block px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Download Video</a>
                </div>
            )}
        </div>
    );
};

// --- Video Understanding Component ---
const VideoUnderstanding: React.FC = () => {
    const [url, setUrl] = useState('');
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<GenerateContentCandidate | null>(null);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        if (!url || !prompt) {
             setError('Please provide a video URL and a question.');
            return;
        }
        setLoading(true);
        setError('');
        setResponse(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const fullPrompt = `Analyze the video found at this URL: ${url}. Use your search capabilities to find information, summaries, or transcripts related to this video. Based on what you find, please answer the following question: "${prompt}"`;
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: { tools: [{ googleSearch: {} }] },
            });
            setResponse(result.candidates?.[0] || null);
        } catch (err) {
            console.error(err);
            setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <p className="text-gray-400">Note: This tool uses Google Search to find information about the public video at the given URL. It does not directly process the video file.</p>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Enter a public video URL (e.g., YouTube)" className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ask a question about the video..." className="w-full h-24 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <button onClick={handleAnalyze} disabled={loading} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">
                {loading ? 'Analyzing...' : 'Analyze Video'}
            </button>
            {loading && <div className="flex justify-center pt-4"><Spinner message="Researching video..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {response && (
                <div className="p-4 bg-gray-800 rounded-lg space-y-4 animate-fade-in">
                    <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap">
                        {response.content.parts[0].text}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Video Transcription Component ---
const VideoTranscription: React.FC = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');

    const handleTranscribe = async () => {
        if (!url) {
             setError('Please provide a video URL.');
            return;
        }
        setLoading(true);
        setError('');
        setResponse('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Please find and provide a full transcript for the video located at the following URL: ${url}. If a direct transcript is unavailable, summarize the video's spoken content.`,
                config: { tools: [{ googleSearch: {} }] },
            });
            setResponse(result.text);
        } catch (err) {
            console.error(err);
            setError(`Transcription failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <p className="text-gray-400">Enter the URL of a public video (e.g., from YouTube) to search for its transcript online.</p>
            <div className="flex gap-4">
                <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Enter a public video URL" className="flex-grow p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button onClick={handleTranscribe} disabled={loading} className="p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">
                    {loading ? 'Transcribing...' : 'Get Transcript'}
                </button>
            </div>
            {loading && <div className="flex justify-center pt-4"><Spinner message="Searching for transcript..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {response && (
                <div className="p-4 bg-gray-800 rounded-lg space-y-4 animate-fade-in max-h-96 overflow-y-auto">
                     <h3 className="text-lg font-semibold text-gray-200">Transcript / Summary:</h3>
                     <pre className="text-gray-300 whitespace-pre-wrap font-sans">{response}</pre>
                </div>
            )}
        </div>
    );
};


// --- Grounded Search Component ---
const GroundedSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<GenerateContentCandidate | null>(null);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        if (!query) return;
        setLoading(true);
        setError('');
        setResponse(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: query,
                config: { tools: [{ googleSearch: {} }] },
            });
            setResponse(result.candidates?.[0] || null);
        } catch (err) {
            console.error(err);
            setError(`Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const renderGroundingChunk = (chunk: GroundingChunk, index: number) => {
        if (chunk.web) {
            return (
                 <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="block text-sm text-blue-400 hover:underline" title={chunk.web.title}>
                    [{index + 1}] {chunk.web.title || new URL(chunk.web.uri).hostname}
                </a>
            );
        }
        return null;
    };

    return (
        <div className="space-y-4">
            <div className="flex">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Ask a question about recent events or topics..."
                    className="flex-1 p-3 bg-gray-700 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button onClick={handleSearch} disabled={loading} className="p-3 bg-purple-600 rounded-r-lg hover:bg-purple-700 disabled:bg-purple-900">
                    {loading ? <Spinner /> : 'Search'}
                </button>
            </div>

            {loading && <div className="flex justify-center pt-4"><Spinner message="Searching the web..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            
            {response && (
                <div className="p-4 bg-gray-800 rounded-lg space-y-4 animate-fade-in">
                    <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap">
                        {response.content.parts[0].text}
                    </div>
                    {response.groundingMetadata?.groundingChunks && response.groundingMetadata.groundingChunks.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-200">Sources:</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {response.groundingMetadata.groundingChunks.map(renderGroundingChunk)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Thinking Mode Component ---
const ThinkingMode: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [thinkingBudget, setThinkingBudget] = useState(8192);

    const handleSubmit = async () => {
        if (!prompt) return;
        setLoading(true);
        setError('');
        setResponse('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: { thinkingConfig: { thinkingBudget: thinkingBudget } }
            });
            setResponse(result.text);
        } catch (err) {
            console.error(err);
            setError(`Request failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
         <div className="space-y-4">
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter a complex problem or a multi-step request..."
                className="w-full h-32 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-grow w-full">
                    <label htmlFor="thinking-budget" className="block text-sm font-medium text-gray-300 mb-1">
                        Thinking Budget: <span className="font-bold text-purple-300">{thinkingBudget} tokens</span>
                    </label>
                    <input
                        id="thinking-budget"
                        type="range"
                        min="0"
                        max="32768"
                        step="1024"
                        value={thinkingBudget}
                        onChange={(e) => setThinkingBudget(Number(e.target.value))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                </div>
                <button onClick={handleSubmit} disabled={loading || !prompt} className="w-full md:w-auto p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">
                    {loading ? 'Thinking...' : 'Solve'}
                </button>
            </div>

            {loading && <div className="flex justify-center pt-4"><Spinner message="Deeply considering your request..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}

            {response && (
                <div className="p-4 bg-gray-800 rounded-lg space-y-4 animate-fade-in">
                     <h3 className="text-lg font-semibold text-gray-200">Solution:</h3>
                     <p className="text-gray-300 whitespace-pre-wrap">{response}</p>
                </div>
            )}
        </div>
    );
};


// --- Audio Transcription Component ---
const AudioTranscription: React.FC = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState('');
    const [error, setError] = useState('');

    const handleTranscribe = async () => {
        if (!url) {
             setError('Please provide an audio URL.');
            return;
        }
        setLoading(true);
        setError('');
        setResponse('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Please find and provide a full transcript for the audio content (e.g., podcast episode, interview) located at the following URL: ${url}.`,
                config: { tools: [{ googleSearch: {} }] },
            });
            setResponse(result.text);
        } catch (err) {
            console.error(err);
            setError(`Transcription failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <p className="text-gray-400">Enter the URL of a public audio source (e.g., a podcast episode page) to search for its transcript online.</p>
            <div className="flex gap-4">
                <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Enter a public audio URL" className="flex-grow p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button onClick={handleTranscribe} disabled={loading} className="p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">
                    {loading ? 'Transcribing...' : 'Get Transcript'}
                </button>
            </div>
            {loading && <div className="flex justify-center pt-4"><Spinner message="Searching for transcript..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {response && (
                <div className="p-4 bg-gray-800 rounded-lg space-y-4 animate-fade-in max-h-96 overflow-y-auto">
                     <h3 className="text-lg font-semibold text-gray-200">Transcript:</h3>
                     <pre className="text-gray-300 whitespace-pre-wrap font-sans">{response}</pre>
                </div>
            )}
        </div>
    );
};

// --- Text to Speech Component ---
const TextToSpeech: React.FC = () => {
    const [text, setText] = useState('Hello! I am Gemini, a large language model, trained by Google.');
    const [voice, setVoice] = useState('Kore');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [audioUrl, setAudioUrl] = useState('');
    const audioRef = useRef<HTMLAudioElement>(null);

    const voices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

    const generateSpeech = async () => {
        if (!text) return;
        setLoading(true);
        setError('');
        setAudioUrl('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
                },
            });
            
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioBytes = decode(base64Audio);
                const blob = new Blob([audioBytes], { type: 'audio/mpeg' }); // The browser can often play raw PCM in an mpeg container
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
            } else {
                throw new Error("API did not return audio data.");
            }
        } catch (err) {
            console.error(err);
            setError(`Failed to generate speech: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (audioUrl && audioRef.current) {
            audioRef.current.play();
        }
    }, [audioUrl]);

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full h-32 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"/>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Voice</label>
                    <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        {voices.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                <button onClick={generateSpeech} disabled={loading || !text} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">
                    {loading ? 'Generating...' : 'Generate Speech'}
                </button>
            </div>
            {loading && <div className="flex justify-center"><Spinner message="Synthesizing audio..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {audioUrl && (
                <div className="text-center space-y-4">
                    <h3 className="text-lg font-semibold">Generated Audio:</h3>
                    <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                    <a href={audioUrl} download="generated-speech.mp3" className="inline-block px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Download Audio</a>
                </div>
            )}
        </div>
    );
};


// --- Low Latency Component ---
const LowLatency: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (!prompt) return;
        setLoading(true);
        setError('');
        setResponse('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { thinkingConfig: { thinkingBudget: 0 } }
            });
            setResponse(result.text);
        } catch (err) {
            console.error(err);
            setError(`Request failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="Ask a simple question for a fast response..."
                    className="flex-1 p-3 bg-gray-700 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button onClick={handleSubmit} disabled={loading || !prompt} className="p-3 bg-purple-600 rounded-r-lg hover:bg-purple-700 disabled:bg-purple-900">
                    {loading ? <Spinner /> : 'Get Answer'}
                </button>
            </div>

            {loading && <div className="flex justify-center pt-4"><Spinner /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}

            {response && (
                <div className="p-4 bg-gray-800 rounded-lg animate-fade-in">
                     <p className="text-gray-300 whitespace-pre-wrap">{response}</p>
                </div>
            )}
        </div>
    );
};

// --- Image Converter Component ---
const ImageConverter: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [targetFormat, setTargetFormat] = useState('png');
    const [resultImage, setResultImage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleFileSelect = (file: File) => {
        setImageFile(file);
        setResultImage('');
        setError('');
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleConvert = async () => {
        if (!imageFile) {
            setError('Please upload an image.');
            return;
        }
        setLoading(true);
        setError('');
        setResultImage('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const base64Image = await fileToBase64(imageFile);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: base64Image, mimeType: imageFile.type } },
                        { text: `Convert this image to ${targetFormat} format.` },
                    ],
                },
                config: { responseModalities: [Modality.IMAGE] },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                setResultImage(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
            } else {
                 throw new Error(response.text || 'Model did not return an image.');
            }
        } catch (err) {
            console.error(err);
            setError(`Conversion failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                 <FileUploader onFileSelect={handleFileSelect} accept="image/*" label="Upload an image" />
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Convert to:</label>
                    <select value={targetFormat} onChange={e => setTargetFormat(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <option value="png">PNG</option>
                        <option value="jpeg">JPEG</option>
                        <option value="webp">WEBP</option>
                        <option value="svg">SVG (Experimental)</option>
                    </select>
                </div>
                 <button onClick={handleConvert} disabled={loading || !imageFile} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">Convert</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mt-6">
                <div>
                    <h3 className="text-xl font-bold text-center mb-2">Original</h3>
                    {imagePreview ? <ZoomableImage src={imagePreview} alt="Original" /> : <div className="h-96 bg-gray-800 rounded-lg flex items-center justify-center text-gray-500">Preview</div>}
                </div>
                <div>
                    <h3 className="text-xl font-bold text-center mb-2">Converted</h3>
                    <div className="h-96 bg-gray-800 rounded-lg flex items-center justify-center">
                        {loading && <Spinner />}
                        {error && <p className="text-red-400 text-center">{error}</p>}
                        {resultImage && <ZoomableImage src={resultImage} alt="Converted" />}
                    </div>
                     {resultImage && <a href={resultImage} download={`converted.${targetFormat}`} className="mt-2 w-full text-center inline-block px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Download</a>}
                </div>
            </div>
        </div>
    );
};

// --- Address Generation Component ---
const AddressGeneration: React.FC = () => {
    type Address = { street: string; city: string; state: string; postalCode: string; country: string };
    const [count, setCount] = useState(5);
    const [location, setLocation] = useState('');
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const generate = async () => {
        setLoading(true);
        setError('');
        setAddresses([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Generate ${count} realistic random addresses. ${location ? `They should be located in ${location}.` : ''}`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            addresses: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        street: { type: Type.STRING },
                                        city: { type: Type.STRING },
                                        state: { type: Type.STRING },
                                        postalCode: { type: Type.STRING },
                                        country: { type: Type.STRING },
                                    },
                                    required: ["street", "city", "state", "postalCode", "country"]
                                }
                            }
                        }
                    }
                }
            });
            const parsed = JSON.parse(response.text);
            setAddresses(parsed.addresses);
        } catch (err) {
            console.error(err);
            setError(`Failed to generate addresses: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Number to Generate</label>
                    <input type="number" value={count} onChange={e => setCount(Math.max(1, Number(e.target.value)))} min="1" max="50" className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Location (optional)</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g., California, USA or Tokyo" className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
                <button onClick={generate} disabled={loading} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">Generate</button>
            </div>
            {loading && <div className="flex justify-center"><Spinner message="Generating..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {addresses.length > 0 && (
                <div className="overflow-x-auto bg-gray-800/50 rounded-lg">
                    <table className="w-full text-left">
                        <thead className="bg-gray-700/50"><tr>
                            <th className="p-3">Street</th><th className="p-3">City</th><th className="p-3">State/Province</th><th className="p-3">Postal Code</th><th className="p-3">Country</th>
                        </tr></thead>
                        <tbody>
                            {addresses.map((addr, i) => (
                                <tr key={i} className="border-b border-gray-700">
                                    <td className="p-3">{addr.street}</td><td className="p-3">{addr.city}</td><td className="p-3">{addr.state}</td><td className="p-3">{addr.postalCode}</td><td className="p-3">{addr.country}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// --- Global Trending Topics Component ---
const GlobalTrendingTopics: React.FC = () => {
    const [category, setCategory] = useState('All');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const categories = ['All', 'Technology', 'Business', 'Sports', 'Entertainment', 'Health'];

    const findTrends = async () => {
        setLoading(true);
        setError('');
        setResponse('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `What are the top 5 global trending topics right now ${category !== 'All' ? `in the ${category} category` : ''}? Provide a numbered list with a brief, one-sentence explanation for why each is trending.`,
                config: { tools: [{ googleSearch: {} }] },
            });
            setResponse(result.text);
        } catch (err) {
            console.error(err);
            setError(`Failed to fetch trends: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <button onClick={findTrends} disabled={loading} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">Find Trends</button>
            </div>
            {loading && <div className="flex justify-center"><Spinner message="Scanning the globe..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {response && (
                <div className="p-4 bg-gray-800 rounded-lg prose prose-invert max-w-none whitespace-pre-wrap">
                    {response}
                </div>
            )}
        </div>
    );
};

// --- Keywords Research Component ---
const KeywordsResearch: React.FC = () => {
    type KeywordResult = { keyword: string; volume: string; difficulty: string; };
    const [topic, setTopic] = useState('');
    const [results, setResults] = useState<KeywordResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const research = async () => {
        if (!topic) return;
        setLoading(true);
        setError('');
        setResults([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Act as an SEO expert. For the topic "${topic}", generate a list of 15 related keywords, including long-tail and question-based queries. For each keyword, provide a qualitative search volume estimate (High, Medium, Low) and a qualitative SEO difficulty estimate (High, Medium, Low).`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            keywords: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        keyword: { type: Type.STRING },
                                        volume: { type: Type.STRING },
                                        difficulty: { type: Type.STRING },
                                    },
                                    required: ["keyword", "volume", "difficulty"]
                                }
                            }
                        }
                    }
                }
            });
            const parsed = JSON.parse(response.text);
            setResults(parsed.keywords);
        } catch (err) {
            console.error(err);
            setError(`Research failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4">
                <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Enter a topic, e.g., 'sustainable gardening'" className="flex-grow p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button onClick={research} disabled={loading} className="p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">Research</button>
            </div>
            {loading && <div className="flex justify-center"><Spinner message="Finding keywords..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {results.length > 0 && (
                <div className="overflow-x-auto bg-gray-800/50 rounded-lg">
                    <table className="w-full text-left">
                        <thead className="bg-gray-700/50"><tr>
                            <th className="p-3">Keyword</th><th className="p-3">Est. Volume</th><th className="p-3">Est. Difficulty</th>
                        </tr></thead>
                        <tbody>
                            {results.map((res, i) => (
                                <tr key={i} className="border-b border-gray-700">
                                    <td className="p-3 font-semibold">{res.keyword}</td><td className="p-3">{res.volume}</td><td className="p-3">{res.difficulty}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// --- Website Analysis Component ---
const WebsiteAnalysis: React.FC = () => {
    const [url, setUrl] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const analyze = async () => {
        if (!url) return;
        setLoading(true);
        setError('');
        setResponse('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Analyze the website at ${url}. Provide a comprehensive report covering SEO (keywords, backlink profile ideas), performance (potential speed improvements), and accessibility (common issues to check for). Provide actionable insights. Format the output in markdown.`,
                config: { tools: [{ googleSearch: {} }] },
            });
            setResponse(result.text);
        } catch (err) {
            console.error(err);
            setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4">
                <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="flex-grow p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button onClick={analyze} disabled={loading} className="p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">Analyze</button>
            </div>
            {loading && <div className="flex justify-center"><Spinner message="Analyzing website..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {response && <div className="p-4 bg-gray-800 rounded-lg prose prose-invert max-w-none whitespace-pre-wrap">{response}</div>}
        </div>
    );
};

// --- Web Scraping Component ---
const WebScraping: React.FC = () => {
    const [url, setUrl] = useState('');
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const scrape = async () => {
        if (!url || !query) return;
        setLoading(true);
        setError('');
        setResponse('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Using your knowledge of the content at the URL ${url}, extract the following information: ${query}. Present the data in a clear, structured format. If the request implies a list, use a numbered or bulleted list.`,
                config: { tools: [{ googleSearch: {} }] },
            });
            setResponse(result.text);
        } catch (err) {
            console.error(err);
            setError(`Scraping failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
         <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="What to extract? e.g., 'all h2 headings'" className="p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <button onClick={scrape} disabled={loading} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900">Scrape</button>
            {loading && <div className="flex justify-center"><Spinner message="Extracting data..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            {response && <pre className="p-4 bg-gray-800 rounded-lg whitespace-pre-wrap font-mono text-sm">{response}</pre>}
        </div>
    );
};


// --- Email Validation Component ---
const EmailValidation: React.FC = () => {
    type ValidationResult = {
        valid: string[];
        invalid: string[];
        risky: string[];
        duplicates: number;
        total: number;
    };

    const [inputText, setInputText] = useState('');
    const [results, setResults] = useState<ValidationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'valid' | 'invalid' | 'risky'>('valid');

    const handleFileSelect = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setInputText(content);
        };
        reader.onerror = () => {
            setError('Failed to read the file.');
        };
        reader.readAsText(file);
    };

    const validateEmails = () => {
        if (!inputText.trim()) {
            setError('Please provide emails to validate.');
            return;
        }
        setLoading(true);
        setError('');
        setResults(null);

        // Simulate processing delay for better UX
        setTimeout(() => {
            const emailRegex = new RegExp(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
            
            const emails: string[] = inputText.split(/[,\s\n]+/).filter(e => e.trim() !== '');
            const uniqueEmails: string[] = [...new Set(emails.map(e => e.trim().toLowerCase()))];

            const validation: Omit<ValidationResult, 'duplicates' | 'total'> = {
                valid: [],
                invalid: [],
                risky: [],
            };

            for (const email of uniqueEmails) {
                if (!emailRegex.test(email)) {
                    validation.invalid.push(email);
                } else {
                    const domain = email.split('@')[1];
                    const user = email.split('@')[0];
                    if (disposableDomains.has(domain) || roleBasedEmails.has(user)) {
                        validation.risky.push(email);
                    } else {
                        validation.valid.push(email);
                    }
                }
            }

            setResults({
                ...validation,
                total: emails.length,
                duplicates: emails.length - uniqueEmails.length,
            });
            setLoading(false);
        }, 500);
    };
    
    const copyToClipboard = (data: string[]) => {
        navigator.clipboard.writeText(data.join('\n'));
    };

    const downloadAsCsv = (data: string[], filename: string) => {
        const csvContent = "data:text/csv;charset=utf-8," + "email\n" + data.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderResultList = (emails: string[], category: string) => (
        <div className="h-64 overflow-y-auto bg-gray-900/50 p-3 rounded-md space-y-2">
            <div className="flex justify-end gap-2 mb-2">
                <button onClick={() => copyToClipboard(emails)} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">Copy</button>
                <button onClick={() => downloadAsCsv(emails, `${category}_emails.csv`)} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm">Download CSV</button>
            </div>
            {emails.length > 0 ? (
                emails.map((email, index) => (
                    <p key={index} className="text-sm text-gray-300 font-mono break-all">{email}</p>
                ))
            ) : (
                <p className="text-gray-500 text-center pt-8">No emails in this category.</p>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your email list here (one per line, or comma/space separated)"
                    rows={10}
                    className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="space-y-4">
                    <FileUploader onFileSelect={handleFileSelect} accept=".txt,.csv" label="Or upload a .txt/.csv file" />
                    <button onClick={validateEmails} disabled={loading} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
                        {loading ? 'Validating...' : 'Validate Emails'}
                    </button>
                </div>
            </div>
            {loading && <div className="flex justify-center"><Spinner message="Analyzing your list..." /></div>}
            {error && <p className="text-red-400 text-center">{error}</p>}
            
            {results && (
                <div className="animate-fade-in space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="bg-gray-800 p-4 rounded-lg"><p className="text-2xl font-bold">{results.total}</p><p className="text-sm text-gray-400">Total Processed</p></div>
                        <div className="bg-green-800/50 p-4 rounded-lg"><p className="text-2xl font-bold text-green-300">{results.valid.length}</p><p className="text-sm text-gray-400">Valid</p></div>
                        <div className="bg-red-800/50 p-4 rounded-lg"><p className="text-2xl font-bold text-red-300">{results.invalid.length}</p><p className="text-sm text-gray-400">Invalid Syntax</p></div>
                        <div className="bg-yellow-800/50 p-4 rounded-lg"><p className="text-2xl font-bold text-yellow-300">{results.risky.length}</p><p className="text-sm text-gray-400">Risky</p></div>
                    </div>
                     {results.duplicates > 0 && <p className="text-center text-gray-400">Removed {results.duplicates} duplicate(s).</p>}
                    {/* Tabbed Results */}
                    <div>
                        <div className="border-b border-gray-700">
                            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                <button onClick={() => setActiveTab('valid')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'valid' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Valid ({results.valid.length})</button>
                                <button onClick={() => setActiveTab('invalid')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'invalid' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Invalid Syntax ({results.invalid.length})</button>
                                <button onClick={() => setActiveTab('risky')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'risky' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Risky ({results.risky.length})</button>
                            </nav>
                        </div>
                        <div className="pt-4">
                            {activeTab === 'valid' && renderResultList(results.valid, 'valid')}
                            {activeTab === 'invalid' && renderResultList(results.invalid, 'invalid')}
                            {activeTab === 'risky' && renderResultList(results.risky, 'risky')}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Email Extractor Component ---
const EmailExtractor: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [extractedEmails, setExtractedEmails] = useState<string[]>([]);
    const [copyButtonText, setCopyButtonText] = useState('Copy All');

    const handleExtract = () => {
        if (!inputText.trim()) {
            setExtractedEmails([]);
            return;
        }
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        const foundEmails = inputText.match(emailRegex) || [];
        const uniqueEmails = [...new Set(foundEmails.map(email => email.toLowerCase()))];
        setExtractedEmails(uniqueEmails.sort());
    };

    const copyResults = () => {
        if (extractedEmails.length > 0) {
            navigator.clipboard.writeText(extractedEmails.join('\n'));
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy All'), 2000);
        }
    };

    const downloadResults = () => {
        if (extractedEmails.length > 0) {
            const textContent = "data:text/plain;charset=utf-8," + encodeURIComponent(extractedEmails.join("\n"));
            const link = document.createElement("a");
            link.setAttribute("href", textContent);
            link.setAttribute("download", "extracted_emails.txt");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Paste text containing email addresses here..."
                        rows={16}
                        className="w-full p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button onClick={handleExtract} className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed">
                        Extract Emails
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-gray-800/50 p-3 rounded-lg">
                        <h3 className="text-lg font-bold">
                            Found: <span className="text-purple-400">{extractedEmails.length}</span> unique email(s)
                        </h3>
                        {extractedEmails.length > 0 && (
                            <div className="flex gap-2">
                                <button onClick={copyResults} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors">{copyButtonText}</button>
                                <button onClick={downloadResults} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm">Download .txt</button>
                            </div>
                        )}
                    </div>
                    <div className="h-[20.5rem] overflow-y-auto bg-gray-700 p-3 rounded-lg space-y-2">
                        {extractedEmails.length > 0 ? (
                            extractedEmails.map((email, index) => (
                                <p key={index} className="font-mono text-sm text-gray-300 break-all">{email}</p>
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                <p>Results will appear here...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Email Marketing Component ---
const AiContentGenerator: React.FC<{ onGenerate: (content: string) => void }> = ({ onGenerate }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    
    const handleGenerateContent = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setResult('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Generate a compelling email marketing copy for the following topic: ${prompt}. The output should be well-formatted text.`,
            });
            setResult(response.text);
        } catch (error) {
            console.error("AI content generation failed:", error);
            setResult("Sorry, I couldn't generate content. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4 w-full">
            <h3 className="text-xl font-bold text-purple-300">Generate Email Content</h3>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A special 20% off summer sale on all electronics"
                className="w-full h-24 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isLoading}
            />
            <button
                onClick={handleGenerateContent}
                disabled={isLoading || !prompt}
                className="w-full p-3 bg-purple-600 rounded-lg font-bold hover:bg-purple-700 disabled:bg-purple-900"
            >
                {isLoading ? <Spinner /> : 'Generate Content'}
            </button>
            {result && (
                <div className="mt-4 p-4 bg-gray-900 rounded-lg max-h-64 overflow-y-auto">
                    <p className="text-gray-300 whitespace-pre-wrap">{result}</p>
                    <button
                        onClick={() => onGenerate(result)}
                        className="mt-4 w-full p-2 bg-green-600 rounded-lg font-bold hover:bg-green-700"
                    >
                        Use This Content
                    </button>
                </div>
            )}
        </div>
    );
};

const EmailCampaignEditor: React.FC<{
    campaign: Campaign | undefined;
    lists: ContactList[];
    onSave: (campaign: Campaign) => void;
    onCancel: () => void;
}> = ({ campaign: initialCampaign, lists, onSave, onCancel }) => {
    const [campaign, setCampaign] = useState<Campaign | null>(() => {
        if (initialCampaign) return initialCampaign;
        const newCampaign: Campaign = {
            id: `c_${Date.now()}`,
            name: '',
            subject: '',
            fromName: 'Edukester',
            fromEmail: 'noreply@edukester.com',
            content: '',
            audienceListIds: [],
            status: 'Draft',
            stats: { recipients: 0, openRate: 0, clickRate: 0 },
            createdAt: new Date().toISOString(),
        };
        return newCampaign;
    });
    const [isAiOpen, setIsAiOpen] = useState(false);

    useEffect(() => {
        if (initialCampaign) {
            setCampaign(initialCampaign);
        }
    }, [initialCampaign]);

    const handleSave = () => {
        if (campaign) {
            onSave({ ...campaign, status: 'Draft' });
        }
    };

    const handleSend = () => {
        if (campaign) {
            const campaignToSend = { ...campaign, status: 'Sending' as const };
            onSave(campaignToSend);

            // Simulate sending delay
            setTimeout(() => {
                onSave({ ...campaignToSend, status: 'Sent', sentAt: new Date().toISOString() });
            }, 2000);
        }
    };

    if (!campaign) {
        return <div className="text-center p-8"><Spinner message="Loading Campaign..." /></div>;
    }

    return (
        <div className="bg-gray-900 p-8 rounded-lg shadow-2xl w-full max-w-4xl space-y-6 animate-fade-in">
            <h2 className="text-3xl font-bold text-white">{initialCampaign ? 'Edit Campaign' : 'Create Campaign'}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input type="text" placeholder="Campaign Name" value={campaign.name} onChange={e => setCampaign({ ...campaign, name: e.target.value })} className="p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <input type="text" placeholder="Subject Line" value={campaign.subject} onChange={e => setCampaign({ ...campaign, subject: e.target.value })} className="p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <input type="text" placeholder="From Name" value={campaign.fromName} onChange={e => setCampaign({ ...campaign, fromName: e.target.value })} className="p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <input type="email" placeholder="From Email" value={campaign.fromEmail} onChange={e => setCampaign({ ...campaign, fromEmail: e.target.value })} className="p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>

            <div>
                <label className="block text-lg font-semibold text-gray-300 mb-2">Email Content</label>
                <div className="relative">
                    <textarea placeholder="Write your email here, or use AI to generate it..." value={campaign.content} onChange={e => setCampaign({ ...campaign, content: e.target.value })} rows={12} className="w-full p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
                    <button onClick={() => setIsAiOpen(true)} className="absolute top-3 right-3 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 rounded-md font-semibold">
                        Generate with AI
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-lg font-semibold text-gray-300 mb-2">Audience</label>
                <select multiple value={campaign.audienceListIds} onChange={e => setCampaign({ ...campaign, audienceListIds: Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value) })} className="w-full p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 h-32">
                    {lists.map(list => (
                        <option key={list.id} value={list.id}>{list.name} ({list.contacts.length})</option>
                    ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple lists.</p>
            </div>

            <div className="flex justify-end gap-4 pt-4">
                <button onClick={onCancel} className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold">Cancel</button>
                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold">Save as Draft</button>
                <button onClick={handleSend} className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold">Send Campaign</button>
            </div>
            
            {isAiOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl relative">
                         <button onClick={() => setIsAiOpen(false)} className="absolute top-3 right-3 text-gray-400 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <AiContentGenerator onGenerate={(content) => {
                            setCampaign(c => c ? { ...c, content } : null);
                            setIsAiOpen(false);
                        }} />
                    </div>
                </div>
            )}
        </div>
    );
};


const EmailMarketing: React.FC = () => {
    type View = 'dashboard' | 'listDetail' | 'campaignEditor';
    type Modal = 'createList' | 'addContacts' | null;

    const [view, setView] = useState<View>('dashboard');
    const [activeTab, setActiveTab] = useState<'campaigns' | 'audience'>('campaigns');
    const [lists, setLists] = useState<ContactList[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
    
    const [modal, setModal] = useState<Modal>(null);
    const [newListName, setNewListName] = useState('');
    const [contactsToAdd, setContactsToAdd] = useState('');

    useEffect(() => {
        setLists([
            { id: 'l1', name: 'Newsletter Subscribers', contacts: [{id: 'c1', email: 'subscriber1@example.com', name: 'Alex', createdAt: new Date().toISOString()}], createdAt: new Date().toISOString() },
            { id: 'l2', name: 'Past Customers', contacts: [], createdAt: new Date().toISOString() },
        ]);
        setCampaigns([
            { id: 'camp1', name: 'Q2 Newsletter', subject: 'Our Latest Updates!', fromName: 'Edukester', fromEmail: 'news@edukester.com', content: 'Hello world...', audienceListIds: ['l1'], status: 'Sent', stats: { recipients: 1500, openRate: 25.5, clickRate: 4.1 }, createdAt: '2023-06-15T10:00:00Z', sentAt: '2023-06-15T14:00:00Z' },
            { id: 'camp2', name: 'July Promo', subject: 'Summer Sale is Here!', fromName: 'Edukester', fromEmail: 'deals@edukester.com', content: 'Get 20% off!', audienceListIds: ['l2'], status: 'Draft', stats: { recipients: 0, openRate: 0, clickRate: 0 }, createdAt: '2023-07-01T11:00:00Z' },
        ]);
    }, []);
    
    const handleCreateCampaign = () => {
        setEditingCampaignId(null);
        setView('campaignEditor');
    };
    
    const handleEditCampaign = (id: string) => {
        setEditingCampaignId(id);
        setView('campaignEditor');
    };
    
    const handleDeleteCampaign = (id: string) => {
        if (window.confirm('Are you sure you want to delete this campaign?')) {
            setCampaigns(campaigns.filter(c => c.id !== id));
        }
    };

    const handleSaveCampaign = (savedCampaign: Campaign) => {
        setCampaigns(prev => {
            const index = prev.findIndex(c => c.id === savedCampaign.id);
            if (index > -1) {
                const newCampaigns = [...prev];
                newCampaigns[index] = savedCampaign;
                return newCampaigns;
            }
            return [...prev, savedCampaign];
        });
        setEditingCampaignId(null);
        setView('dashboard');
    };

    const handleCreateList = () => {
        if (!newListName.trim()) return;
        const newList: ContactList = {
            id: `l_${Date.now()}`,
            name: newListName,
            contacts: [],
            createdAt: new Date().toISOString(),
        };
        setLists(prev => [...prev, newList]);
        setNewListName('');
        setModal(null);
    };
    
    const handleDeleteList = (listId: string) => {
        if (window.confirm('Are you sure? This will remove the list and unsubscribe its contacts from any campaigns.')) {
            setLists(lists.filter(l => l.id !== listId));
            setCampaigns(campaigns.map(c => ({
                ...c,
                audienceListIds: c.audienceListIds.filter(id => id !== listId)
            })));
        }
    };
    
    const handleAddContacts = () => {
        if (!selectedListId || !contactsToAdd.trim()) return;
        const emails = contactsToAdd.split(/[,\s\n]+/).filter(e => e.trim() !== '');
        const newContacts: Contact[] = emails.map(email => ({
            id: `c_${Date.now()}_${email}`,
            email: email.trim(),
            createdAt: new Date().toISOString()
        }));

        setLists(lists.map(list => {
            if (list.id === selectedListId) {
                const existingEmails = new Set(list.contacts.map(c => c.email));
                const uniqueNewContacts = newContacts.filter(c => !existingEmails.has(c.email));
                return { ...list, contacts: [...list.contacts, ...uniqueNewContacts] };
            }
            return list;
        }));
        setContactsToAdd('');
        setModal(null);
    };
    
    const handleAddContactsFromFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setContactsToAdd(e.target?.result as string);
        };
        reader.readAsText(file);
    };

    const handleDeleteContact = (listId: string, contactId: string) => {
        setLists(lists.map(list => {
            if (list.id === listId) {
                return { ...list, contacts: list.contacts.filter(c => c.id !== contactId) };
            }
            return list;
        }));
    };
    
    const renderStatusBadge = (status: Campaign['status']) => {
        const styles = {
            Draft: 'bg-gray-500 text-gray-100',
            Sending: 'bg-blue-500 text-white animate-pulse',
            Sent: 'bg-green-500 text-white',
        };
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status]}`}>{status}</span>;
    };
    
    if (view === 'campaignEditor') {
        const campaign = campaigns.find(c => c.id === editingCampaignId);
        return <EmailCampaignEditor campaign={campaign} lists={lists} onSave={handleSaveCampaign} onCancel={() => setView('dashboard')} />;
    }

    if (view === 'listDetail') {
        const list = lists.find(l => l.id === selectedListId);
        if (!list) { setView('dashboard'); return null; }
        return (
            <div className="space-y-6 animate-fade-in">
                <button onClick={() => setView('dashboard')} className="text-purple-400 hover:text-purple-300">&larr; Back to Dashboard</button>
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold">{list.name} <span className="text-lg font-normal text-gray-400">({list.contacts.length} Contacts)</span></h2>
                    <button onClick={() => setModal('addContacts')} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold">Add Contacts</button>
                </div>
                <div className="bg-gray-800/50 rounded-lg shadow-lg overflow-hidden">
                    <table className="w-full text-left">
                         <thead className="bg-gray-700/50"><tr>
                            <th className="p-4">Email</th><th className="p-4">Name</th><th className="p-4">Date Added</th><th className="p-4">Actions</th>
                        </tr></thead>
                        <tbody>
                            {list.contacts.map(c => (
                                <tr key={c.id} className="border-b border-gray-700 hover:bg-gray-800">
                                    <td className="p-4 font-mono text-sm">{c.email}</td>
                                    <td className="p-4">{c.name || '--'}</td>
                                    <td className="p-4">{new Date(c.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4"><button onClick={() => handleDeleteContact(list.id, c.id)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm">Delete</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
    
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="border-b border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('campaigns')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === 'campaigns' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Campaigns</button>
                    <button onClick={() => setActiveTab('audience')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === 'audience' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Audience</button>
                </nav>
            </div>

            {activeTab === 'campaigns' && (
            <div>
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">Email Campaigns</h2>
                    <button onClick={handleCreateCampaign} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold">Create Campaign</button>
                </div>
                <div className="bg-gray-800/50 rounded-lg shadow-lg overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-700/50"><tr>
                            <th className="p-4">Campaign</th><th className="p-4">Status</th><th className="p-4">Recipients</th><th className="p-4">Open Rate</th><th className="p-4">Click Rate</th><th className="p-4">Actions</th>
                        </tr></thead>
                        <tbody>
                            {campaigns.map(c => (
                                <tr key={c.id} className="border-b border-gray-700 hover:bg-gray-800">
                                    <td className="p-4 font-semibold">{c.name}<br/><span className="text-sm text-gray-400 font-normal">{c.subject}</span></td>
                                    <td className="p-4">{renderStatusBadge(c.status)}</td>
                                    <td className="p-4">{c.stats.recipients.toLocaleString()}</td><td className="p-4">{c.stats.openRate.toFixed(1)}%</td><td className="p-4">{c.stats.clickRate.toFixed(1)}%</td>
                                    <td className="p-4 space-x-2"><button onClick={() => handleEditCampaign(c.id)} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">Edit</button><button onClick={() => handleDeleteCampaign(c.id)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm">Delete</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
            
            {activeTab === 'audience' && (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">Contact Lists</h2>
                    <button onClick={() => setModal('createList')} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold">Create List</button>
                </div>
                <div className="bg-gray-800/50 rounded-lg shadow-lg overflow-hidden">
                    <table className="w-full text-left">
                         <thead className="bg-gray-700/50"><tr>
                            <th className="p-4">List Name</th><th className="p-4">Contacts</th><th className="p-4">Date Created</th><th className="p-4">Actions</th>
                        </tr></thead>
                        <tbody>
                            {lists.map(l => (
                                <tr key={l.id} className="border-b border-gray-700 hover:bg-gray-800">
                                    <td className="p-4 font-semibold">{l.name}</td>
                                    <td className="p-4">{l.contacts.length}</td>
                                    <td className="p-4">{new Date(l.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4 space-x-2">
                                        <button onClick={() => { setSelectedListId(l.id); setView('listDetail'); }} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">Manage</button>
                                        <button onClick={() => handleDeleteList(l.id)} className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-sm">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
            
            {/* Modals */}
            {modal === 'createList' && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md space-y-4">
                    <h3 className="text-xl font-bold">Create New List</h3>
                    <input type="text" value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="List Name" className="w-full p-3 bg-gray-700 rounded-lg"/>
                    <div className="flex justify-end gap-3"><button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button><button onClick={handleCreateList} className="px-4 py-2 bg-purple-600 rounded">Create</button></div>
                </div>
            </div>
            )}
            {modal === 'addContacts' && (
             <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg space-y-4">
                    <h3 className="text-xl font-bold">Add Contacts to "{lists.find(l=>l.id===selectedListId)?.name}"</h3>
                    <textarea value={contactsToAdd} onChange={e => setContactsToAdd(e.target.value)} placeholder="Paste emails here, separated by commas, spaces, or new lines." rows={8} className="w-full p-3 bg-gray-700 rounded-lg"/>
                    <FileUploader onFileSelect={handleAddContactsFromFile} accept=".txt,.csv" label="Or upload a file"/>
                    <div className="flex justify-end gap-3"><button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-600 rounded">Cancel</button><button onClick={handleAddContacts} className="px-4 py-2 bg-purple-600 rounded">Add Contacts</button></div>
                </div>
            </div>
            )}
        </div>
    );
};

// --- Tool Renderer ---

const toolComponentMap: Record<Tool, React.FC> = {
    [Tool.Chatbot]: Chatbot,
    [Tool.LiveConversation]: LiveConversation,
    [Tool.ImageGeneration]: ImageGeneration,
    [Tool.ImageEditing]: ImageEditing,
    [Tool.NanoBananaStudio]: NanoBananaStudio,
    [Tool.ImageBackgroundRemoval]: ImageBackgroundRemover,
    [Tool.ImageAnimation]: ImageAnimation,
    [Tool.ImageUnderstanding]: ImageUnderstanding,
    [Tool.YouTubeThumbnail]: YouTubeThumbnail,
    [Tool.ImageConverter]: ImageConverter,
    [Tool.VideoGeneration]: VideoGeneration,
    [Tool.VideoUnderstanding]: VideoUnderstanding,
    [Tool.VideoTranscription]: VideoTranscription,
    [Tool.GroundedSearch]: GroundedSearch,
    [Tool.ThinkingMode]: ThinkingMode,
    [Tool.AudioTranscription]: AudioTranscription,
    [Tool.TextToSpeech]: TextToSpeech,
    [Tool.LowLatency]: LowLatency,
    [Tool.AddressGeneration]: AddressGeneration,
    [Tool.GlobalTrendingTopics]: GlobalTrendingTopics,
    [Tool.KeywordsResearch]: KeywordsResearch,
    [Tool.WebsiteAnalysis]: WebsiteAnalysis,
    [Tool.WebScraping]: WebScraping,
    [Tool.EmailMarketing]: EmailMarketing,
    [Tool.EmailValidation]: EmailValidation,
    [Tool.EmailExtractor]: EmailExtractor,
};

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<Tool>(Tool.Chatbot);

  const ActiveToolComponent = toolComponentMap[activeTool];
  const toolInfo = TOOLS.find(t => t.id === activeTool);

  return (
    <div className="flex h-screen font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-800 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center justify-center border-b border-gray-700 flex-shrink-0">
          <h1 className="text-2xl font-bold tracking-wider">Edukester AI</h1>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ul>
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTool(tool.id);
                  }}
                  className={`flex items-center px-4 py-3 group transition-colors ${
                    activeTool === tool.id
                      ? 'bg-purple-800/50 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {tool.icon}
                  <span className="font-medium">{tool.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
        <header className="h-16 bg-gray-800/50 border-b border-gray-700 flex items-center px-8 flex-shrink-0">
            {toolInfo && (
                <div>
                    <h2 className="text-xl font-bold">{toolInfo.name}</h2>
                    <p className="text-sm text-gray-400">{toolInfo.description}</p>
                </div>
            )}
        </header>
        <div className="flex-1 p-8 overflow-y-auto">
          {ActiveToolComponent ? <ActiveToolComponent /> : <div>Select a tool</div>}
        </div>
      </main>
    </div>
  );
};

export default App;
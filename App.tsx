
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, Schema, FunctionDeclaration, HarmCategory, HarmBlockThreshold, LiveServerMessage, Modality } from "@google/genai";
import { TOOLS } from './constants';
import { Tool, Contact, VideoResolution } from './types';
import { fileToBase64, createAudioBlob, decodeAudioData, decode } from './utils/helpers';
import { disposableDomains, roleBasedEmails } from './data/disposable-domains';

// --- Shared UI Components ---
const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={`bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden ${className}`} {...props} />
);

const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className, ...props }) => (
  <label className={`block text-sm font-medium text-gray-300 mb-2 ${className}`} {...props} />
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...props }) => (
  <textarea className={`w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-y ${className}`} {...props} />
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input className={`w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all ${className}`} {...props} />
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
  <button className={`bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-purple-900/20 ${className}`} {...props}>
    {children}
  </button>
);

const Spinner: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center gap-3 p-8">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-t-2 border-purple-500"></div>
    {message && <p className="text-gray-400 text-sm animate-pulse font-medium text-center max-w-xs">{message}</p>}
  </div>
);

const FileUploader: React.FC<{ 
  accept: string; 
  onFileSelect: (file: File) => void; 
  label?: string;
  previewUrl?: string | null;
  onClear?: () => void;
  compact?: boolean;
}> = ({ accept, onFileSelect, label = "Upload File", previewUrl, onClear, compact }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />
      {previewUrl ? (
        <div className={`relative group rounded-xl overflow-hidden border border-gray-700 bg-black/50 flex justify-center items-center ${compact ? 'h-24' : 'min-h-[160px] max-h-[300px]'}`}>
          {accept.includes('video') ? (
            <video src={previewUrl} className="max-h-full max-w-full object-contain" />
          ) : accept.includes('audio') ? (
            <audio src={previewUrl} controls className="w-full p-2 scale-75" />
          ) : (
            <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
          )}
          {onClear && (
            <button 
              onClick={(e) => { e.stopPropagation(); onClear(); if(fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1 rounded-full backdrop-blur-sm transition-colors z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          )}
        </div>
      ) : (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed border-gray-700 hover:border-purple-500 hover:bg-gray-800/50 rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center text-gray-400 group ${compact ? 'p-2 h-24' : 'p-6'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`${compact ? 'h-6 w-6' : 'h-10 w-10'} mb-2 text-gray-500 group-hover:text-purple-400 transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium`}>{label}</span>
        </div>
      )}
    </div>
  );
};

// --- Specialized Tools ---

// Optimized Video Editor Pro Tool
const VideoEditorTool: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [resolution, setResolution] = useState<VideoResolution>('720p');
    const [firstFrameFile, setFirstFrameFile] = useState<File | null>(null);
    const [lastFrameFile, setLastFrameFile] = useState<File | null>(null);
    const [uploadVideoFile, setUploadVideoFile] = useState<File | null>(null);
    const [previewUrls, setPreviewUrls] = useState<{first?: string, last?: string, upload?: string}>({});
    
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    
    // Result States
    const [lastOperation, setLastOperation] = useState<any>(null);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [history, setHistory] = useState<{url: string, type: string, prompt: string}[]>([]);

    const checkKeyGuard = async () => {
        if (window.aistudio?.hasSelectedApiKey) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey && window.aistudio.openSelectKey) {
                await window.aistudio.openSelectKey();
            }
        }
    };

    const processOperation = async (opPromise: Promise<any>) => {
        setLoading(true);
        setAnalysisResult(null);
        setStatusMessage('Initializing Veo 3.1 Creative Engine...');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            let operation = await opPromise;
            
            while (!operation.done) {
                setStatusMessage('Rendering high-fidelity frames. This process consumes significant AI compute...');
                await new Promise(r => setTimeout(r, 10000));
                operation = await ai.operations.getVideosOperation({ operation });
            }

            const videoResult = operation.response?.generatedVideos?.[0]?.video;
            if (videoResult?.uri) {
                setStatusMessage('Assembling video stream...');
                const response = await fetch(`${videoResult.uri}&key=${process.env.API_KEY}`);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                
                setVideoBlobUrl(url);
                setLastOperation(operation);
                setHistory(prev => [{ url, type: lastOperation ? 'Iteration' : 'Base', prompt }, ...prev]);
            }
        } catch (e) {
            console.error(e);
            alert("Workflow failed. Please ensure your project has billing enabled for Veo models.");
        } finally {
            setLoading(false);
            setStatusMessage('');
        }
    };

    const handleGenerate = async () => {
        await checkKeyGuard();
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        let config: any = {
            numberOfVideos: 1,
            resolution: resolution,
            aspectRatio: aspectRatio
        };

        if (lastFrameFile) {
            config.lastFrame = {
                imageBytes: await fileToBase64(lastFrameFile),
                mimeType: lastFrameFile.type
            };
        }

        let opParams: any = {
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config
        };

        if (firstFrameFile) {
            const base64 = await fileToBase64(firstFrameFile);
            opParams.image = { imageBytes: base64, mimeType: firstFrameFile.type };
        }

        processOperation(ai.models.generateVideos(opParams));
    };

    const handleExtend = async () => {
        if (!lastOperation) return;
        await checkKeyGuard();
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        
        const previousVideo = lastOperation.response?.generatedVideos?.[0]?.video;
        
        const opPromise = ai.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: prompt || 'Continue the cinematography with perfect continuity.',
            video: previousVideo,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio
            }
        });

        processOperation(opPromise);
    };

    const handleAnalyzeUpload = async (type: 'describe' | 'transcribe') => {
        if (!uploadVideoFile) return;
        setLoading(true);
        setStatusMessage(`AI is ${type === 'transcribe' ? 'transcribing' : 'analyzing'} your uploaded footage...`);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const base64 = await fileToBase64(uploadVideoFile);
            const promptStr = type === 'transcribe' 
                ? "Provide a word-for-word transcription of all spoken dialogue in this video. Identify speakers if possible." 
                : "Analyze this video and provide a professional breakdown of the scene, lighting, action, and subject matter.";
            
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: {
                    parts: [
                        { inlineData: { data: base64, mimeType: uploadVideoFile.type } },
                        { text: promptStr }
                    ]
                }
            });
            setAnalysisResult(response.text || 'No insights generated.');
        } catch (e) {
            console.error(e);
            alert("Analysis failed. Max upload size is typically 10-20MB for this preview.");
        } finally {
            setLoading(false);
            setStatusMessage('');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Editor Panel */}
                <Card className="lg:col-span-1 p-5 space-y-5 bg-gray-900/90 border-purple-500/30 shadow-2xl">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label className="text-purple-400 font-bold tracking-widest uppercase text-[10px]">Studio Settings</Label>
                            <span className="text-[10px] bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded font-mono">VE-3.1 PRO</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-[10px] text-gray-500">Ratio</Label>
                                <select 
                                    value={aspectRatio} 
                                    onChange={e => setAspectRatio(e.target.value as any)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-white"
                                >
                                    <option value="16:9">Landscape</option>
                                    <option value="9:16">Portrait</option>
                                </select>
                            </div>
                            <div>
                                <Label className="text-[10px] text-gray-500">Quality</Label>
                                <select 
                                    value={resolution} 
                                    onChange={e => setResolution(e.target.value as any)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-white"
                                >
                                    <option value="720p">720p HD</option>
                                    <option value="1080p">1080p FHD</option>
                                </select>
                            </div>
                        </div>

                        {!lastOperation && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-[10px] text-gray-400">First Frame</Label>
                                    <FileUploader 
                                        compact
                                        accept="image/*" 
                                        onFileSelect={(f) => { setFirstFrameFile(f); setPreviewUrls(p => ({...p, first: URL.createObjectURL(f)})); }} 
                                        previewUrl={previewUrls.first}
                                        onClear={() => { setFirstFrameFile(null); setPreviewUrls(p => ({...p, first: undefined})); }}
                                        label="Start"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[10px] text-gray-400">Last Frame</Label>
                                    <FileUploader 
                                        compact
                                        accept="image/*" 
                                        onFileSelect={(f) => { setLastFrameFile(f); setPreviewUrls(p => ({...p, last: URL.createObjectURL(f)})); }} 
                                        previewUrl={previewUrls.last}
                                        onClear={() => { setLastFrameFile(null); setPreviewUrls(p => ({...p, last: undefined})); }}
                                        label="End"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-gray-800">
                            <Label className="text-[10px] text-gray-400 uppercase">Input Footage</Label>
                            <FileUploader 
                                compact
                                accept="video/*" 
                                onFileSelect={(f) => { setUploadVideoFile(f); setPreviewUrls(p => ({...p, upload: URL.createObjectURL(f)})); }} 
                                previewUrl={previewUrls.upload}
                                onClear={() => { setUploadVideoFile(null); setPreviewUrls(p => ({...p, upload: undefined})); setAnalysisResult(null); }}
                                label="Analysis Upload"
                            />
                            {uploadVideoFile && (
                                <div className="flex gap-1 mt-2">
                                    <button onClick={() => handleAnalyzeUpload('describe')} className="flex-1 text-[9px] bg-gray-800 hover:bg-gray-700 p-1.5 rounded text-gray-300">Inspect</button>
                                    <button onClick={() => handleAnalyzeUpload('transcribe')} className="flex-1 text-[9px] bg-gray-800 hover:bg-gray-700 p-1.5 rounded text-gray-300">Transcribe</button>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label className="text-[10px] text-gray-400">{lastOperation ? 'Edit Command' : 'Director Prompt'}</Label>
                            <TextArea 
                                value={prompt} 
                                onChange={e => setPrompt(e.target.value)} 
                                placeholder={lastOperation ? "Transform scene..." : "Cinematic description..."}
                                className="min-h-[80px] text-xs bg-black/60"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        {!lastOperation ? (
                            <Button onClick={handleGenerate} disabled={loading || !prompt} className="w-full text-xs py-3">
                                Bake Production
                            </Button>
                        ) : (
                            <>
                                <Button onClick={handleExtend} disabled={loading} className="w-full text-xs bg-emerald-600 hover:bg-emerald-500">
                                    Extend +7 Seconds
                                </Button>
                                <Button onClick={handleExtend} disabled={loading || !prompt} className="w-full text-xs bg-blue-600 hover:bg-blue-500">
                                    Transform Current
                                </Button>
                                <button 
                                    onClick={() => { setLastOperation(null); setVideoBlobUrl(null); setPrompt(''); }}
                                    className="w-full py-2 text-[10px] text-gray-500 hover:text-red-400 transition-colors uppercase tracking-widest font-bold"
                                >
                                    Reset Studio
                                </button>
                            </>
                        )}
                    </div>
                </Card>

                {/* Main Production Workspace */}
                <div className="lg:col-span-3 space-y-6">
                    {loading && (
                        <Card className="p-16 flex flex-col items-center justify-center space-y-6 bg-black/40 border-purple-500/20 border-2 shadow-inner">
                            <Spinner message={statusMessage} />
                        </Card>
                    )}

                    {!loading && analysisResult && (
                        <Card className="p-6 bg-purple-900/10 border-purple-500/20 animate-fade-in">
                            <Label className="text-purple-400 font-bold mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                AI Footage Insights
                            </Label>
                            <div className="prose prose-invert max-w-none text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed italic">
                                {analysisResult}
                            </div>
                        </Card>
                    )}

                    {!loading && videoBlobUrl && (
                        <Card className="overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,1)] border-4 border-gray-800 rounded-2xl relative">
                            <div className="absolute top-4 right-4 z-20 flex gap-2">
                                <a href={videoBlobUrl} download="production.mp4" className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-3 py-1.5 rounded-full backdrop-blur-md transition-all font-bold uppercase">Save MP4</a>
                            </div>
                            <video 
                                key={videoBlobUrl} 
                                src={videoBlobUrl} 
                                controls 
                                className={`w-full max-h-[70vh] object-contain shadow-2xl shadow-purple-500/5 ${aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`} 
                                autoPlay 
                                loop
                            />
                        </Card>
                    )}

                    {!loading && !videoBlobUrl && !analysisResult && (
                        <div className="h-full min-h-[500px] border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center text-gray-600 p-20 text-center bg-gray-900/20">
                            <div className="w-24 h-24 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-600 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-400 mb-2 tracking-tight">Studio Idle</h3>
                            <p className="text-sm max-w-md text-gray-600 font-sans">Start a new project by defining a scene prompt or uploading existing footage for AI-enhanced transcription and analysis.</p>
                        </div>
                    )}

                    {/* Timeline History */}
                    {history.length > 0 && (
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-2">
                                <div className="h-px bg-gray-800 flex-1"></div>
                                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4">Production Stack</Label>
                                <div className="h-px bg-gray-800 flex-1"></div>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-purple-900/40">
                                {history.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setVideoBlobUrl(item.url)}
                                        className="flex-shrink-0 w-48 cursor-pointer group animate-fade-in"
                                    >
                                        <div className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-700 group-hover:border-purple-500/50 transition-all shadow-lg ring-offset-2 ring-offset-black group-hover:ring-2 ring-purple-500/20">
                                            <video src={item.url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            <p className="text-[9px] font-bold text-purple-400 uppercase">{item.type} {history.length - idx}</p>
                                            <p className="text-[10px] text-gray-500 truncate italic font-sans">"{item.prompt}"</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Fit Check AI Tool
const FitCheckTool: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [occasion, setOccasion] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    const performFitCheck = async () => {
        if (!file) return;
        setLoading(true);
        setFeedback(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const base64 = await fileToBase64(file);
            
            const prompt = `Analyze this outfit. You are a high-end fashion consultant. Provide a "Fit Check" report. 
            Context: ${occasion ? `User is dressing for: ${occasion}` : 'No specific occasion provided.'}
            Format your response clearly:
            1. Style Summary (What's the vibe?)
            2. AI Rating (Out of 10)
            3. Coordination Feedback (Colors, fit, proportions)
            4. Suggested Improvements (Accessories, shoes, or layering)
            Be encouraging but honest and stylish.`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: {
                    parts: [
                        { inlineData: { data: base64, mimeType: file.type } },
                        { text: prompt }
                    ]
                }
            });

            setFeedback(response.text || "I'm speechless! (But really, something went wrong with the analysis).");
        } catch (e) {
            console.error(e);
            alert("Fashion emergency! Failed to analyze the fit.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <Label>Your Outfit Photo</Label>
                        <FileUploader 
                            accept="image/*" 
                            onFileSelect={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); }} 
                            previewUrl={preview}
                            onClear={() => { setFile(null); setPreview(null); setFeedback(null); }}
                            label="Upload a full-body mirror selfie"
                        />
                    </div>
                    <div className="flex flex-col justify-between">
                        <div>
                            <Label>Occasion (Optional)</Label>
                            <Input 
                                value={occasion} 
                                onChange={e => setOccasion(e.target.value)} 
                                placeholder="e.g. Summer Wedding, Job Interview, First Date"
                            />
                            <p className="text-xs text-gray-500 mt-2">Providing context helps the AI give better advice.</p>
                        </div>
                        <Button 
                            onClick={performFitCheck} 
                            disabled={loading || !file} 
                            className="w-full mt-8"
                        >
                            {loading ? 'Analyzing Your Swag...' : 'Check My Fit'}
                        </Button>
                    </div>
                </div>
            </Card>

            {loading && <Spinner message="Consulting the fashion oracle..." />}

            {feedback && (
                <Card className="p-8 bg-gray-900/40 border-purple-500/20 animate-fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white">Fit Check Report</h3>
                    </div>
                    <div className="prose prose-invert max-w-none">
                        <div className="whitespace-pre-wrap text-gray-300 leading-relaxed font-sans text-lg">
                            {feedback}
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};

// 4K Wallpaper Generator Tool
const Wallpaper4KTool: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
    const [useGrounding, setUseGrounding] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resultImg, setResultImg] = useState<string | null>(null);
    const [hasKey, setHasKey] = useState<boolean | null>(null);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio?.hasSelectedApiKey) {
                const selected = await window.aistudio.hasSelectedApiKey();
                setHasKey(selected);
            }
        };
        checkKey();
    }, []);

    const handleOpenKeyDialog = async () => {
        if (window.aistudio?.openSelectKey) {
            await window.aistudio.openSelectKey();
            setHasKey(true);
        }
    };

    const generateWallpaper = async () => {
        if (!prompt) return;
        setLoading(true);
        setResultImg(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts: [{ text: `${prompt}. High detail, cinematic, professional 4K ultra HD resolution.` }] },
                config: {
                    imageConfig: {
                        aspectRatio: aspectRatio as any,
                        imageSize: "4K"
                    },
                    tools: useGrounding ? [{ googleSearch: {} }] : undefined
                }
            });

            const parts = response.candidates?.[0]?.content?.parts;
            if (parts) {
                for (const part of parts) {
                    if (part.inlineData) {
                        setResultImg(`data:image/png;base64,${part.inlineData.data}`);
                        break;
                    }
                }
            }
        } catch (e) {
            const err = (e as any).message || "";
            if (err.includes("Requested entity was not found")) {
                setHasKey(false);
                alert("Please select a valid paid API key for 4K generation.");
            } else {
                console.error(e);
                alert("Generation failed. High-res tasks require specific project access.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (hasKey === false) {
        return (
            <Card className="p-8 text-center max-w-xl mx-auto space-y-6 animate-fade-in">
                <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold">API Key Selection Required</h3>
                <p className="text-gray-400">
                    To generate 4K high-resolution wallpapers using Gemini 3 Pro Image, you must select a billing-enabled API key from a paid Google Cloud project.
                </p>
                <div className="flex flex-col gap-3">
                    <Button onClick={handleOpenKeyDialog} className="w-full">Select Project API Key</Button>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-sm text-purple-400 hover:underline">Learn about Gemini API billing</a>
                </div>
            </Card>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <Label className="text-lg font-bold flex items-center gap-2">
                        Wallpaper Description
                        <span className="bg-purple-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest">4K Ultra HD</span>
                    </Label>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <input 
                            type="checkbox" 
                            id="grounding" 
                            checked={useGrounding} 
                            onChange={e => setUseGrounding(e.target.checked)}
                            className="w-4 h-4 accent-purple-600"
                        />
                        <label htmlFor="grounding">Use Search Grounding for Detail</label>
                    </div>
                </div>

                <TextArea 
                    value={prompt} 
                    onChange={e => setPrompt(e.target.value)} 
                    placeholder="e.g. A lush floating forest in the clouds, Bioluminescent plants, Ghibli style, evening light..."
                    className="min-h-[120px]"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label>Target Display</Label>
                        <div className="flex gap-2">
                            {(['16:9', '9:16', '1:1'] as const).map(ratio => (
                                <button
                                    key={ratio}
                                    onClick={() => setAspectRatio(ratio)}
                                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${aspectRatio === ratio ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                >
                                    {ratio === '16:9' ? 'Desktop' : ratio === '9:16' ? 'Mobile' : 'Square'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <Button onClick={generateWallpaper} disabled={loading || !prompt} className="w-full">
                    {loading ? 'Rendering 4K Canvas...' : 'Generate 4K Wallpaper'}
                </Button>
            </Card>

            {loading && <Spinner message="Gemini 3 Pro is meticulously rendering millions of pixels..." />}

            {resultImg && (
                <Card className="p-6 animate-fade-in group">
                    <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-700">
                        <img src={resultImg} alt="Generated 4K" className="w-full h-auto" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                             <a 
                                href={resultImg} 
                                download="4k-wallpaper.png" 
                                className="bg-white text-black px-10 py-3 rounded-full font-bold shadow-2xl hover:scale-105 transition-transform"
                             >
                                 Download 4K PNG
                             </a>
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-center text-gray-500 italic">"Resolution: 3840 x 2160 (Approx) • AI Rendered"</p>
                </Card>
            )}
        </div>
    );
};

// Search Data Hub Tool
const SearchDataExplorerTool: React.FC = () => {
    const [query, setQuery] = useState('');
    const [researchMode, setResearchMode] = useState('general');
    const [resultText, setResultText] = useState('');
    const [sources, setSources] = useState<{title: string, uri: string}[]>([]);
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState<string[]>([]);

    const handleDataSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResultText('');
        setSources([]);
        setInsights([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            const modePrompts: Record<string, string> = {
                general: "Research this topic and provide a comprehensive summary of facts.",
                market: "Analyze the current market trends, major players, and recent statistics for this topic.",
                competitive: "Perform a competitive analysis. Identify key competitors and their core offerings or recent news.",
                technical: "Extract deep technical details, specifications, or documentation-based facts about this topic."
            };

            const prompt = `Research Data Task: "${query}"
Mode: ${researchMode.toUpperCase()}
Instruction: ${modePrompts[researchMode]} 
Format: Provide a structured summary followed by a list of key data points (metrics, dates, entities).`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }]
                }
            });

            setResultText(response.text || 'No data found.');
            
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (chunks) {
                const extractedSources = chunks
                    .map((c: any) => c.web)
                    .filter((w: any) => w && w.uri)
                    .map((w: any) => ({ title: w.title || 'Untitled Source', uri: w.uri }));
                
                const uniqueSources = Array.from(new Set(extractedSources.map(s => s.uri)))
                    .map(uri => extractedSources.find(s => s.uri === uri)!);
                    
                setSources(uniqueSources);
            }

            const lines = (response.text || '').split('\n');
            const dataPoints = lines.filter(l => l.trim().startsWith('*') || l.trim().startsWith('-') || /\d+/.test(l)).slice(0, 8);
            setInsights(dataPoints);

        } catch (e) {
            console.error(e);
            setResultText("An error occurred while gathering research data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <Card className="p-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <Label>Search Query or Research Topic</Label>
                        <Input 
                            value={query} 
                            onChange={e => setQuery(e.target.value)} 
                            placeholder="e.g. Current semiconductor market cap trends 2025" 
                            onKeyDown={e => e.key === 'Enter' && handleDataSearch()}
                        />
                    </div>
                    <div className="md:w-64">
                        <Label>Research Mode</Label>
                        <select 
                            value={researchMode} 
                            onChange={e => setResearchMode(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-purple-500"
                        >
                            <option value="general">General Research</option>
                            <option value="market">Market Analysis</option>
                            <option value="competitive">Competitive Landscape</option>
                            <option value="technical">Technical Specs</option>
                        </select>
                    </div>
                </div>
                <Button 
                    onClick={handleDataSearch} 
                    disabled={loading || !query.trim()} 
                    className="w-full mt-6 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Gathering Data...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                            Explore Data
                        </>
                    )}
                </Button>
            </Card>

            {loading && <Spinner message="Querying live search engines and verifying data points..." />}

            {resultText && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    <Card className="lg:col-span-2 p-6 h-fit">
                        <Label className="text-purple-400 font-bold mb-4 block border-b border-gray-700 pb-2">Research Report</Label>
                        <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300">
                            <div className="whitespace-pre-wrap leading-relaxed">{resultText}</div>
                        </div>
                    </Card>

                    <div className="space-y-6">
                        {sources.length > 0 && (
                            <Card className="p-5">
                                <Label className="flex items-center gap-2 text-blue-400 font-bold mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                    </svg>
                                    Live Sources ({sources.length})
                                </Label>
                                <div className="space-y-3">
                                    {sources.map((src, i) => (
                                        <a 
                                            key={i} 
                                            href={src.uri} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="block p-3 bg-gray-900/50 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors group"
                                        >
                                            <div className="text-sm font-semibold text-gray-200 group-hover:text-white truncate mb-1">{src.title}</div>
                                            <div className="text-xs text-gray-500 truncate group-hover:text-gray-400">{src.uri}</div>
                                        </a>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {insights.length > 0 && (researchMode !== 'general') && (
                            <Card className="p-5 bg-purple-900/5 border-purple-500/20">
                                <Label className="text-purple-400 font-bold mb-4">Extracted Insights</Label>
                                <div className="space-y-2">
                                    {insights.map((insight, i) => (
                                        <div key={i} className="text-xs p-2 bg-gray-900 rounded border border-gray-800 text-gray-400 italic">
                                            {insight}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// 1. Chatbot Tool
const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      if (!chatRef.current) {
        chatRef.current = ai.chats.create({ model: 'gemini-3-flash-preview' });
      }

      const result = await chatRef.current.sendMessageStream({ message: userMsg });
      let fullText = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      for await (const chunk of result) {
        const text = chunk.text;
        fullText += text;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].text = fullText;
          return newMsgs;
        });
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto">
      <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-thin scrollbar-thumb-gray-800">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-lg">Start a conversation with Gemini.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'}`}>
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-tl-none px-5 py-3 border border-gray-700 flex gap-2 items-center">
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></span>
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-4 bg-gray-900/80 backdrop-blur-md border-t border-gray-800">
        <div className="flex gap-2">
          <Input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..." 
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

// 2. Image Generation
const ImageGeneration: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [numberOfImages, setNumberOfImages] = useState(1);

    const generate = async () => {
        if (!prompt) return;
        setLoading(true);
        setGeneratedImages([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const res = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: { 
                    numberOfImages: numberOfImages, 
                    aspectRatio: (aspectRatio as any), 
                    outputMimeType: 'image/jpeg' 
                },
            });
            const images = res.generatedImages?.map(img => 
                `data:image/jpeg;base64,${img.image.imageBytes}`
            ) || [];
            if (images.length > 0) setGeneratedImages(images);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <Card className="p-6 space-y-4">
                 <div className="flex flex-col gap-4">
                     <div className="flex-1">
                        <Label>Image Description</Label>
                        <TextArea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. A futuristic city made of crystal" className="min-h-[100px]" />
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <Label>Aspect Ratio</Label>
                            <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-purple-500">
                                <option value="1:1">1:1 Square</option>
                                <option value="16:9">16:9 Landscape</option>
                                <option value="9:16">9:16 Portrait</option>
                                <option value="4:3">4:3 Standard</option>
                                <option value="3:4">3:4 Standard</option>
                            </select>
                         </div>
                         <div>
                            <Label>Number of Images: {numberOfImages}</Label>
                            <div className="flex items-center gap-4 bg-gray-900 border border-gray-700 rounded-lg p-3">
                                <input type="range" min="1" max="4" value={numberOfImages} onChange={e => setNumberOfImages(parseInt(e.target.value))} className="w-full accent-purple-500 cursor-pointer" />
                                <span className="font-mono text-white font-bold w-4 text-center">{numberOfImages}</span>
                            </div>
                         </div>
                     </div>
                 </div>
                 <Button onClick={generate} disabled={loading || !prompt} className="w-full">
                     {loading ? 'Generating...' : `Generate ${numberOfImages} Image${numberOfImages > 1 ? 's' : ''}`}
                 </Button>
            </Card>

            <div className="min-h-[400px]">
                {loading ? (
                    <Spinner message="Imagen 4.0 is dreaming..." />
                ) : generatedImages.length > 0 ? (
                    <div className={`grid gap-6 ${generatedImages.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                        {generatedImages.map((img, idx) => (
                            <div key={idx} className="relative group rounded-xl overflow-hidden shadow-2xl">
                                <img src={img} alt={`Generated ${idx + 1}`} className="w-full h-auto object-contain border border-gray-700" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                    <a href={img} download={`generated-${idx + 1}.jpg`} className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors shadow-lg">Download</a>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

// Dedicated YouTube Thumbnail Tool
const YouTubeThumbnailTool: React.FC = () => {
    const [title, setTitle] = useState('');
    const [baseImage, setBaseImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [numberOfImages, setNumberOfImages] = useState(1);
    const [resultImages, setResultImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const generateThumbnails = async () => {
        if (!title) return;
        setLoading(true);
        setResultImages([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `YouTube thumbnail for: ${title}. High-impact, professional, cinematic lighting, vibrant colors, attention-grabbing. 16:9 aspect ratio.`;

            if (baseImage) {
                const base64 = await fileToBase64(baseImage);
                const generated: string[] = [];
                for (let i = 0; i < numberOfImages; i++) {
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        contents: {
                            parts: [
                                { inlineData: { data: base64, mimeType: baseImage.type } },
                                { text: `Transform this image into a professional YouTube thumbnail for: "${title}". Make it catchy with high contrast.` }
                            ]
                        },
                        config: { imageConfig: { aspectRatio: '16:9' } }
                    });

                    const parts = response.candidates?.[0]?.content?.parts;
                    if (parts) {
                        for (const part of parts) {
                            if (part.inlineData) {
                                generated.push(`data:image/png;base64,${part.inlineData.data}`);
                                break;
                            }
                        }
                    }
                }
                setResultImages(generated);
            } else {
                const res = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: prompt,
                    config: { 
                        numberOfImages: numberOfImages, 
                        aspectRatio: '16:9', 
                        outputMimeType: 'image/jpeg' 
                    },
                });
                const images = res.generatedImages?.map(img => 
                    `data:image/jpeg;base64,${img.image.imageBytes}`
                ) || [];
                setResultImages(images);
            }
        } catch (e) {
            console.error(e);
            alert("Thumbnail generation failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <Label>Video Topic / Title</Label>
                            <TextArea 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                placeholder="e.g. How to Build a Tech Empire from Zero" 
                                className="min-h-[120px]" 
                            />
                        </div>
                        <div>
                            <Label>Number of Variations: {numberOfImages}</Label>
                            <div className="flex items-center gap-4 bg-gray-900 border border-gray-700 rounded-lg p-3">
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="4" 
                                    value={numberOfImages} 
                                    onChange={e => setNumberOfImages(parseInt(e.target.value))} 
                                    className="w-full accent-purple-500 cursor-pointer" 
                                />
                                <span className="font-mono text-white font-bold w-4 text-center">{numberOfImages}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <Label>Base Image (Optional)</Label>
                        <FileUploader 
                            accept="image/*" 
                            onFileSelect={(f) => { setBaseImage(f); setPreviewUrl(URL.createObjectURL(f)); }} 
                            previewUrl={previewUrl}
                            onClear={() => { setBaseImage(null); setPreviewUrl(null); }}
                            label="Upload portrait or subject"
                        />
                    </div>
                </div>
                
                <Button 
                    onClick={generateThumbnails} 
                    disabled={loading || !title} 
                    className="w-full"
                >
                    {loading ? 'Designing Your Thumbnails...' : `Generate ${numberOfImages} Thumbnail${numberOfImages > 1 ? 's' : ''}`}
                </Button>
            </Card>

            {loading && <Spinner message="Gemini is analyzing click-rate trends and rendering your design..." />}

            {resultImages.length > 0 && (
                <div className={`grid gap-6 ${resultImages.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} animate-fade-in`}>
                    {resultImages.map((img, idx) => (
                        <Card key={idx} className="relative group overflow-hidden border border-gray-700 shadow-2xl">
                            <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-auto object-contain" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                <a 
                                    href={img} 
                                    download={`thumbnail-${idx + 1}.jpg`} 
                                    className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors shadow-lg"
                                >
                                    Download
                                </a>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// 3. Media Analyzer (Image/Video/Audio Understanding & Transcription)
const MediaAnalyzer: React.FC<{ 
  mode: 'image' | 'video' | 'audio', 
  title?: string, 
  transcription?: boolean 
}> = ({ mode, title, transcription }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(transcription ? 'Transcribe this file.' : 'Describe this content in detail.');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult('');
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const base64 = await fileToBase64(file);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: file.type } },
            { text: prompt }
          ]
        }
      });
      setResult(response.text || 'No response generated.');
    } catch (e) {
      console.error(e);
      setResult(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <Label>{title || `Upload ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}</Label>
        <FileUploader 
          accept={`${mode}/*`} 
          onFileSelect={handleFile} 
          previewUrl={preview} 
          onClear={() => { setFile(null); setPreview(null); setResult(''); }} 
        />
        <div className="mt-4">
           <Label>Instruction</Label>
           <TextArea value={prompt} onChange={e => setPrompt(e.target.value)} />
        </div>
        <Button onClick={handleProcess} disabled={!file || loading} className="w-full mt-4">
          {loading ? 'Processing...' : 'Analyze'}
        </Button>
      </Card>
      {result && (
        <Card className="p-6 bg-gray-800/80">
          <Label>Result</Label>
          <div className="prose prose-invert max-w-none whitespace-pre-wrap text-gray-300">
            {result}
          </div>
        </Card>
      )}
    </div>
  );
};

// 4. Video Studio (Generation & Animation)
const VideoStudio: React.FC<{ mode: 'text-to-video' | 'image-to-video' }> = ({ mode }) => {
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt && !imageFile) return;
    setLoading(true);
    setVideoUrl(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey && window.aistudio.openSelectKey) {
            await window.aistudio.openSelectKey();
        }
      }

      let operation;
      if (imageFile) {
        const base64 = await fileToBase64(imageFile);
        operation = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: prompt || "Animate this image",
          image: { imageBytes: base64, mimeType: imageFile.type },
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
      } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
      }

      while (!operation.done) {
        await new Promise(r => setTimeout(r, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (uri) {
        const vidRes = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await vidRes.blob();
        setVideoUrl(URL.createObjectURL(blob));
      }
    } catch (e) {
      console.error(e);
      alert('Generation failed. Ensure you have a paid project selected for Veo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <Card className="p-6">
         <div className="space-y-4">
           {mode === 'image-to-video' && (
             <div>
               <Label>Starting Image</Label>
               <FileUploader 
                 accept="image/*" 
                 onFileSelect={(f) => { setImageFile(f); setPreview(URL.createObjectURL(f)); }} 
                 previewUrl={preview} 
               />
             </div>
           )}
           <div>
             <Label>{mode === 'image-to-video' ? 'Animation Prompt' : 'Video Prompt'}</Label>
             <TextArea 
               value={prompt} 
               onChange={e => setPrompt(e.target.value)} 
               placeholder={mode === 'image-to-video' ? "e.g., Make the water flow and clouds move" : "e.g., A cinematic drone shot of a cyberpunk city"}
             />
           </div>
           <Button onClick={handleGenerate} disabled={loading || (!prompt && !imageFile)} className="w-full">
             {loading ? 'Generating Video (this may take a minute)...' : 'Generate Video'}
           </Button>
         </div>
       </Card>
       {loading && <Spinner message="Veo is rendering your video..." />}
       {videoUrl && (
         <Card className="p-4">
           <Label>Generated Video</Label>
           <video src={videoUrl} controls className="w-full rounded-lg" />
           <div className="mt-4 flex justify-end">
             <a href={videoUrl} download="generated_video.mp4" className="text-purple-400 hover:text-white underline">Download MP4</a>
           </div>
         </Card>
       )}
    </div>
  );
};

// 5. Image Editor
const ImageEditor: React.FC<{ mode: 'edit' | 'remove-bg' | 'studio' }> = ({ mode }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(mode === 'remove-bg' ? 'Remove the background and show the subject on a white background' : '');
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEdit = async () => {
    if (!file) return;
    setLoading(true);
    setResultImg(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const base64 = await fileToBase64(file);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64, mimeType: file.type } },
                { text: prompt }
            ]
        }
      });
      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
          for (const part of parts) {
              if (part.inlineData) {
                  setResultImg(`data:image/png;base64,${part.inlineData.data}`);
                  break;
              }
          }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <Label>Source Image</Label>
        <FileUploader accept="image/*" onFileSelect={(f) => { setFile(f); setPreview(URL.createObjectURL(f)); }} previewUrl={preview} />
        {mode !== 'remove-bg' && (
          <div className="mt-4">
            <Label>Edit Instruction</Label>
            <TextArea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. Add a red hat to the cat" />
          </div>
        )}
        <Button onClick={handleEdit} disabled={!file || loading} className="w-full mt-4">
          {loading ? 'Processing...' : mode === 'remove-bg' ? 'Remove Background' : 'Apply Edit'}
        </Button>
      </Card>
      {resultImg && (
        <Card className="p-6">
            <Label>Result</Label>
            <img src={resultImg} alt="Edited" className="w-full h-auto rounded-lg" />
            <div className="mt-4 text-right">
                <a href={resultImg} download="edited-image.png" className="text-purple-400 hover:text-white underline">Download Image</a>
            </div>
        </Card>
      )}
    </div>
  );
};

// 6. Grounded Search Tools
const GroundedSearchTool: React.FC<{ type: 'search' | 'trends' | 'keywords' | 'web-analysis' | 'scraping' }> = ({ type }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setResult('');
    setSources([]);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      let finalPrompt = query;
      if (type === 'trends') finalPrompt = `What are the current global trending topics in ${query || 'general news'}? Provide a list with context.`;
      if (type === 'keywords') finalPrompt = `Research keywords related to: "${query}". Provide volume estimates (low/med/high) and difficulty.`;
      if (type === 'web-analysis') finalPrompt = `Analyze this website/topic: "${query}". Provide SEO insights, performance notes, and content summary.`;
      if (type === 'scraping') finalPrompt = `Extract structured data (contact info, key points) from this url/topic: "${query}".`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: finalPrompt,
        config: { tools: [{ googleSearch: {} }] }
      });

      setResult(response.text || '');
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        setSources(chunks.map((c: any) => c.web).filter((w: any) => w));
      }
    } catch (e) {
      console.error(e);
      setResult('Failed to fetch results.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <Label>{type === 'search' ? 'Search Query' : type === 'trends' ? 'Category (Optional)' : type === 'keywords' ? 'Seed Keyword' : 'URL or Topic'}</Label>
        <div className="flex gap-2">
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Enter your query..." />
            <Button onClick={handleSearch} disabled={loading}>{loading ? 'Searching...' : 'Go'}</Button>
        </div>
      </Card>
      {result && (
        <Card className="p-6 bg-gray-800/80">
           <div className="prose prose-invert max-w-none mb-6">{result}</div>
           {sources.length > 0 && (
             <div className="border-t border-gray-700 pt-4">
               <Label>Sources</Label>
               <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                 {sources.map((src, i) => (
                   <li key={i}><a href={src.uri} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm truncate block">{src.title}</a></li>
                 ))}
               </ul>
             </div>
           )}
        </Card>
      )}
    </div>
  );
};

// 7. Blog Post Generator
const BlogPostGeneratorTool: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [keywords, setKeywords] = useState('');
    const [tone, setTone] = useState('Professional');
    const [loading, setLoading] = useState(false);
    const [blogPost, setBlogPost] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    const tones = ['Professional', 'Conversational', 'Creative', 'Humorous', 'Informative', 'Inspirational', 'Technical'];

    const handleGenerate = async () => {
        if (!topic) return;
        setLoading(true);
        setBlogPost('');
        setCopySuccess(false);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `As a professional with extensive knowledge of Google AdSense policies on AI-generated, thin, and low-value content, I want to monetize my website. I'm not strong in English and need guidance on writing compliant content to help Google AdSense approve my site. I'd like to invite you to help me write high-value content that will get my website approved. 

So I want you to write high-value content using common and simple english explaining things like a baby in primary school. 

I will provide a blog title and potentially some draft content or keywords. Kindly help me examine it and rewrite it (or generate it if only a title is provided), ensuring it is between 600 to 800 words and in compliance with AdSense policy. The article should give Google a signal of trust.

Blog Title: ${topic}
Draft Content/Keywords: ${keywords || 'None specified'}
Tone of voice: ${tone}

Requirements:
- Length: 600-800 words.
- E-E-A-T: Must demonstrate Experience, Expertise, Authoritativeness, and Trustworthiness.
- Structure: Catchy title, engaging introduction, subheadings (H2, H3), and a strong conclusion with a call to action.
- Language: Simple English, easy to understand.
- Policy: Strict compliance with Google AdSense policies regarding high-value content.

CRITICAL INSTRUCTION: Output ONLY the blog post content itself. Do not include any introductory text, meta-commentary, or mention these instructions in the final output. The output should start directly with the blog title.

Ensure the content is original, informative, and flows naturally. Do not use generic AI filler phrases.`;

            const res = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    temperature: 0.8,
                    topP: 0.95,
                }
            });

            setBlogPost(res.text || 'Failed to generate content.');
        } catch (e) {
            console.error(e);
            alert("Failed to generate blog post. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(blogPost);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 p-6 space-y-5 h-fit">
                    <div className="space-y-4">
                        <div>
                            <Label>Blog Topic / Title</Label>
                            <Input 
                                value={topic} 
                                onChange={e => setTopic(e.target.value)} 
                                placeholder="e.g. The Future of AI in Education"
                            />
                        </div>
                        <div>
                            <Label>Keywords or Draft Content (Optional)</Label>
                            <TextArea 
                                value={keywords} 
                                onChange={e => setKeywords(e.target.value)} 
                                placeholder="Paste your draft here or enter keywords to guide the AI..."
                                rows={5}
                            />
                        </div>
                        <div>
                            <Label>Tone of Voice</Label>
                            <select 
                                value={tone} 
                                onChange={e => setTone(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                {tones.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    <Button 
                        onClick={handleGenerate} 
                        disabled={loading || !topic} 
                        className="w-full"
                    >
                        {loading ? 'Crafting Your Post...' : 'Generate Blog Post'}
                    </Button>
                </Card>

                <div className="lg:col-span-2 space-y-6">
                    {loading && (
                        <Card className="p-12 flex flex-col items-center justify-center">
                            <Spinner message="Our AI writer is researching and drafting your 800-word masterpiece..." />
                        </Card>
                    )}

                    {!loading && blogPost && (
                        <Card className="p-8 bg-gray-900/40 border-purple-500/20 animate-fade-in relative group">
                            <button 
                                onClick={copyToClipboard}
                                className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-all border border-gray-700"
                                title="Copy to clipboard"
                            >
                                {copySuccess ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                )}
                            </button>
                            <div className="prose prose-invert max-w-none">
                                <div className="whitespace-pre-wrap text-gray-300 leading-relaxed font-sans text-lg">
                                    {blogPost}
                                </div>
                            </div>
                        </Card>
                    )}

                    {!loading && !blogPost && (
                        <div className="h-full min-h-[400px] border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center text-gray-600 p-10 text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <h3 className="text-xl font-medium text-gray-500">Ready to Write</h3>
                            <p className="max-w-xs mt-2">Enter a topic and select a tone to generate a high-quality blog post.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// 8. Blog Title Generator
const BlogTitleGeneratorTool: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [keywords, setKeywords] = useState('');
    const [loading, setLoading] = useState(false);
    const [titles, setTitles] = useState<string[]>([]);

    const handleGenerate = async () => {
        if (!topic) return;
        setLoading(true);
        setTitles([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `Generate 10 catchy, SEO-friendly blog titles for the topic: "${topic}".
            
            Keywords to include: ${keywords || 'None specified'}
            
            Requirements:
            - Titles should be engaging and drive clicks (click-through rate optimization).
            - Include a mix of styles: How-to, Listicle, Question, and Benefit-driven.
            - Keep them under 60 characters for optimal search engine display.
            - Ensure they are relevant to the topic and keywords.
            
            Return the titles as a simple list, one per line. Do not include numbers at the beginning.`;

            const res = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    temperature: 0.7,
                    topP: 0.95,
                }
            });

            const generatedTitles = res.text?.split('\n').filter(t => t.trim().length > 0).map(t => t.replace(/^\d+\.\s*/, '').trim()) || [];
            setTitles(generatedTitles);
        } catch (e) {
            console.error(e);
            alert("Failed to generate titles. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <Label>Main Topic</Label>
                            <Input 
                                value={topic} 
                                onChange={e => setTopic(e.target.value)} 
                                placeholder="e.g. Digital Marketing, Healthy Eating"
                            />
                        </div>
                        <div>
                            <Label>Target Keywords (Optional)</Label>
                            <Input 
                                value={keywords} 
                                onChange={e => setKeywords(e.target.value)} 
                                placeholder="e.g. beginners, 2024 trends, guide"
                            />
                        </div>
                        <Button 
                            onClick={handleGenerate} 
                            disabled={loading || !topic} 
                            className="w-full"
                        >
                            {loading ? 'Generating...' : 'Generate SEO Titles'}
                        </Button>
                    </div>
                    <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4 min-h-[200px]">
                        <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Generated Titles</h3>
                        {loading ? (
                            <div className="flex justify-center items-center h-32">
                                <Spinner />
                            </div>
                        ) : titles.length > 0 ? (
                            <ul className="space-y-3">
                                {titles.map((title, i) => (
                                    <li key={i} className="flex items-center justify-between gap-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-all group">
                                        <span className="text-gray-200 text-sm font-medium leading-tight">{title}</span>
                                        <button 
                                            onClick={() => copyToClipboard(title)}
                                            className="p-1.5 text-gray-500 hover:text-purple-400 transition-colors"
                                            title="Copy title"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h3m-3 4h3m-6-4h.01M9 16h.01" />
                                            </svg>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-600 italic text-sm">
                                <p>Titles will appear here...</p>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};

// 9. Generic Text Tools
const GenericTextTool: React.FC<{ toolId: string }> = ({ toolId }) => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRun = async () => {
        setLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            let model = 'gemini-3-flash-preview';
            let systemInstruction = '';
            let config: any = {};

            if (toolId === Tool.EmailMarketing) systemInstruction = "You are an expert email marketer. Generate professional, high-converting email copy.";
            if (toolId === Tool.AddressGeneration) systemInstruction = "Generate realistic fake addresses.";
            if (toolId === Tool.ThinkingMode) {
                model = 'gemini-3-pro-preview'; 
                config = { thinkingConfig: { thinkingBudget: 32768 } }; 
                systemInstruction = "Solve this complex problem step-by-step.";
            }
            if (toolId === Tool.LowLatency) model = 'gemini-flash-lite-latest';

            const res = await ai.models.generateContent({
                model,
                contents: input,
                config: { ...config, systemInstruction }
            });
            setOutput(res.text || '');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card className="p-6">
                <Label>Input / Prompt</Label>
                <TextArea value={input} onChange={e => setInput(e.target.value)} rows={5} />
                <Button onClick={handleRun} disabled={loading || !input} className="w-full mt-4">
                    {loading ? 'Generating...' : 'Generate'}
                </Button>
            </Card>
            {output && (
                <Card className="p-6">
                    <Label>Output</Label>
                    <div className="whitespace-pre-wrap text-gray-300">{output}</div>
                </Card>
            )}
        </div>
    );
};

// 8. Live Conversation
const LiveConversationTool: React.FC = () => {
    const [connected, setConnected] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const sessionRef = useRef<any>(null);
    
    const startSession = async () => {
        setConnected(true);
        setLogs(p => [...p, "Initializing audio context..."]);
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 16000});
            const outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 24000});
            const outputNode = outputAudioContext.createGain();
            outputNode.connect(outputAudioContext.destination);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let nextStartTime = 0;
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
                },
                callbacks: {
                    onopen: () => {
                        setLogs(p => [...p, "Connected! Speak now."]);
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const processor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        processor.onaudioprocess = (e) => {
                             const inputData = e.inputBuffer.getChannelData(0);
                             const blob = createAudioBlob(inputData);
                             sessionPromise.then(sess => sess.sendRealtimeInput({ media: blob }));
                        };
                        source.connect(processor);
                        processor.connect(inputAudioContext.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const data = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (data) {
                            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                            const buffer = await decodeAudioData(decode(data), outputAudioContext, 24000, 1);
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = buffer;
                            source.connect(outputNode);
                            source.start(nextStartTime);
                            nextStartTime += buffer.duration;
                        }
                    },
                    onclose: () => {
                        setLogs(p => [...p, "Session closed."]);
                        setConnected(false);
                    }
                }
            });

            sessionPromise.then(sess => { sessionRef.current = sess; });

        } catch (e) {
            setLogs(p => [...p, `Error: ${(e as Error).message}`]);
            setConnected(false);
        }
    };

    const stopSession = () => {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      setConnected(false);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <Card className="p-8 text-center space-y-6">
                <div className={`w-32 h-32 rounded-full mx-auto flex items-center justify-center transition-all ${connected ? 'bg-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.5)]' : 'bg-gray-800'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 ${connected ? 'text-red-500 animate-pulse' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </div>
                <div>
                    <h3 className="text-xl font-bold">{connected ? 'Live Session Active' : 'Start Live Conversation'}</h3>
                    <p className="text-gray-400 mt-2">Speak naturally with Gemini with low latency.</p>
                </div>
                {!connected ? (
                    <Button onClick={startSession} className="w-full">Connect & Speak</Button>
                ) : (
                    <div className="space-y-4">
                      <div className="bg-black/50 p-4 rounded-lg h-32 overflow-y-auto text-left text-xs font-mono text-green-400">
                          {logs.map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                      <Button onClick={stopSession} className="w-full from-red-600 to-red-800 hover:from-red-500 hover:to-red-700">End Session</Button>
                    </div>
                )}
            </Card>
        </div>
    );
};

// 9. Text to Speech
const TextToSpeech: React.FC = () => {
    const [text, setText] = useState('');
    const [voice, setVoice] = useState('Zephyr');
    const [loading, setLoading] = useState(false);
    const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr'];

    const handleSpeak = async () => {
        if (!text) return;
        setLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const res = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: { parts: [{ text }] },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
                }
            });
            const data = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (data) {
                const ctx = new AudioContext({ sampleRate: 24000 });
                const buffer = await decodeAudioData(decode(data), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <Card className="p-6 space-y-4">
                <div className="flex flex-col gap-2">
                    <Label>Select AI Voice</Label>
                    <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-purple-500 cursor-pointer">
                        {voices.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <Label>Text to Speak</Label>
                    <TextArea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Enter text that you want the AI to read aloud..." />
                </div>
                <Button onClick={handleSpeak} disabled={loading || !text} className="w-full">{loading ? 'Generating Audio...' : 'Speak'}</Button>
            </Card>
        </div>
    );
};

// 10. Image Converter
const ImageConverter: React.FC = () => {
    const [files, setFiles] = useState<FileList | null>(null);
    const [format, setFormat] = useState('image/png');
    const [canvasRef] = useState<HTMLCanvasElement>(document.createElement('canvas'));

    const handleConvert = () => {
        if (!files) return;
        Array.from(files).forEach((f) => {
            const file = f as File;
            const img = new Image();
            img.onload = () => {
                canvasRef.width = img.width;
                canvasRef.height = img.height;
                const ctx = canvasRef.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                const dataUrl = canvasRef.toDataURL(format);
                const link = document.createElement('a');
                link.download = `converted-${file.name.split('.')[0]}.${format.split('/')[1]}`;
                link.href = dataUrl;
                link.click();
            };
            img.src = URL.createObjectURL(file);
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Card className="p-6 space-y-4">
                <Label>Select Images</Label>
                <input type="file" multiple accept="image/*" onChange={e => setFiles(e.target.files)} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"/>
                <Label>Output Format</Label>
                <select value={format} onChange={e => setFormat(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3">
                    <option value="image/png">PNG</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/webp">WEBP</option>
                    <option value="image/bmp">BMP</option>
                </select>
                <Button onClick={handleConvert} disabled={!files} className="w-full">Convert & Download</Button>
            </Card>
        </div>
    );
};

// --- Main App Component ---
export default function App() {
  const [activeToolId, setActiveToolId] = useState<Tool>(Tool.VideoEditor);
  const activeTool = TOOLS.find(t => t.id === activeToolId);

  const renderTool = () => {
    switch (activeToolId) {
      case Tool.Chatbot: return <ChatInterface />;
      case Tool.ImageGeneration: return <ImageGeneration />;
      case Tool.YouTubeThumbnail: return <YouTubeThumbnailTool />;
      case Tool.Wallpaper4K: return <Wallpaper4KTool />;
      case Tool.FitCheck: return <FitCheckTool />;
      case Tool.VideoEditor: return <VideoEditorTool />;
      case Tool.ImageEditing: return <ImageEditor mode="edit" />;
      case Tool.NanoBananaStudio: return <ImageEditor mode="studio" />;
      case Tool.ImageBackgroundRemoval: return <ImageEditor mode="remove-bg" />;
      case Tool.ImageAnimation: return <VideoStudio mode="image-to-video" />;
      case Tool.VideoGeneration: return <VideoStudio mode="text-to-video" />;
      case Tool.ImageUnderstanding: return <MediaAnalyzer mode="image" />;
      case Tool.VideoUnderstanding: return <MediaAnalyzer mode="video" />;
      case Tool.VideoTranscription: return <MediaAnalyzer mode="video" transcription={true} />;
      case Tool.AudioTranscription: return <MediaAnalyzer mode="audio" transcription={true} />;
      case Tool.GroundedSearch: return <GroundedSearchTool type="search" />;
      case Tool.SearchDataExplorer: return <SearchDataExplorerTool />;
      case Tool.GlobalTrendingTopics: return <GroundedSearchTool type="trends" />;
      case Tool.KeywordsResearch: return <GroundedSearchTool type="keywords" />;
      case Tool.WebsiteAnalysis: return <GroundedSearchTool type="web-analysis" />;
      case Tool.WebScraping: return <GroundedSearchTool type="scraping" />;
      case Tool.TextToSpeech: return <TextToSpeech />;
      case Tool.LiveConversation: return <LiveConversationTool />;
      case Tool.ImageConverter: return <ImageConverter />;
      case Tool.BlogPostGenerator: return <BlogPostGeneratorTool />;
      case Tool.BlogTitleGenerator: return <BlogTitleGeneratorTool />;
      case Tool.EmailValidation: return (
        <div className="max-w-4xl mx-auto"><Card className="p-6"><Label>Email Validation</Label><p className="text-gray-400">Validate lists against disposable domains.</p><TextArea placeholder="Paste emails here..." className="mt-4"/></Card></div>
      );
      case Tool.EmailExtractor: return (
        <div className="max-w-4xl mx-auto"><Card className="p-6"><Label>Email Extractor</Label><p className="text-gray-400">Extract emails from text.</p><TextArea placeholder="Paste text here..." className="mt-4"/></Card></div>
      );
      default: return <GenericTextTool toolId={activeToolId} />;
    }
  };

  return (
    <div className="flex h-screen bg-black text-gray-100 font-sans selection:bg-purple-500/30">
      <aside className="w-72 bg-gray-900/50 border-r border-gray-800 flex flex-col backdrop-blur-sm z-20">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">Edukester</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-800">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveToolId(tool.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group text-left ${activeToolId === tool.id ? 'bg-purple-900/20 text-white shadow-lg border border-purple-500/20' : 'text-gray-400 hover:bg-gray-800'}`}
            >
              <div className={`${activeToolId === tool.id ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-300'}`}>{tool.icon}</div>
              <div className="font-medium text-sm">{tool.name}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-br from-gray-950 to-black relative">
        <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-xl px-8 py-6 z-10 sticky top-0">
          <div className="max-w-6xl mx-auto w-full flex items-start gap-5">
             <div className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-purple-400 shadow-xl mt-1">{activeTool?.icon}</div>
             <div className="flex-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">{activeTool?.name}</h2>
                <p className="text-gray-400 mt-2 text-sm leading-relaxed max-w-2xl">{activeTool?.description}</p>
             </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-gray-800">
           <div className="max-w-7xl mx-auto w-full">{renderTool()}</div>
        </div>
      </main>
    </div>
  );
}

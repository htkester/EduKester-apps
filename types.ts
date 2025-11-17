export enum Tool {
  Chatbot = 'Chatbot',
  ImageGeneration = 'ImageGeneration',
  ImageEditing = 'ImageEditing',
  NanoBananaStudio = 'NanoBananaStudio',
  ImageBackgroundRemoval = 'ImageBackgroundRemoval',
  ImageAnimation = 'ImageAnimation',
  ImageUnderstanding = 'ImageUnderstanding',
  VideoGeneration = 'VideoGeneration',
  VideoUnderstanding = 'VideoUnderstanding',
  VideoTranscription = 'VideoTranscription',
  LiveConversation = 'LiveConversation',
  GroundedSearch = 'GroundedSearch',
  ThinkingMode = 'ThinkingMode',
  AudioTranscription = 'AudioTranscription',
  TextToSpeech = 'TextToSpeech',
  LowLatency = 'LowLatency',
  YouTubeThumbnail = 'YouTubeThumbnail',
  ImageConverter = 'ImageConverter',
  AddressGeneration = 'AddressGeneration',
  GlobalTrendingTopics = 'GlobalTrendingTopics',
  KeywordsResearch = 'KeywordsResearch',
  WebsiteAnalysis = 'WebsiteAnalysis',
  WebScraping = 'WebScraping',
  EmailMarketing = 'EmailMarketing',
  EmailValidation = 'EmailValidation',
  EmailExtractor = 'EmailExtractor',
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type VideoAspectRatio = "16:9" | "9:16";

// --- Email Marketing Tool Types ---
export interface Contact {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface ContactList {
  id: string;
  name: string;
  contacts: Contact[];
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  content: string;
  audienceListIds: string[];
  status: 'Draft' | 'Sending' | 'Sent';
  stats: {
    recipients: number;
    openRate: number; // Percentage
    clickRate: number; // Percentage
  };
  createdAt: string;
  sentAt?: string;
}


// Define a type for window.aistudio for Veo API key selection
declare global {
  // Fix: Resolve TypeScript error with subsequent property declarations by moving the AIStudio interface
  // inside the `declare global` block. This prevents module scope conflicts when augmenting the
  // global `window` object, ensuring a consistent type definition for 'aistudio'.
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    webkitAudioContext: typeof AudioContext;
  }
}
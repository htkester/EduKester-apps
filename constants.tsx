import React from 'react';
import { Tool } from './types';

const iconClasses = "h-6 w-6 mr-3 text-gray-400 group-hover:text-white transition-colors";

export const TOOLS = [
  // --- Conversational ---
  {
    id: Tool.Chatbot,
    name: 'Chatbot',
    description: 'Engage in a fluid, multi-turn conversation with the powerful Gemini Flash model.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
  },
  {
    id: Tool.LiveConversation,
    name: 'Live Conversation',
    description: 'Experience a real-time, low-latency voice conversation with Gemini.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
  },
  // --- Image ---
  {
    id: Tool.ImageGeneration,
    name: 'Image Generation',
    description: 'Create stunning, high-resolution images from simple text prompts using Imagen 4.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  },
  {
    id: Tool.ImageEditing,
    name: 'Image Editing',
    description: 'Perform complex image edits and manipulations using simple, natural language instructions.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
  },
  {
    id: Tool.NanoBananaStudio,
    name: 'Image Studio',
    description: 'An iterative playground for image editing and creation powered by the Gemini Flash Image (Nano Banana) model.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
  },
  {
    id: Tool.ImageBackgroundRemoval,
    name: 'Background Remover',
    description: 'Automatically remove the background from any image with a single click.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-2.293-2.293a1 1 0 010-1.414l6-6a1 1 0 011.414 0z" /></svg>
  },
  {
    id: Tool.ImageAnimation,
    name: 'Image Animation',
    description: 'Bring static images to life by animating specific elements with text prompts.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      </svg>
    ),
  },
   {
    id: Tool.ImageUnderstanding,
    name: 'Image Understanding',
    description: 'Gain deep insights from your images. Ask questions, get descriptions, and identify objects.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
  },
  {
    id: Tool.YouTubeThumbnail,
    name: 'YouTube Thumbnail',
    description: 'Creates professional 16:9 thumbnails by automatically replacing the background with an AI-generated, eye-catching design and adding custom text.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 8h-6" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4" />
      </svg>
    )
  },
  {
    id: Tool.ImageConverter,
    name: 'Image Converter',
    description: 'Convert images between over 10 formats, including PNG, JPEG, WEBP, and experimental SVG.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
  },
  // --- Video ---
  {
    id: Tool.VideoGeneration,
    name: 'Video Generation',
    description: 'Produce high-quality videos from text prompts or by animating a starting image with Veo.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
  },
  {
    id: Tool.VideoUnderstanding,
    name: 'Video Understanding',
    description: 'Analyze video content from a URL to answer questions, summarize, and extract key information.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
  },
  {
    id: Tool.VideoTranscription,
    name: 'Video Transcription',
    description: 'Accurately transcribe spoken content from video files, with potential speaker identification.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12h4m-2 2v-4" /></svg>
  },
  // --- Audio & Speech ---
  {
    id: Tool.AudioTranscription,
    name: 'Audio Transcription',
    description: 'Quickly and accurately convert spoken words from any audio file into written text.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
  },
  {
    id: Tool.TextToSpeech,
    name: 'Text to Speech',
    description: 'Transform text into natural-sounding, human-like speech with a variety of voices.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
  },
  // --- Web & SEO ---
  {
    id: Tool.GroundedSearch,
    name: 'Grounded Search',
    description: 'Get reliable, up-to-date answers from the web, complete with source citations.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10l6 6m0-6l-6 6" /></svg>
  },
  {
    id: Tool.GlobalTrendingTopics,
    name: 'Trending Topics',
    description: 'Stay ahead of the curve by discovering the latest trending topics across various categories globally.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" /></svg>
  },
  {
    id: Tool.KeywordsResearch,
    name: 'Keywords Research',
    description: 'Uncover valuable keyword opportunities, including long-tail and question-based queries, with volume and difficulty estimates.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7m10-4a6 6 0 10-12 0 6 6 0 0012 0z"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35"/>
    </svg>
  },
  {
    id: Tool.WebsiteAnalysis,
    name: 'Website Analysis',
    description: 'Receive a comprehensive report on any website covering SEO, performance, accessibility, and actionable insights.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M12 18v-3m0-6V6m-6 6h3m6 0h3" />
    </svg>
  },
  {
    id: Tool.WebScraping,
    name: 'Web Scraper',
    description: 'Automatically extract structured data like contact info and summaries from any webpage.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h10a2 2 0 002-2v-1a2 2 0 012-2h1.945M7.8 17.2a.2.2 0 00-.354.145l-1 4.5a.2.2 0 00.354.25l-1.224-1.224a.2.2 0 01.282 0l1.224 1.224a.2.2 0 00.354-.25l-1-4.5a.2.2 0 00-.354-.145l-1.121.747zM16.2 17.2a.2.2 0 01.354.145l1 4.5a.2.2 0 01-.354.25l-1.224-1.224a.2.2 0 00-.282 0l-1.224 1.224a.2.2 0 01-.354-.25l1-4.5a.2.2 0 01.354-.145l1.121.747zM12 10a5 5 0 110-10 5 5 0 010 10z"/>
    </svg>
  },
  // --- Utility & Advanced ---
  {
    id: Tool.EmailMarketing,
    name: 'Email Marketing',
    description: 'Create, manage, and send bulk email campaigns with AI-powered content generation.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
  },
  {
    id: Tool.EmailValidation,
    name: 'Email Validation',
    description: 'Clean and verify email lists by checking for syntax errors, disposable domains, and duplicates.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
  },
  {
    id: Tool.EmailExtractor,
    name: 'Email Extractor',
    description: 'Find and pull all email addresses from a block of text.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
  },
  {
    id: Tool.AddressGeneration,
    name: 'Address Generator',
    description: 'Generate realistic, randomized addresses for any country or specify a city.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  },
  {
    id: Tool.ThinkingMode,
    name: 'Thinking Mode',
    description: 'Leverage Gemini Pro\'s deep reasoning capabilities to solve complex, multi-step problems.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
  },
  {
    id: Tool.LowLatency,
    name: 'Low Latency',
    description: 'Get lightning-fast, "thinking-free" responses for simple questions and tasks.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" className={iconClasses} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  },
];
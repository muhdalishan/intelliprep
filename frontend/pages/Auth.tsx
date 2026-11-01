import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../components/UIComponents';
import { 
  BookOpen, BrainCircuit, Users, CheckSquare, Layers, FileText, 
  ArrowRight, Shield, Clock, Flame, CheckCircle, GraduationCap,
  ArrowLeft, Columns, Layout, Plus, Search, HelpCircle, Laptop,
  Lightbulb, ChevronRight, Play, CheckCircle2, Sparkles, Medal, Star, Bolt
} from 'lucide-react';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('student@demo.com');
  const [password, setPassword] = useState('password');
  
  // Interactive preview state in Hero Section
  const [activeScreen, setActiveScreen] = useState<'screen1' | 'screen2' | 'screen3'>('screen1');
  const [isFlipped, setIsFlipped] = useState(false); // For 3D card preview

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('isAuthenticated', 'true');
    if (!isLogin && userName) {
      localStorage.setItem('userName', userName);
    } else if (isLogin && !localStorage.getItem('userName')) {
      localStorage.setItem('userName', 'Scholar');
    }
    navigate('/dashboard');
  };

  const triggerAuth = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setShowAuthModal(true);
  };

  const featuresList = [
    {
      title: "AI Summaries",
      description: "Synthesize textbook modules or lecture notes into beautiful, scannable summaries in single-click actions.",
      illustration: (
        <div className="h-32 w-full border-b border-slate-100 dark:border-slate-800/80 bg-blue-50/40 dark:bg-blue-950/20 flex items-center justify-center overflow-hidden relative group-hover:bg-blue-100/60 dark:group-hover:bg-blue-900/30 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative w-36 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3 transform transition-transform duration-500 group-hover:-translate-y-1">
            <div className="animate-pulse flex space-x-2 items-center mb-3">
              <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/50 rounded flex items-center justify-center">
                <FileText className="w-2.5 h-2.5 text-blue-500" />
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded"></div>
              <div className="h-1.5 w-5/6 bg-slate-100 dark:bg-slate-700 rounded"></div>
              <div className="h-1.5 w-4/6 bg-slate-100 dark:bg-slate-700 rounded"></div>
              <div className="h-1.5 w-full bg-blue-50 dark:bg-blue-900/20 rounded mt-2"></div>
              <div className="h-1.5 w-2/3 bg-blue-50 dark:bg-blue-900/20 rounded"></div>
            </div>
            
            <div className="absolute -right-3 -bottom-3 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800 transform rotate-12 group-hover:rotate-0 transition-transform duration-300">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Practice Quizzes",
      description: "Auto-generate diagnostic multi-choice questions covering your documents to test memory retention safely.",
      illustration: (
        <div className="h-32 w-full border-b border-emerald-100 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-center overflow-hidden relative group-hover:bg-emerald-100/60 dark:group-hover:bg-emerald-900/30 transition-colors">
          <div className="relative w-40 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-3 transform transition-transform duration-500 group-hover:translate-x-1">
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-3"></div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600"></div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 transform group-hover:scale-[1.02] transition-transform">
                <div className="w-3 h-3 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <CheckCircle className="w-2 h-2" />
                </div>
                <div className="h-1.5 bg-emerald-700/50 dark:bg-emerald-400/50 rounded w-20"></div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600"></div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded w-12"></div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Flashcards Room",
      description: "Study key vocabulary modules with rapid 3D flipping interfaces styled for zero distractions.",
      illustration: (
        <div className="h-32 w-full border-b border-amber-100 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-center overflow-hidden relative perspective-1000 group-hover:bg-amber-100/60 dark:group-hover:bg-amber-900/30 transition-colors">
          <div className="relative w-32 h-20 transform-style-3d transition-transform duration-700 group-hover:rotate-y-180">
            {/* Front of card */}
            <div className="absolute inset-0 backface-hidden bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-3">
               <Layers className="w-5 h-5 text-amber-500 mb-2" />
               <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
            {/* Back of card */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-amber-500 rounded-xl shadow-md flex flex-col items-center justify-center p-3 text-white">
               <div className="h-1.5 w-full bg-white/40 rounded mb-1.5"></div>
               <div className="h-1.5 w-5/6 bg-white/40 rounded mb-1.5"></div>
               <div className="h-1.5 w-4/6 bg-white/40 rounded"></div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Exam Guess Engine",
      description: "Estimate textbook blueprint probabilities using deep prediction pipelines built for prompt discovery.",
      illustration: (
        <div className="h-32 w-full border-b border-indigo-100 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-center justify-center overflow-hidden relative group-hover:bg-indigo-100/60 dark:group-hover:bg-indigo-900/30 transition-colors">
          <div className="relative w-40 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 transform transition-transform duration-500 group-hover:-translate-y-1">
            <div className="flex items-end gap-2 h-12 mb-2 items-baseline">
              <div className="w-1/4 bg-indigo-200 dark:bg-indigo-900/50 rounded-t h-4 transition-all duration-700 group-hover:h-6"></div>
              <div className="w-1/4 bg-indigo-300 dark:bg-indigo-800/60 rounded-t h-6 transition-all duration-700 group-hover:h-8"></div>
              <div className="w-1/4 bg-indigo-500 dark:bg-indigo-700/70 rounded-t h-8 transition-all duration-700 group-hover:h-12 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity delay-300">92%</div>
              </div>
              <div className="w-1/4 bg-indigo-100 dark:bg-indigo-900/30 rounded-t h-3 transition-all duration-700 group-hover:h-5"></div>
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="h-1 w-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
              <div className="h-1 w-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Planner Kanban",
      description: "Visualize work states cleanly in responsive columns to manage your weekly semester goals physically.",
      illustration: (
        <div className="h-32 w-full border-b border-violet-100 dark:border-violet-800/80 bg-violet-50/40 dark:bg-violet-950/20 flex items-center justify-center overflow-hidden relative group-hover:bg-violet-100/60 dark:group-hover:bg-violet-900/30 transition-colors">
          <div className="flex gap-2 transform transition-transform duration-500 group-hover:scale-105">
            <div className="w-12 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700 p-1.5 flex flex-col gap-1.5">
              <div className="h-1.5 w-6 bg-slate-300 dark:bg-slate-600 rounded"></div>
              <div className="h-6 w-full bg-slate-100 dark:bg-slate-700/50 rounded border border-slate-200 dark:border-slate-600/50"></div>
              <div className="h-6 w-full bg-slate-100 dark:bg-slate-700/50 rounded border border-slate-200 dark:border-slate-600/50"></div>
            </div>
            <div className="w-12 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700 p-1.5 flex flex-col gap-1.5">
              <div className="h-1.5 w-6 bg-violet-300 dark:bg-violet-600 rounded mb-4"></div>
              <div className="h-6 w-full bg-violet-50 dark:bg-violet-900/30 rounded border border-violet-200 dark:border-violet-800/50 absolute top-5 transform transition-all duration-700 group-hover:translate-x-14 group-hover:-rotate-3 z-10 shadow-md"></div>
            </div>
            <div className="w-12 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-700 p-1.5 flex flex-col gap-1.5">
              <div className="h-1.5 w-6 bg-emerald-300 dark:bg-emerald-600 rounded"></div>
              <div className="h-6 w-full bg-slate-100 dark:bg-slate-700/50 rounded border border-slate-200 dark:border-slate-600/50"></div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Group Study Guild",
      description: "Synchronize study sprints together with live online timers, shared dashboards and team whiteboards.",
      illustration: (
         <div className="h-32 w-full border-b border-rose-100 dark:border-rose-800/80 bg-rose-50/40 dark:bg-rose-950/20 flex items-center justify-center overflow-hidden relative group-hover:bg-rose-100/60 dark:group-hover:bg-rose-900/30 transition-colors">
          <div className="w-40 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 transform transition-transform duration-500 group-hover:-translate-y-1">
            <div className="flex justify-between items-center mb-3">
              <div className="flex -space-x-1.5">
                <div className="w-5 h-5 rounded-full bg-rose-400 border border-white dark:border-slate-800 z-30"></div>
                <div className="w-5 h-5 rounded-full bg-emerald-400 border border-white dark:border-slate-800 z-20"></div>
                <div className="w-5 h-5 rounded-full bg-amber-400 border border-white dark:border-slate-800 z-10"></div>
              </div>
              <div className="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                <span className="w-1 h-1 rounded-full bg-rose-500"></span> Live
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700 p-2 flex items-center justify-center">
               <span className="font-mono text-sm text-slate-800 dark:text-slate-200 font-bold tracking-widest">24:59</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  const stepsList = [
    {
      step: "01",
      title: "Create your workspace",
      description: "Construct folders or central lecture lists for your subjects.",
      icon: <Plus className="w-6 h-6 text-primary-500" />
    },
    {
      step: "02",
      title: "Add your courses",
      description: "Paste loose documents, upload pdf slides or enter core syllabus outlines.",
      icon: <FileText className="w-6 h-6 text-primary-500" />
    },
    {
      step: "03",
      title: "Study smarter with AI",
      description: "Estimate probabilities, flash adaptive modules, and take targeted questionnaires.",
      icon: <BrainCircuit className="w-6 h-6 text-primary-500" />
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 selection:bg-primary-500/30 overflow-x-hidden relative">
      
      {/* Background Gradients matching image */}
      <div className="absolute top-0 inset-x-0 h-[800px] pointer-events-none -z-10 bg-gradient-to-br from-teal-50/50 via-white to-primary-50 dark:from-slate-950 dark:via-slate-950 dark:to-primary-950/20" />
      <div className="absolute top-1/4 -right-60 w-[600px] h-[600px] rounded-full bg-primary-100/50 dark:bg-primary-950/20 blur-[130px] pointer-events-none -z-10" />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-teal-100/40 dark:bg-teal-950/20 blur-[130px] pointer-events-none -z-10" />

      {/* 1. Header component */}
      <header className="bg-transparent sticky top-0 z-40 transition-colors">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-[1.35rem] tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 text-transparent bg-clip-text">IntelliPrep AI</span>
            </div>
          </div>
          
          <div className="flex items-center gap-5">
            <button 
              onClick={() => triggerAuth(true)}
              className="text-sm font-bold text-slate-600 dark:text-slate-350 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Log in
            </button>
            <button 
              onClick={() => triggerAuth(false)}
              className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold tracking-tight rounded-xl py-2.5 px-5 shadow-lg shadow-primary-500/25 active:scale-95 transition-all"
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Segment */}
      <section className="relative pt-12 pb-24 lg:pt-20 lg:pb-32">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-10 items-center">
          
          {/* Hero text side */}
          <div className="lg:col-span-5 space-y-7 text-left xl:pr-10">
            {/* Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 text-[11.5px] font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered Academic Workspace
            </div>
            
            {/* Display Headline */}
            <h1 className="text-5xl sm:text-6xl xl:text-7xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.05]">
              Study smarter.<br />
              <span className="text-primary-600 dark:text-primary-400">Score higher.</span>
            </h1>
            
            <p className="text-base sm:text-[1.05rem] text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
              IntelliPrep AI combines personalized AI summaries, adaptive quizzes, and predicted exam topics — so you can prepare confidently and efficiently.
            </p>
            
            {/* CTA Trigger Row */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button 
                onClick={() => triggerAuth(false)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-extrabold rounded-xl h-12 px-7 shadow-lg shadow-primary-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Start for free <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>
              <button 
                onClick={() => {
                  const el = document.getElementById('how-it-works');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-extrabold rounded-xl h-12 px-7 shadow-sm cursor-pointer transition-colors"
              >
                Watch demo
              </button>
            </div>
            
          </div>

          {/* Hero interactive screen preview side */}
          <div className="lg:col-span-7 relative rotate-1 hover:rotate-0 transition-transform duration-500 w-full xl:w-[110%] xl:-mr-[10%]">
            
            {/* Simulated Browser Floating Element */}
            <div className="w-full bg-slate-50/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[23px] shadow-2xl overflow-hidden backdrop-blur-xl">
              
              {/* Browser Application Header (Violet Style) */}
              <div className="bg-primary-500 dark:bg-primary-900 pt-4 pb-3 px-4 flex items-center gap-3">
                <div className="flex gap-1.5 shrink-0 pl-1">
                  <span className="w-3 h-3 rounded-full bg-white/40"></span>
                  <span className="w-3 h-3 rounded-full bg-white/40"></span>
                  <span className="w-3 h-3 rounded-full bg-white/40"></span>
                </div>
                <div className="flex-1 bg-primary-600 dark:bg-slate-950/40 rounded-lg py-1.5 px-4 max-w-md mx-auto flex items-center text-primary-100 dark:text-primary-300 text-xs font-mono shadow-inner border border-primary-400/50 dark:border-transparent">
                  <span className="opacity-70">intelliprep.ai/dashboard</span>
                </div>
              </div>

              {/* Browser Viewport Area matching image card */}
              <div className="p-6 md:p-8 flex flex-col gap-5">
                
                {/* Welcome Card matching image exact layout */}
                <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-850 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                  <div className="text-left">
                    <h4 className="font-extrabold text-[15px] text-slate-800 dark:text-white mb-1">
                      Welcome back, Scholar 👋
                    </h4>
                    <p className="text-xs text-slate-400 font-medium">
                      You have 3 upcoming exams
                    </p>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0 shadow-sm border border-amber-100 dark:border-amber-900/30">
                    <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span>5 days</span>
                  </div>
                </div>

                {/* Progress Cards Split block */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-850 p-4 sm:p-5 text-left flex flex-col gap-2">
                    <h5 className="font-extrabold text-[13px] text-slate-800 dark:text-white">Calculus II</h5>
                    <div className="space-y-1.5 mt-2">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                        <div className="bg-primary-500 h-full w-[72%] rounded-full"></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium pt-0.5">72% proficiency</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-850 p-4 sm:p-5 text-left flex flex-col gap-2">
                    <h5 className="font-extrabold text-[13px] text-slate-800 dark:text-white">Data Structures</h5>
                    <div className="space-y-1.5 mt-2">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                        <div className="bg-primary-500 h-full w-[58%] rounded-full"></div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium pt-0.5">58% proficiency</p>
                    </div>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-850 p-4 flex items-center justify-between mt-1">
                  <div className="flex items-center gap-3">
                    <div className="text-left ml-2 sm:ml-4">
                      <span className="text-[13px] font-extrabold text-slate-800 dark:text-white block">Exam Ready</span>
                      <span className="text-[9px] font-medium text-slate-400 block mt-0.5">Continuity • 2 min read</span>
                    </div>
                  </div>
                  <div className="pr-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4. "Everything you need to excel" section (Image 2 representation) */}
      <section id="features" className="py-20 bg-[#fafafa] dark:bg-slate-950/20 text-center border-b border-slate-200/50 dark:border-slate-900/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-xl mx-auto mb-16 text-center">
            <h2 className="text-3xl font-black text-slate-950 dark:text-white tracking-tight leading-tight">
              Everything you need to excel
            </h2>
            <div className="w-20 h-1 bg-slate-350 dark:bg-slate-800 mx-auto mt-3.5 rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuresList.map((feat, index) => (
              <div 
                key={index} 
                className="flex flex-col text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group overflow-hidden"
              >
                {/* The card content wireframe placeholder on top */}
                {feat.illustration}
                
                {/* Information content at bottom of card */}
                <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight group-hover:text-primary-600 transition-colors">
                      {feat.title}
                    </h4>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 lines-clamp-3 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                  <button 
                    onClick={() => triggerAuth(false)}
                    className="text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1 mt-3 transition-colors uppercase tracking-wider"
                  >
                    Quick try this module <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. "How it works" section (Image 2 bottom representation) */}
      <section id="how-it-works" className="py-20 bg-white dark:bg-slate-950 text-center border-b border-slate-200/50 dark:border-slate-900/60 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-xl mx-auto mb-20 text-center">
            <h2 className="text-3xl font-black text-slate-950 dark:text-white tracking-tight leading-tight">
              How it works
            </h2>
            <div className="w-20 h-1 bg-slate-350 dark:bg-slate-800 mx-auto mt-3.5 rounded-full animate-pulse"></div>
          </div>

          {/* Flowchart Container */}
          <div className="relative max-w-5xl mx-auto">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-[2.25rem] left-[16.66%] right-[16.66%] h-0.5 bg-slate-200 dark:bg-slate-800 pointer-events-none"></div>
            
            {/* Connecting Line (Mobile) */}
            <div className="block md:hidden absolute top-[2.25rem] bottom-[2.25rem] left-[2.25rem] w-0.5 bg-slate-200 dark:bg-slate-800 pointer-events-none"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 relative z-10">
              {stepsList.map((st, idx) => (
                <div key={idx} className="flex flex-row md:flex-col items-start md:items-center text-left md:text-center group relative cursor-pointer">
                  {/* Flowchart Node */}
                  <div className="w-[4.5rem] h-[4.5rem] rounded-2xl bg-white dark:bg-slate-900 border-4 border-slate-50 dark:border-slate-950 shadow-md flex items-center justify-center shrink-0 group-hover:-translate-y-1 group-hover:shadow-lg transition-all duration-300 z-10 mx-0 md:mx-auto relative bg-white dark:bg-slate-900">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                      {st.icon}
                    </div>
                    {/* Step label badge */}
                    <div className="absolute -top-3 -right-3 md:-right-2 w-7 h-7 rounded-full bg-slate-900 dark:bg-primary-500 text-white font-black text-[10px] flex items-center justify-center shadow-sm">
                      {st.step}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="ml-6 md:ml-0 md:mt-8 flex flex-col items-start md:items-center flex-1">
                    <h4 className="font-extrabold text-base text-slate-950 dark:text-white tracking-tight mb-2.5 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {st.title}
                    </h4>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed md:px-4 max-w-[280px]">
                      {st.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. "Ready to ace your exams?" CTA section (Image 3 bottom wireframe call-to-action) */}
      <section id="pricing" className="py-20 bg-slate-900 dark:bg-slate-950 text-white text-center border-b border-black">
        <div className="max-w-4xl mx-auto px-6 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to ace your exams?
          </h2>
          <div className="w-20 h-1 bg-slate-750 mx-auto rounded-full"></div>
          
          <div className="flex justify-center items-center gap-3 pt-4">
            <button 
              onClick={() => triggerAuth(false)}
              className="bg-white text-slate-950 hover:bg-slate-100 text-xs sm:text-sm font-extrabold rounded-lg py-3 px-6 active:scale-95 transition-all cursor-pointer"
            >
              Create free account
            </button>
            <button 
              onClick={() => triggerAuth(true)}
              className="bg-slate-900 hover:bg-slate-850 text-white border border-slate-800 text-xs sm:text-sm font-extrabold rounded-lg py-3 px-6 active:scale-95 transition-all cursor-pointer"
            >
              Sign in
            </button>
          </div>

          <p className="text-[10px] text-slate-450 uppercase font-mono tracking-wider pt-2">
            No credit card required • Free forever plan
          </p>
        </div>
      </section>

      {/* 8. Minimalist exact footer (Image 3 section) */}
      <footer id="about" className="bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 py-16 text-xs transition-colors border-t border-slate-200 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
          
          <div className="md:col-span-6 space-y-4 text-left">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-950 dark:bg-slate-200 rounded flex items-center justify-center text-white dark:text-slate-900 font-extrabold text-xs">
                I
              </div>
              <span className="font-extrabold text-slate-900 dark:text-white tracking-tight">IntelliPrep AI</span>
            </div>
            <p className="text-slate-400 dark:text-slate-500 max-w-sm leading-relaxed">
              Academic workspaces designed strictly for memory reinforcement, custom prediction models and collaborative study groups.
            </p>
          </div>

          <div className="md:col-span-2 text-left">
            <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[10px] mb-3">Product</h5>
            <ul className="space-y-2 font-medium text-slate-500 dark:text-slate-400">
              <li><a href="#features" className="hover:text-slate-900 dark:hover:text-white">Features</a></li>
              <li><a href="#pricing" className="hover:text-slate-900 dark:hover:text-white">Pricing</a></li>
              <li><a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white">Changelog</a></li>
            </ul>
          </div>

          <div className="md:col-span-2 text-left">
            <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[10px] mb-3">Company</h5>
            <ul className="space-y-2 font-medium text-slate-500 dark:text-slate-400">
              <li><span className="hover:text-slate-900 dark:hover:text-white cursor-pointer">About</span></li>
              <li><span className="hover:text-slate-900 dark:hover:text-white cursor-pointer">Blog</span></li>
              <li><span className="hover:text-slate-900 dark:hover:text-white cursor-pointer">Careers</span></li>
            </ul>
          </div>

          <div className="md:col-span-2 text-left">
            <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-[10px] mb-3">Legal</h5>
            <ul className="space-y-2 font-medium text-slate-500 dark:text-slate-400">
              <li><span className="hover:text-slate-900 dark:hover:text-white cursor-pointer">Privacy</span></li>
              <li><span className="hover:text-slate-900 dark:hover:text-white cursor-pointer">Terms</span></li>
              <li><span className="hover:text-slate-900 dark:hover:text-white cursor-pointer">Cookies</span></li>
            </ul>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-slate-200/50 dark:border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-slate-400 dark:text-slate-500 font-medium">
            IntelliPrep AI © 2026. Secure, private on-device cloud-hosted study systems.
          </p>
          <div className="flex gap-4">
            <div className="font-mono text-[10px] tracking-wide text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">BS(CS) Final Year Project · UCP</div>
          </div>
        </div>
      </footer>

      {/* 9. Authentic Interactive login modal representing Image 5 exactly! */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 relative shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            
            {/* Back to home trigger */}
            <button 
              onClick={() => setShowAuthModal(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-[11px] font-bold flex items-center gap-1.5 mb-5 outline-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to home
            </button>

            {/* Brand details matching Image 5 */}
            <div className="space-y-1 mb-6">
              <h3 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                {isLogin ? 'Sign in to IntelliPrep AI' : 'Join IntelliPrep AI'}
              </h3>
              <div className="w-16 h-1 bg-[#14b8a6]/70 rounded-full"></div>
            </div>

            {/* Continue with Google button */}
            <button 
              type="button"
              onClick={handleAuth}
              className="w-full bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all text-center"
            >
              {/* Simple inline G Google SVG */}
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.13-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Or Divider */}
            <div className="relative my-5 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-150 dark:border-slate-800"></div>
              </div>
              <span className="relative bg-white dark:bg-slate-900 px-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest">or</span>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Your Full Name</label>
                  <Input 
                    type="text" 
                    placeholder="Scholar Name" 
                    value={userName} 
                    onChange={(e) => setUserName(e.target.value)} 
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs py-2.5 px-3.5 rounded-xl text-slate-850 dark:text-white outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] transition-all"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Email</label>
                <Input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)} 
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs py-2.5 px-3.5 rounded-xl text-slate-850 dark:text-white outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] transition-all"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Password</label>
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-[10px] font-semibold text-slate-450 hover:text-slate-600 transition-colors">Forgot password?</a>
                </div>
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)} 
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs py-2.5 px-3.5 rounded-xl text-slate-850 dark:text-white outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6] transition-all"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-black py-3 rounded-xl tracking-wide uppercase shadow-md active:scale-95 transition-all text-center mt-3 cursor-pointer"
              >
                {isLogin ? 'Sign In' : 'Create Account'}
              </button>

              <div className="text-center pt-3 text-xs border-t border-slate-100 dark:border-slate-850">
                <button 
                  type="button" 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition-colors font-bold"
                >
                  {isLogin ? "No account? Create one" : "Already registered? Sign in"}
                </button>
              </div>
            </form>

          </div>

        </div>
      )}

    </div>
  );
};

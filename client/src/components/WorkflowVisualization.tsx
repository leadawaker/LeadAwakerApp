import React, { useState, useEffect } from 'react';
import { User, Bot, CheckCircle2, Shield } from 'lucide-react';

export default function WorkflowVisualization() {
  const [activeNode, setActiveNode] = useState('contact');
  const [visitedNodes, setVisitedNodes] = useState(new Set(['contact']));
  const [isGlowing1, setIsGlowing1] = useState(false);
  const [isFadingBack1, setIsFadingBack1] = useState(false);
  const [isGlowing2, setIsGlowing2] = useState(false);
  const [isFadingBack2, setIsFadingBack2] = useState(false);
  const [agentStatus, setAgentStatus] = useState('thinking');
  const [guardrailsStatus, setGuardrailsStatus] = useState('');
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    const sequence = async () => {
      await new Promise(r => setTimeout(r, 3000));
      setVisitedNodes(prev => new Set(prev).add('engaging'));
      
      await new Promise(r => setTimeout(r, 1000));
      setIsGlowing1(true);
      await new Promise(r => setTimeout(r, 400));
      setIsGlowing1(false);
      setIsFadingBack1(true);
      setActiveNode('agent');
      setVisitedNodes(prev => new Set(prev).add('agent'));
      
      await new Promise(r => setTimeout(r, 1500));
      setAgentStatus('msg1');
      await new Promise(r => setTimeout(r, 2000));
      setAgentStatus('msg2');
      
      await new Promise(r => setTimeout(r, 2000));
      setIsGlowing2(true);
      await new Promise(r => setTimeout(r, 400));
      setIsGlowing2(false);
      setIsFadingBack2(true);
      setActiveNode('guardrails');
      setVisitedNodes(prev => new Set(prev).add('guardrails'));

      const checks = [
        'verifying...', 
        'No violations', 
        'On-topic sales', 
        'Clean content', 
        'Clean language',
        'No personal data', 
        'No credentials',
        'No unauthorized links',
        'No Data Leakage'
      ];
      for (const t of checks) {
        setGuardrailsStatus(t);
        await new Promise(r => setTimeout(r, 800));
      }
      
      setGuardrailsStatus('Message Sent');
      setIsApproved(true);
      await new Promise(r => setTimeout(r, 10000));
      
      setActiveNode('contact');
      setVisitedNodes(new Set(['contact']));
      setIsFadingBack1(false);
      setIsFadingBack2(false);
      setAgentStatus('thinking');
      setGuardrailsStatus('');
      setIsApproved(false);
      sequence();
    };
    sequence();
  }, []);

  const getStatusColor = (node: string, activeClass: string, visitedClass: string, defaultClass: string) => {
    if (activeNode === node) return activeClass;
    if (visitedNodes.has(node)) return visitedClass;
    return defaultClass;
  };

  return (
    <div className="flex flex-col items-center justify-center font-sans text-gray-900 relative">
      <style>{`
        @keyframes strokeRotate { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -240; } }
        @keyframes lineQuickGlow {
          0% { stroke: #d1d5db; filter: drop-shadow(0 0 0px rgba(0,0,0,0)); }
          50% { stroke: #ffffff; filter: drop-shadow(0 0 15px rgba(255,255,255,1)); }
          100% { stroke: #d1d5db; filter: drop-shadow(0 0 0px rgba(0,0,0,0)); }
        }
        @keyframes lineFadeBack {
          0% { stroke: #ffffff; filter: drop-shadow(0 0 15px rgba(255,255,255,1)); }
          100% { stroke: #d1d5db; filter: drop-shadow(0 0 0px rgba(0,0,0,0)); }
        }
        .node-active-stroke { stroke-dasharray: 60, 180; animation: strokeRotate 2s linear infinite; }
        .line-quick-glow { animation: lineQuickGlow 0.4s ease-in-out forwards; }
        .line-fade-back { animation: lineFadeBack 0.8s ease-in-out forwards; }
        .node-glow-layer {
          position: absolute;
          inset: -4px;
          border-radius: inherit;
          z-index: -1;
          transition: all 0.5s ease;
          opacity: 0;
        }
        .card-gradient-overlay { 
          position: absolute; inset: 0; pointer-events: none; border-radius: inherit; 
          background: linear-gradient(to top left, rgba(55, 65, 81, 0.05), transparent 70%); 
          transition: background 0.5s ease;
          mix-blend-mode: plus-lighter;
        }
        .card-active-amber .node-glow-layer { background: #fbbf24; opacity: 0.4; filter: blur(48px); }
        .card-active-purple .node-glow-layer { background: #c084fc; opacity: 0.4; filter: blur(48px); }
        .card-active-emerald .node-glow-layer { background: #34d399; opacity: 0.4; filter: blur(48px); }
        .card-active-cyan .node-glow-layer { background: #22d3ee; opacity: 0.4; filter: blur(48px); }
        
        .connector-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          border: 2px solid white;
          background: #e2e8f0;
          position: absolute;
          left: 50%;
          top: auto;
          bottom: -6px;
          transform: translateX(-50%);
          z-index: 20;
          transition: all 0.3s ease;
          opacity: 0.3;
        }
        .connector-dot.top-mobile {
          top: -6px;
          bottom: auto;
        }
        .connector-dot.left-side {
          top: -6px !important;
          bottom: auto;
          left: 50%;
          transform: translateX(-50%);
        }
        @media (min-width: 768px) {
          .connector-dot {
            left: auto;
            top: 50%;
            bottom: auto;
            transform: translateY(-50%);
          }
          .connector-dot.left-side {
            top: 50% !important;
            left: -6px !important;
            right: auto;
            transform: translateY(-50%);
          }
          .connector-dot.right-side {
            left: auto;
            right: -6px !important;
          }
        }
        .connector-dot.active-amber { transform: translateX(-50%) scale(1.25); background: #f59e0b; box-shadow: 0 0 10px rgba(245, 158, 11, 0.8); opacity: 1; }
        .connector-dot.active-purple { transform: translateX(-50%) scale(1.25); background: #a855f7; box-shadow: 0 0 10px rgba(168, 85, 247, 0.8); opacity: 1; }
        .connector-dot.active-emerald { transform: translateX(-50%) scale(1.25); background: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.8); opacity: 1; }
        .connector-dot.active-cyan { transform: translateX(-50%) scale(1.25); background: #06b6d4; box-shadow: 0 0 10px rgba(6, 182, 212, 0.8); opacity: 1; }
        @media (min-width: 768px) {
          .connector-dot.active-amber { transform: translateY(-50%) scale(1.25); }
          .connector-dot.active-purple { transform: translateY(-50%) scale(1.25); }
          .connector-dot.active-emerald { transform: translateY(-50%) scale(1.25); }
          .connector-dot.active-cyan { transform: translateY(-50%) scale(1.25); }
          .connector-dot.visited-amber { transform: translateY(-50%); }
          .connector-dot.visited-purple { transform: translateY(-50%); }
          .connector-dot.visited-emerald { transform: translateY(-50%); }
          .connector-dot.visited-cyan { transform: translateY(-50%); }
        }
        .connector-dot.visited-amber { background: #f59e0b; opacity: 0.5; }
        .connector-dot.visited-purple { background: #a855f7; opacity: 0.5; }
        .connector-dot.visited-emerald { background: #10b981; opacity: 0.5; }
        .connector-dot.visited-cyan { background: #06b6d4; opacity: 0.5; }
        @media (min-width: 768px) {
          .connector-wrapper { height: 100%; display: flex; align-items: center; }
        }
      `}</style>
      
      <div className="relative w-full md:h-[400px] bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300/50 rounded-3xl overflow-hidden shadow-lg flex flex-col md:flex-row items-center justify-center gap-12 md:gap-8 px-12 py-12 md:py-0 space-y-24 md:space-y-0">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          {/* Vertical lines for mobile, horizontal for desktop */}
          <line x1="50%" y1="calc(12.5% + 64px)" x2="50%" y2="calc(50% - 64px)" stroke="#d1d5db" strokeWidth="2" className={`md:hidden ${isGlowing1 ? 'line-quick-glow' : ''} ${isFadingBack1 ? 'line-fade-back' : ''}`} />
          <line x1="50%" y1="calc(50% + 64px)" x2="50%" y2="calc(87.5% - 64px)" stroke="#d1d5db" strokeWidth="2" className={`md:hidden ${isGlowing2 ? 'line-quick-glow' : ''} ${isFadingBack2 ? 'line-fade-back' : ''}`} />
          <line 
            x1="calc(50% - 128px + 6px)" 
            y1="50%" 
            x2="calc(50% - 128px + 32px - 6px)" 
            y2="50%" 
            stroke="#d1d5db" 
            strokeWidth="2" 
            className={`hidden md:block ${isGlowing1 ? 'line-quick-glow' : ''} ${isFadingBack1 ? 'line-fade-back' : ''}`} 
          />
          <line 
            x1="calc(50% + 128px - 32px + 6px)" 
            y1="50%" 
            x2="calc(50% + 128px - 6px)" 
            y2="50%" 
            stroke="#d1d5db" 
            strokeWidth="2" 
            className={`hidden md:block ${isGlowing2 ? 'line-quick-glow' : ''} ${isFadingBack2 ? 'line-fade-back' : ''}`} 
          />
        </svg>

        <div className="connector-wrapper relative z-10">
          <div className={`connector-dot right-side ${activeNode === 'contact' ? 'active-amber' : visitedNodes.has('agent') ? 'visited-amber' : ''}`} />
          <div className={`relative bg-white border-2 rounded-xl p-6 w-64 transition-all duration-300 ${getStatusColor('contact', 'border-amber-500 shadow-xl card-active-amber', 'border-gray-200 shadow-md', 'border-gray-200')}`}>
            <div className="node-glow-layer" />
            {activeNode === 'contact' && (
              <svg className="absolute -inset-[2px] w-[calc(100%+4px)] h-[calc(100%+4px)] pointer-events-none" viewBox="0 0 200 160" preserveAspectRatio="none">
                <rect x="1" y="1" width="99%" height="99%" rx="12" fill="none" stroke="#f59e0b" strokeWidth="2" className="node-active-stroke" />
              </svg>
            )}
            <div className="card-gradient-overlay" />
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg transition-colors duration-300 ${activeNode === 'contact' ? 'bg-amber-100' : 'bg-amber-50/50'}`}>
                <User className={`w-5 h-5 transition-colors duration-300 ${activeNode === 'contact' ? 'text-amber-600' : 'text-amber-400/60'}`} />
              </div>
              <div><h3 className={`font-bold text-sm transition-colors duration-300 ${activeNode === 'contact' ? 'text-gray-900' : 'text-gray-400'}`}>Lead #315</h3><p className="text-[10px] text-gray-400 text-left font-semibold uppercase tracking-wider">Jack Johnson</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-300 text-[10px] font-mono flex items-center justify-between">
              <span className={`font-semibold transition-colors duration-300 ${activeNode === 'contact' ? 'text-amber-600' : 'text-amber-400/60'}`}>Status</span>
              <span className={`transition-colors duration-300 ${activeNode === 'contact' ? 'text-gray-700' : 'text-gray-400'}`}>{isApproved ? 'Lead Engaged' : 'Active'}</span>
            </div>
          </div>
        </div>

        <div className="connector-wrapper relative z-10">
          <div className={`connector-dot left-side ${activeNode === 'agent' ? 'active-purple' : visitedNodes.has('agent') ? 'visited-purple' : ''}`} />
          <div className={`connector-dot right-side ${activeNode === 'agent' ? 'active-purple' : visitedNodes.has('guardrails') ? 'visited-purple' : ''}`} />
          <div className={`relative bg-white border-2 rounded-xl p-6 w-64 transition-all duration-300 ${getStatusColor('agent', 'border-purple-500 shadow-xl card-active-purple', 'border-gray-200 shadow-md', 'border-gray-200')}`}>
            <div className="node-glow-layer" />
            {activeNode === 'agent' && (
              <svg className="absolute -inset-[2px] w-[calc(100%+4px)] h-[calc(100%+4px)] pointer-events-none" viewBox="0 0 200 160" preserveAspectRatio="none">
                <rect x="1" y="1" width="99%" height="99%" rx="12" fill="none" stroke="#a855f7" strokeWidth="2" className="node-active-stroke" />
              </svg>
            )}
            <div className="card-gradient-overlay" />
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg transition-colors duration-300 ${activeNode === 'agent' ? 'bg-purple-100' : 'bg-purple-50/50'}`}>
                <Bot className={`w-5 h-5 transition-colors duration-300 ${activeNode === 'agent' ? 'text-purple-600' : 'text-purple-400/60'}`} />
              </div>
              <div><h3 className={`font-bold text-sm transition-colors duration-300 ${activeNode === 'agent' ? 'text-gray-900' : 'text-gray-400'}`}>AI Agent</h3><p className="text-[10px] text-gray-400 text-left font-semibold uppercase tracking-wider">GPT-5.2</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-300 text-[10px] h-[34px] flex items-center overflow-hidden justify-between">
              <span className={`font-semibold font-mono transition-colors duration-300 ${activeNode === 'agent' ? 'text-purple-600' : 'text-purple-400/60'}`}>Output</span>
              <span className={`truncate font-mono transition-colors duration-300 ${activeNode === 'agent' ? 'text-gray-700' : 'text-gray-400'}`}>
                {visitedNodes.has('agent') ? (agentStatus === 'thinking' ? '...' : (agentStatus === 'msg1' ? 'Good morning :)' : 'Is this Jack?')) : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="connector-wrapper relative z-10">
          <div className={`connector-dot left-side ${activeNode === 'guardrails' ? (isApproved ? 'active-emerald' : 'active-cyan') : (isApproved ? 'visited-emerald' : (visitedNodes.has('guardrails') ? 'visited-cyan' : ''))}`} />
          <div className={`relative bg-white border-2 rounded-xl p-6 w-64 transition-all duration-300 ${isApproved ? 'border-emerald-500 shadow-xl card-active-emerald' : getStatusColor('guardrails', 'border-cyan-500 shadow-xl card-active-cyan', 'border-gray-200 shadow-md', 'border-gray-200')}`}>
            <div className="node-glow-layer" />
            {activeNode === 'guardrails' && (
              <svg className="absolute -inset-[2px] w-[calc(100%+4px)] h-[calc(100%+4px)] pointer-events-none" viewBox="0 0 200 160" preserveAspectRatio="none">
                <rect x="1" y="1" width="99%" height="99%" rx="12" fill="none" stroke={isApproved ? "#10b981" : "#06b6d4"} strokeWidth="2" className="node-active-stroke" />
              </svg>
            )}
            <div className="card-gradient-overlay" />
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg transition-colors duration-300 ${activeNode === 'guardrails' ? (isApproved ? 'bg-emerald-100' : 'bg-cyan-100') : (isApproved ? 'bg-emerald-50/50' : 'bg-cyan-50/50')}`}>
                {isApproved ? 
                  <CheckCircle2 className={`w-5 h-5 transition-colors duration-300 ${activeNode === 'guardrails' || isApproved ? 'text-emerald-600' : 'text-emerald-400/60'}`} /> : 
                  <Shield className={`w-5 h-5 transition-colors duration-300 ${activeNode === 'guardrails' ? 'text-cyan-600' : 'text-cyan-400/60'}`} />
                }
              </div>
              <div><h3 className={`font-bold text-sm transition-colors duration-300 ${activeNode === 'guardrails' ? 'text-gray-900' : 'text-gray-400'}`}>Guardrails</h3><p className="text-[10px] text-gray-400 text-left font-semibold uppercase tracking-wider">SECURITY</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-300 text-[10px] h-[34px] flex items-center justify-between">
              <span className={`font-semibold font-mono transition-colors duration-300 ${(activeNode === 'guardrails' || isApproved) ? (isApproved ? 'text-emerald-600' : 'text-cyan-600') : (isApproved ? 'text-emerald-400/60' : 'text-cyan-400/60')}`}>Status</span>
              <span className={`truncate font-mono transition-colors duration-300 ${(activeNode === 'guardrails' || isApproved) ? 'text-gray-700' : 'text-gray-400'}`}>{guardrailsStatus}</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-12 text-gray-600 text-sm max-w-2xl text-center">
        Every AI reply passes through <span className={`font-bold transition-colors duration-500 ${isApproved ? 'text-emerald-600' : 'text-cyan-600'}`}>Security Guardrails</span>, so no message leaves the system without safety and compliance checks—keeping responses reliable and on‑brand.
      </p>
    </div>
  );
}

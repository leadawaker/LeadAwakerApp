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

      const checks = ['verifying...', 'No violations', 'On-topic sales', 'Clean content', 'No personal data', 'No Data Leakage'];
      for (const t of checks) {
        setGuardrailsStatus(t);
        await new Promise(r => setTimeout(r, 1000));
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
    <div className="flex flex-col items-center justify-center p-8 font-sans text-gray-900 relative">
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
        .card-gradient-overlay { 
          position: absolute; inset: 0; pointer-events: none; border-radius: inherit; 
          background: linear-gradient(to top left, rgba(55, 65, 81, 0.05), transparent 70%); 
          transition: background 0.5s ease; 
        }
        .card-active-amber .card-gradient-overlay { background: linear-gradient(to top left, rgba(245, 158, 11, 0.15), transparent 70%); }
        .card-active-purple .card-gradient-overlay { background: linear-gradient(to top left, rgba(168, 85, 247, 0.15), transparent 70%); }
        .card-active-emerald .card-gradient-overlay { background: linear-gradient(to top left, rgba(16, 185, 129, 0.15), transparent 70%); }
        .card-active-cyan .card-gradient-overlay { background: linear-gradient(to top left, rgba(6, 182, 212, 0.15), transparent 70%); }
        .connector-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          border: 1.5px solid #cbd5e1;
          background: white;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 20;
          transition: all 0.3s ease;
          box-shadow: 0 0 6px rgba(0,0,0,0.03);
          opacity: 0.6;
        }
        .connector-dot.active-amber { border-color: #f59e0b; background: #f59e0b; box-shadow: 0 0 12px #f59e0b; opacity: 1; }
        .connector-dot.active-purple { border-color: #a855f7; background: #a855f7; box-shadow: 0 0 12px #a855f7; opacity: 1; }
        .connector-dot.active-emerald { border-color: #10b981; background: #10b981; box-shadow: 0 0 12px #10b981; opacity: 1; }
        .connector-dot.active-cyan { border-color: #06b6d4; background: #06b6d4; box-shadow: 0 0 12px #06b6d4; opacity: 1; }
      `}</style>
      
      <div className="relative w-full max-w-5xl md:h-[400px] bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300/50 rounded-3xl overflow-hidden shadow-lg flex flex-col md:flex-row items-center justify-between px-12 py-12 md:py-0 space-y-24 md:space-y-0">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <line x1="25%" y1="50%" x2="50%" y2="50%" stroke="#d1d5db" strokeWidth="2" className={`${isGlowing1 ? 'line-quick-glow' : ''} ${isFadingBack1 ? 'line-fade-back' : ''}`} />
          <line x1="50%" y1="50%" x2="75%" y2="50%" stroke="#d1d5db" strokeWidth="2" className={`${isGlowing2 ? 'line-quick-glow' : ''} ${isFadingBack2 ? 'line-fade-back' : ''}`} />
        </svg>

        <div className="relative z-10">
          <div className={`connector-dot -right-[5px] ${activeNode === 'contact' ? 'active-amber' : visitedNodes.has('agent') ? 'active-amber' : ''}`} />
          <div className={`relative bg-white border-2 rounded-xl p-6 w-64 transition-all duration-300 ${getStatusColor('contact', 'border-amber-500 shadow-xl card-active-amber', 'border-gray-200 shadow-md', 'border-gray-200')}`}>
            {activeNode === 'contact' && (
              <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none" viewBox="0 0 200 160" preserveAspectRatio="none">
                <rect x="4" y="4" width="96%" height="96%" rx="12" fill="none" stroke="#f59e0b" strokeWidth="2" className="node-active-stroke" />
              </svg>
            )}
            <div className="card-gradient-overlay" />
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg transition-colors duration-300 ${activeNode === 'contact' ? 'bg-amber-100' : 'bg-amber-50/50'}`}>
                <User className={`w-5 h-5 transition-colors duration-300 ${activeNode === 'contact' ? 'text-amber-600' : 'text-amber-400/60'}`} />
              </div>
              <div><h3 className={`font-bold text-sm transition-colors duration-300 ${activeNode === 'contact' ? 'text-gray-900' : 'text-gray-400'}`}>Lead #315</h3><p className="text-[10px] text-gray-400 text-left">Jack Johnson</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-300 text-[10px] font-mono flex items-center gap-2">
              <span className={`font-semibold transition-colors duration-300 ${activeNode === 'contact' ? 'text-amber-600' : 'text-amber-400/60'}`}>Status</span>
              <span className={`transition-colors duration-300 ${activeNode === 'contact' ? 'text-gray-700' : 'text-gray-400'}`}>{isApproved ? 'Lead Engaged' : 'Active'}</span>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <div className={`connector-dot -left-[5px] ${activeNode === 'agent' ? 'active-purple' : visitedNodes.has('agent') ? 'active-purple' : ''}`} />
          <div className={`connector-dot -right-[5px] ${activeNode === 'agent' ? 'active-purple' : visitedNodes.has('guardrails') ? 'active-purple' : ''}`} />
          <div className={`relative bg-white border-2 rounded-xl p-6 w-64 transition-all duration-300 ${getStatusColor('agent', 'border-purple-500 shadow-xl card-active-purple', 'border-gray-200 shadow-md', 'border-gray-200')}`}>
            {activeNode === 'agent' && (
              <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none" viewBox="0 0 200 160" preserveAspectRatio="none">
                <rect x="4" y="4" width="96%" height="96%" rx="12" fill="none" stroke="#a855f7" strokeWidth="2" className="node-active-stroke" />
              </svg>
            )}
            <div className="card-gradient-overlay" />
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg transition-colors duration-300 ${activeNode === 'agent' ? 'bg-purple-100' : 'bg-purple-50/50'}`}>
                <Bot className={`w-5 h-5 transition-colors duration-300 ${activeNode === 'agent' ? 'text-purple-600' : 'text-purple-400/60'}`} />
              </div>
              <div><h3 className={`font-bold text-sm transition-colors duration-300 ${activeNode === 'agent' ? 'text-gray-900' : 'text-gray-400'}`}>AI Agent</h3><p className="text-[10px] text-gray-400 text-left">GPT-5.2</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-300 text-[10px] h-[34px] flex items-center overflow-hidden gap-2">
              <span className={`font-semibold font-mono transition-colors duration-300 ${activeNode === 'agent' ? 'text-purple-600' : 'text-purple-400/60'}`}>Output</span>
              <span className={`truncate font-mono transition-colors duration-300 ${activeNode === 'agent' ? 'text-gray-700' : 'text-gray-400'}`}>
                {visitedNodes.has('agent') ? (agentStatus === 'thinking' ? '...' : (agentStatus === 'msg1' ? 'Good morning :)' : 'Is this Jack?')) : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <div className={`connector-dot -left-[5px] ${activeNode === 'guardrails' ? (isApproved ? 'active-emerald' : 'active-cyan') : (isApproved ? 'active-emerald' : (visitedNodes.has('guardrails') ? 'active-cyan' : ''))}`} />
          <div className={`relative bg-white border-2 rounded-xl p-6 w-64 transition-all duration-300 ${isApproved ? 'border-emerald-500 shadow-xl card-active-emerald' : getStatusColor('guardrails', 'border-cyan-500 shadow-xl card-active-cyan', 'border-gray-200 shadow-md', 'border-gray-200')}`}>
            {activeNode === 'guardrails' && (
              <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none" viewBox="0 0 200 160" preserveAspectRatio="none">
                <rect x="4" y="4" width="96%" height="96%" rx="12" fill="none" stroke={isApproved ? "#10b981" : "#06b6d4"} strokeWidth="2" className="node-active-stroke" />
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
              <div><h3 className={`font-bold text-sm transition-colors duration-300 ${activeNode === 'guardrails' ? 'text-gray-900' : 'text-gray-400'}`}>Guardrails</h3><p className="text-[10px] text-gray-400 text-left">SECURITY</p></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-300 text-[10px] h-[34px] flex items-center gap-2">
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

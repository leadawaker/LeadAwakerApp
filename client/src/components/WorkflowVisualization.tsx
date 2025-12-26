import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { User, Bot, CheckCircle2, Shield } from 'lucide-react';

const NodeStrokeAnimation = () => (
  <style>{`
    @keyframes strokeRotate {
      0% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: -240; }
    }
    @keyframes connectorFlow {
      0% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: 10; }
    }
    @keyframes lineQuickGlow {
      0% {
        stroke: #3f3f46;
        filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0));
      }
      50% {
        stroke: #d4d4d8;
        filter: drop-shadow(0 0 12px rgba(212, 212, 216, 0.9));
      }
      100% {
        stroke: #3f3f46;
        filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0));
      }
    }
    @keyframes lineFadeBack {
      0% {
        stroke: #d4d4d8;
        filter: drop-shadow(0 0 12px rgba(212, 212, 216, 0.9));
      }
      100% {
        stroke: #71717a;
        filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0));
      }
    }
    .node-active-stroke {
      stroke-dasharray: 60, 180;
      animation: strokeRotate 2s linear infinite;
    }
    .line-quick-glow {
      animation: lineQuickGlow 0.4s ease-in-out forwards;
    }
    .line-fade-back {
      animation: lineFadeBack 0.8s ease-in-out forwards;
    }
    .line-visited {
      stroke: #71717a;
    }
  `}</style>
);

export default function WorkflowVisualization() {
  const [activeNode, setActiveNode] = useState<'contact' | 'agent' | 'guardrails' | null>('contact');
  const [visitedNodes, setVisitedNodes] = useState<Set<string>>(new Set(['contact']));
  const [isGlowing1, setIsGlowing1] = useState(false);
  const [isFadingBack1, setIsFadingBack1] = useState(false);
  const [isGlowing2, setIsGlowing2] = useState(false);
  const [isFadingBack2, setIsFadingBack2] = useState(false);
  const [agentStatus, setAgentStatus] = useState<'thinking' | 'msg1' | 'msg2'>('thinking');
  const [guardrailsStatus, setGuardrailsStatus] = useState<string>('');
  const [isApproved, setIsApproved] = useState(false);

  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { amount: 0.5, once: true });

  useEffect(() => {
    if (!isInView) return;

    setAgentStatus('thinking');
    
    const sequence = async () => {
      // Step 1: Contact Engagement
      await new Promise(r => setTimeout(r, 3000));
      setVisitedNodes(prev => new Set(prev).add('engaging'));
      
      // Transition to Agent
      await new Promise(r => setTimeout(r, 1000));
      setIsGlowing1(true);
      await new Promise(r => setTimeout(r, 400));
      setIsGlowing1(false);
      setIsFadingBack1(true);
      setActiveNode('agent');
      setVisitedNodes(prev => new Set(prev).add('agent'));
      
      // Agent Thinking
      await new Promise(r => setTimeout(r, 1500));
      setAgentStatus('msg1');
      await new Promise(r => setTimeout(r, 2000));
      setAgentStatus('msg2');
      
      // Transition to Guardrails
      await new Promise(r => setTimeout(r, 2000));
      setIsGlowing2(true);
      await new Promise(r => setTimeout(r, 400));
      setIsGlowing2(false);
      setIsFadingBack2(true);
      setActiveNode('guardrails');
      setVisitedNodes(prev => new Set(prev).add('guardrails'));
      const transgressions = [
        'verifying...', 'No violations', 'On-topic sales', 'Clean content', 
        'Clean language', 'No personal data', 'No credentials', 
        'No unauthorized links', 'No Data Leakage'
      ];
      for (const t of transgressions) {
        setGuardrailsStatus(t);
        await new Promise(r => setTimeout(r, 1000));
      }
      
      setGuardrailsStatus('...');
      await new Promise(r => setTimeout(r, 1500));
      setGuardrailsStatus('Message Sent');
      setIsApproved(true);
      
      // Restart loop
      await new Promise(r => setTimeout(r, 10000));
      setActiveNode('contact');
      setVisitedNodes(new Set(['contact']));
      setIsGlowing1(false);
      setIsFadingBack1(false);
      setIsGlowing2(false);
      setIsFadingBack2(false);
      setAgentStatus('thinking');
      setGuardrailsStatus('');
      setIsApproved(false);
      
      await new Promise(r => setTimeout(r, 50));
      sequence();
    };
    sequence();
  }, [isInView]);

  const getStatusColor = (node: string, activeClass: string, visitedClass: string, defaultClass: string) => {
    if (activeNode === node) return activeClass;
    if (visitedNodes.has(node)) return visitedClass;
    return defaultClass;
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center p-8 font-sans text-slate-100 relative">
      <NodeStrokeAnimation />
    </div>
  );
}

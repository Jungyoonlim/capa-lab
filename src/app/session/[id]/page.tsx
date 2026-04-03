'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { SOLO_LABELS, SOLO_COLORS, SoloLevel } from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface AssessmentResult {
  observedSoloLevel: number;
  soloEvidence: string;
  knowledgeTypesDemonstrated: string[];
  responsePattern: string;
  metacognitiveCalibration: string;
  passed: boolean;
}

interface SessionData {
  id: string;
  startTime: string;
  endTime: string | null;
  targetLayers: string[];
  soloStart: Record<string, number>;
  assessmentCount: number;
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastAssessment, setLastAssessment] = useState<AssessmentResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then(r => r.json())
      .then(data => {
        setSession(data.session);
        setMessages(data.messages || []);
      });
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || sending) return;
    setSending(true);
    setInput('');

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch(`/api/sessions/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();

      if (data.message) {
        setMessages(prev => [...prev, data.message]);
      }
      if (data.assessment) {
        setLastAssessment(data.assessment);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'system',
        content: 'Error communicating with the tutor. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    }
    setSending(false);
  };

  const handleStuck = () => {
    sendMessage("I'm stuck. Can you help me approach this differently?");
  };

  const endSession = async () => {
    await fetch(`/api/sessions/${id}/end`, { method: 'POST' });
    router.push(`/session/${id}/review`);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-stone-400">Loading session...</p>
      </div>
    );
  }

  const targetLayerId = session.targetLayers[0];
  const currentSolo = session.soloStart[targetLayerId] ?? 0;

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Top bar */}
      <div className="border-b border-stone-200 px-6 py-4 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-lg font-medium text-stone-800">{targetLayerId}</span>
            <span className="mx-3 text-stone-300">|</span>
            <span
              className="text-sm font-medium px-3 py-1 rounded-full text-white"
              style={{ backgroundColor: SOLO_COLORS[currentSolo as SoloLevel] }}
            >
              {SOLO_LABELS[currentSolo as SoloLevel]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-base text-stone-400 font-mono">{formatTime(elapsed)}</span>
          <button
            onClick={endSession}
            className="text-base text-stone-500 hover:text-stone-800 border border-stone-200 px-4 py-2 rounded-md transition-colors"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-stone-400 text-lg">Send a message to begin the diagnostic.</p>
              <button
                onClick={() => sendMessage("I'm ready to start.")}
                className="mt-4 text-base text-stone-600 border border-stone-200 px-5 py-3 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Begin Diagnostic
              </button>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-5 py-4 text-base leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-stone-900 text-white'
                    : msg.role === 'system'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-white border border-stone-200 text-stone-800'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-stone-200 rounded-lg px-5 py-4 text-base text-stone-400">
                Thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Assessment indicator */}
      {lastAssessment && (
        <div className="border-t border-stone-100 bg-stone-50 px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-4 text-sm">
            <span
              className="px-3 py-1 rounded-full text-white font-medium"
              style={{ backgroundColor: SOLO_COLORS[lastAssessment.observedSoloLevel as SoloLevel] }}
            >
              {SOLO_LABELS[lastAssessment.observedSoloLevel as SoloLevel]}
            </span>
            <span className="text-stone-500">
              {lastAssessment.knowledgeTypesDemonstrated?.join(', ')}
            </span>
            <span className="text-stone-400">
              {lastAssessment.responsePattern}
            </span>
            {lastAssessment.metacognitiveCalibration !== 'calibrated' && (
              <span className={lastAssessment.metacognitiveCalibration === 'overconfident' ? 'text-red-500' : 'text-blue-500'}>
                {lastAssessment.metacognitiveCalibration}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-stone-200 bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <button
            onClick={handleStuck}
            disabled={sending}
            className="text-base text-stone-400 hover:text-stone-600 border border-stone-200 px-4 py-3 rounded-lg whitespace-nowrap transition-colors"
          >
            I&apos;m stuck
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Type your response..."
            disabled={sending}
            className="flex-1 border-2 border-stone-300 rounded-lg px-5 py-3 text-lg placeholder:text-stone-400 focus:outline-none focus:border-stone-500 transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="bg-stone-900 text-white text-base px-6 py-3 rounded-lg hover:bg-stone-800 disabled:opacity-30 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

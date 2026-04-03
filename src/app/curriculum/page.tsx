'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GeneratedLayer {
  id: string;
  name: string;
  description: string;
  order: number;
  domain: string;
  rationale: string;
}

interface GeneratedCurriculum {
  domainId: string;
  domainName: string;
  domainDescription: string;
  layers: GeneratedLayer[];
}

interface EvolutionSuggestion {
  type: 'SPLIT' | 'ADD' | 'REORDER' | 'REFINE' | 'MERGE';
  targetLayerIds: string[];
  evidence: string;
  description: string;
  proposedLayers: { id: string; name: string; description: string; order: number; domain: string }[];
  confidence: 'high' | 'medium' | 'low';
}

type Tab = 'generate' | 'evolve';

const CONFIDENCE_COLORS = {
  high: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-stone-100 text-stone-500 border-stone-200',
};

const TYPE_COLORS: Record<string, string> = {
  SPLIT: 'bg-violet-100 text-violet-700',
  ADD: 'bg-blue-100 text-blue-700',
  REORDER: 'bg-amber-100 text-amber-700',
  REFINE: 'bg-teal-100 text-teal-700',
  MERGE: 'bg-rose-100 text-rose-700',
};

export default function CurriculumPage() {
  const [tab, setTab] = useState<Tab>('generate');

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-stone-900">Curriculum</h1>
          <p className="text-lg text-stone-500 mt-1">Generate new domains or evolve existing ones</p>
        </div>
        <a href="/" className="text-base text-stone-400 hover:text-stone-600 transition-colors">
          ← Dashboard
        </a>
      </div>

      <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
        <button
          onClick={() => setTab('generate')}
          className={`flex-1 py-2.5 text-base font-medium rounded-md transition-colors ${
            tab === 'generate' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          Generate
        </button>
        <button
          onClick={() => setTab('evolve')}
          className={`flex-1 py-2.5 text-base font-medium rounded-md transition-colors ${
            tab === 'evolve' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          Evolve
        </button>
      </div>

      {tab === 'generate' ? <GenerateTab /> : <EvolveTab />}
    </div>
  );
}

// === Generate Tab ===

function GenerateTab() {
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [curriculum, setCurriculum] = useState<GeneratedCurriculum | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    try {
      const res = await fetch('/api/curriculum/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurriculum(data.curriculum);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!curriculum) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/curriculum/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  };

  const updateLayer = (index: number, field: 'name' | 'description', value: string) => {
    if (!curriculum) return;
    const updated = { ...curriculum };
    updated.layers = [...updated.layers];
    updated.layers[index] = { ...updated.layers[index], [field]: value };
    setCurriculum(updated);
  };

  const removeLayer = (index: number) => {
    if (!curriculum) return;
    const updated = { ...curriculum };
    updated.layers = updated.layers.filter((_, i) => i !== index).map((l, i) => ({ ...l, order: i + 1 }));
    setCurriculum(updated);
  };

  const moveLayer = (index: number, direction: -1 | 1) => {
    if (!curriculum) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= curriculum.layers.length) return;
    const updated = { ...curriculum };
    const layers = [...updated.layers];
    [layers[index], layers[newIndex]] = [layers[newIndex], layers[index]];
    updated.layers = layers.map((l, i) => ({ ...l, order: i + 1 }));
    setCurriculum(updated);
  };

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <label className="block text-base font-medium text-stone-700 mb-2">
          What do you want to learn?
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && topic.trim() && handleGenerate()}
            placeholder="e.g. Distributed Systems, Linear Algebra, Compiler Design..."
            className="flex-1 px-4 py-3 border border-stone-200 rounded-lg text-base text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
            disabled={generating}
          />
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || generating}
            className="px-6 py-3 bg-stone-900 text-white text-base font-medium rounded-lg hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg px-5 py-4 text-base text-red-700">
          {error}
        </div>
      )}

      {generating && (
        <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
          <div className="inline-block w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mb-4" />
          <p className="text-base text-stone-500">Decomposing &ldquo;{topic}&rdquo; into learning layers...</p>
        </div>
      )}

      {/* Preview */}
      {curriculum && !generating && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-lg p-5">
            <h2 className="text-xl font-medium text-stone-900">{curriculum.domainName}</h2>
            <p className="text-base text-stone-500 mt-1">{curriculum.domainDescription}</p>
            <p className="text-sm text-stone-400 mt-2">
              {curriculum.layers.length} layers — edit names, descriptions, reorder, or remove before saving
            </p>
          </div>

          {curriculum.layers.map((layer, index) => (
            <div key={layer.id} className="bg-white border border-stone-200 rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <button
                    onClick={() => moveLayer(index, -1)}
                    disabled={index === 0}
                    className="text-stone-400 hover:text-stone-700 disabled:opacity-20 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4l4 4H4l4-4z"/></svg>
                  </button>
                  <span className="text-lg font-bold text-stone-300">{layer.order}</span>
                  <button
                    onClick={() => moveLayer(index, 1)}
                    disabled={index === curriculum.layers.length - 1}
                    className="text-stone-400 hover:text-stone-700 disabled:opacity-20 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 12l4-4H4l4 4z"/></svg>
                  </button>
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={layer.name}
                    onChange={e => updateLayer(index, 'name', e.target.value)}
                    className="w-full text-lg font-medium text-stone-900 bg-transparent border-b border-transparent hover:border-stone-200 focus:border-stone-400 focus:outline-none pb-1 transition-colors"
                  />
                  <textarea
                    value={layer.description}
                    onChange={e => updateLayer(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full text-base text-stone-600 bg-transparent border border-transparent hover:border-stone-200 focus:border-stone-300 focus:outline-none rounded-md px-2 py-1 resize-none transition-colors"
                  />
                  <p className="text-sm text-stone-400 italic">{layer.rationale}</p>
                </div>

                <button
                  onClick={() => removeLayer(index)}
                  className="text-stone-300 hover:text-red-500 transition-colors p-1"
                  title="Remove layer"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l10 10M14 4L4 14"/></svg>
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={saving || curriculum.layers.length === 0}
            className="w-full py-3 bg-stone-900 text-white text-base font-medium rounded-lg hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : `Save Curriculum (${curriculum.layers.length} layers)`}
          </button>
        </div>
      )}
    </div>
  );
}

// === Evolve Tab ===

function EvolveTab() {
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<EvolutionSuggestion[] | null>(null);
  const [summary, setSummary] = useState('');
  const [insufficientData, setInsufficientData] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(data => {
        const uniqueDomains = [...new Set((data.layers as { domain: string }[]).map((l: { domain: string }) => l.domain))];
        setDomains(uniqueDomains);
        if (uniqueDomains.length > 0) setSelectedDomain(uniqueDomains[0]);
      });
  }, []);

  const handleAnalyze = async () => {
    setError('');
    setAnalyzing(true);
    setSuggestions(null);
    try {
      const res = await fetch(`/api/curriculum/evolve?domain=${encodeURIComponent(selectedDomain)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuggestions(data.suggestions);
      setSummary(data.summary);
      setInsufficientData(data.insufficientData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async (index: number, suggestion: EvolutionSuggestion) => {
    setApplying(index);
    setError('');
    try {
      const res = await fetch('/api/curriculum/evolve/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainId: selectedDomain, suggestion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Remove the applied suggestion
      setSuggestions(prev => prev ? prev.filter((_, i) => i !== index) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply');
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <label className="block text-base font-medium text-stone-700 mb-2">
          Select domain to analyze
        </label>
        <div className="flex gap-3">
          <select
            value={selectedDomain}
            onChange={e => setSelectedDomain(e.target.value)}
            className="flex-1 px-4 py-3 border border-stone-200 rounded-lg text-base text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300"
            disabled={analyzing || domains.length === 0}
          >
            {domains.length === 0 && <option value="">No domains yet</option>}
            {domains.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button
            onClick={handleAnalyze}
            disabled={!selectedDomain || analyzing}
            className="px-6 py-3 bg-stone-900 text-white text-base font-medium rounded-lg hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg px-5 py-4 text-base text-red-700">
          {error}
        </div>
      )}

      {analyzing && (
        <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
          <div className="inline-block w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mb-4" />
          <p className="text-base text-stone-500">Analyzing assessment patterns and curriculum structure...</p>
        </div>
      )}

      {insufficientData && !analyzing && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg px-5 py-4 text-base text-amber-700">
          {summary}
        </div>
      )}

      {suggestions && suggestions.length === 0 && !insufficientData && !analyzing && (
        <div className="border border-green-200 bg-green-50 rounded-lg px-5 py-4 text-base text-green-700">
          <span className="font-medium">Curriculum is healthy.</span> {summary}
        </div>
      )}

      {suggestions && suggestions.length > 0 && !analyzing && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-lg p-5">
            <h3 className="text-base font-medium text-stone-700">Analysis Summary</h3>
            <p className="text-base text-stone-500 mt-1">{summary}</p>
          </div>

          {suggestions.map((s, index) => (
            <div key={index} className="bg-white border border-stone-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-md text-sm font-medium ${TYPE_COLORS[s.type] || 'bg-stone-100 text-stone-600'}`}>
                  {s.type}
                </span>
                <span className={`px-2 py-0.5 rounded border text-xs font-medium ${CONFIDENCE_COLORS[s.confidence]}`}>
                  {s.confidence}
                </span>
                <span className="text-sm text-stone-400">
                  {s.targetLayerIds.join(', ')}
                </span>
              </div>

              <p className="text-base text-stone-800">{s.description}</p>

              <div className="bg-stone-50 rounded-md px-4 py-3">
                <p className="text-sm text-stone-500 font-medium mb-1">Evidence</p>
                <p className="text-sm text-stone-600">{s.evidence}</p>
              </div>

              {s.proposedLayers.length > 0 && (
                <div className="bg-stone-50 rounded-md px-4 py-3">
                  <p className="text-sm text-stone-500 font-medium mb-2">Proposed layers</p>
                  <div className="space-y-2">
                    {s.proposedLayers.map((l, i) => (
                      <div key={i} className="flex items-baseline gap-2">
                        <span className="text-sm font-mono text-stone-400">{l.order}.</span>
                        <div>
                          <span className="text-sm font-medium text-stone-700">{l.name}</span>
                          <span className="text-sm text-stone-400 ml-2">{l.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => handleApply(index, s)}
                disabled={applying !== null}
                className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {applying === index ? 'Applying...' : 'Apply This Change'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

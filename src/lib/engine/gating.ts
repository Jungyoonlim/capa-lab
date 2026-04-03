import { SoloLevel, KnowledgeType, CombinationGate, ZPDState, KnowledgeCoverage } from '@/lib/types';

function hasMetacognitiveCoverage(coverage: KnowledgeCoverage): boolean {
  return coverage.metacognitive;
}

function hasFullKnowledgeCoverage(coverage: KnowledgeCoverage): boolean {
  return coverage.factual && coverage.conceptual && coverage.procedural && coverage.metacognitive;
}

export function checkCombinationGate(
  layerIds: string[],
  zpdStates: Record<string, ZPDState>
): CombinationGate {
  const count = layerIds.length;

  if (count <= 1) {
    return {
      layers: layerIds,
      requiredSoloLevel: SoloLevel.Prestructural,
      requireMetacognitive: false,
      unlocked: true,
    };
  }

  // Two-layer combination: both at Relational + metacognitive coverage
  if (count === 2) {
    const allRelational = layerIds.every(id => {
      const state = zpdStates[id];
      return state && state.soloLevel >= SoloLevel.Relational;
    });
    const allMetacognitive = layerIds.every(id => {
      const state = zpdStates[id];
      return state && hasMetacognitiveCoverage(state.knowledgeCoverage);
    });
    return {
      layers: layerIds,
      requiredSoloLevel: SoloLevel.Relational,
      requireMetacognitive: true,
      unlocked: allRelational && allMetacognitive,
    };
  }

  // Three-layer combination: all Relational + full knowledge coverage + metacognitive
  if (count === 3) {
    const allRelational = layerIds.every(id => {
      const state = zpdStates[id];
      return state && state.soloLevel >= SoloLevel.Relational;
    });
    const allFullCoverage = layerIds.every(id => {
      const state = zpdStates[id];
      return state && hasFullKnowledgeCoverage(state.knowledgeCoverage);
    });
    return {
      layers: layerIds,
      requiredSoloLevel: SoloLevel.Relational,
      requiredKnowledgeCoverage: [KnowledgeType.Factual, KnowledgeType.Conceptual, KnowledgeType.Procedural, KnowledgeType.Metacognitive],
      requireMetacognitive: true,
      unlocked: allRelational && allFullCoverage,
    };
  }

  // Full stack (4+): all Relational, at least 2 Extended Abstract
  const allRelational = layerIds.every(id => {
    const state = zpdStates[id];
    return state && state.soloLevel >= SoloLevel.Relational;
  });
  const extendedAbstractCount = layerIds.filter(id => {
    const state = zpdStates[id];
    return state && state.soloLevel >= SoloLevel.ExtendedAbstract;
  }).length;
  const allMetacognitive = layerIds.every(id => {
    const state = zpdStates[id];
    return state && hasMetacognitiveCoverage(state.knowledgeCoverage);
  });

  return {
    layers: layerIds,
    requiredSoloLevel: SoloLevel.Relational,
    requireMetacognitive: true,
    unlocked: allRelational && extendedAbstractCount >= 2 && allMetacognitive,
  };
}

export function getAvailableCombinations(
  layerIds: string[],
  zpdStates: Record<string, ZPDState>
): CombinationGate[] {
  const gates: CombinationGate[] = [];

  // All pairs
  for (let i = 0; i < layerIds.length; i++) {
    for (let j = i + 1; j < layerIds.length; j++) {
      gates.push(checkCombinationGate([layerIds[i], layerIds[j]], zpdStates));
    }
  }

  // All triples
  for (let i = 0; i < layerIds.length; i++) {
    for (let j = i + 1; j < layerIds.length; j++) {
      for (let k = j + 1; k < layerIds.length; k++) {
        gates.push(checkCombinationGate([layerIds[i], layerIds[j], layerIds[k]], zpdStates));
      }
    }
  }

  // Full stack
  if (layerIds.length > 3) {
    gates.push(checkCombinationGate(layerIds, zpdStates));
  }

  return gates;
}

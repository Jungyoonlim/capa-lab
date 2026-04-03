import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'mastery-engine.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS layers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      domain TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS zpd_states (
      layer_id TEXT PRIMARY KEY REFERENCES layers(id),
      solo_level INTEGER NOT NULL DEFAULT 0,
      solo_confidence REAL NOT NULL DEFAULT 0,
      solo_evidence TEXT NOT NULL DEFAULT '',
      knowledge_coverage TEXT NOT NULL DEFAULT '{}',
      bloom_matrix TEXT NOT NULL DEFAULT '{}',
      calibration TEXT NOT NULL DEFAULT '{}',
      multistructural_plateau INTEGER NOT NULL DEFAULT 0,
      plateau_session_count INTEGER NOT NULL DEFAULT 0,
      last_assessed TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT,
      target_layers TEXT NOT NULL DEFAULT '[]',
      solo_start TEXT NOT NULL DEFAULT '{}',
      solo_end TEXT NOT NULL DEFAULT '{}',
      knowledge_coverage_start TEXT NOT NULL DEFAULT '{}',
      knowledge_coverage_end TEXT NOT NULL DEFAULT '{}',
      assessment_count INTEGER NOT NULL DEFAULT 0,
      calibration_score REAL NOT NULL DEFAULT 0,
      plateau_detected INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      recommended_next TEXT NOT NULL DEFAULT '',
      blind_spots TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      layer_id TEXT NOT NULL REFERENCES layers(id),
      session_id TEXT NOT NULL REFERENCES sessions(id),
      timestamp TEXT NOT NULL,
      target_cognitive_process INTEGER NOT NULL,
      target_knowledge_type INTEGER NOT NULL,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      user_response TEXT NOT NULL DEFAULT '',
      confidence_prediction INTEGER NOT NULL DEFAULT 0,
      observed_solo_level INTEGER,
      ai_evaluation TEXT NOT NULL DEFAULT '',
      diagnosis TEXT NOT NULL DEFAULT '{}',
      passed INTEGER NOT NULL DEFAULT 0,
      combined_with TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      assessment_id TEXT,
      confidence_prompt INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_assessments_session ON assessments(session_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_layer ON assessments(layer_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
  `);
}

// === Layer operations ===

export function upsertLayer(layer: { id: string; name: string; description: string; order: number; domain: string }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO layers (id, name, description, "order", domain)
    VALUES (@id, @name, @description, @order, @domain)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      "order" = excluded."order",
      domain = excluded.domain
  `).run(layer);
}

export function getAllLayers(domain?: string) {
  const db = getDb();
  if (domain) {
    return db.prepare('SELECT * FROM layers WHERE domain = ? ORDER BY "order"').all(domain);
  }
  return db.prepare('SELECT * FROM layers ORDER BY "order"').all();
}

export function getLayerDomains(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT domain FROM layers ORDER BY domain').all() as { domain: string }[];
  return rows.map(r => r.domain);
}

export function deleteLayer(layerId: string) {
  const db = getDb();
  db.prepare('DELETE FROM zpd_states WHERE layer_id = ?').run(layerId);
  db.prepare('DELETE FROM layers WHERE id = ?').run(layerId);
}

export function reassignAssessments(fromLayerId: string, toLayerId: string) {
  const db = getDb();
  db.prepare('UPDATE assessments SET layer_id = ? WHERE layer_id = ?').run(toLayerId, fromLayerId);
}

// === ZPD State operations ===

export function getZPDState(layerId: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM zpd_states WHERE layer_id = ?').get(layerId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    layerId: row.layer_id as string,
    soloLevel: row.solo_level as number,
    soloConfidence: row.solo_confidence as number,
    soloEvidence: row.solo_evidence as string,
    knowledgeCoverage: JSON.parse(row.knowledge_coverage as string),
    bloomMatrix: JSON.parse(row.bloom_matrix as string),
    calibration: JSON.parse(row.calibration as string),
    multistructuralPlateau: Boolean(row.multistructural_plateau),
    plateauSessionCount: row.plateau_session_count as number,
    lastAssessed: row.last_assessed as string,
  };
}

export function getAllZPDStates() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM zpd_states').all() as Record<string, unknown>[];
  return rows.map(row => ({
    layerId: row.layer_id as string,
    soloLevel: row.solo_level as number,
    soloConfidence: row.solo_confidence as number,
    soloEvidence: row.solo_evidence as string,
    knowledgeCoverage: JSON.parse(row.knowledge_coverage as string),
    bloomMatrix: JSON.parse(row.bloom_matrix as string),
    calibration: JSON.parse(row.calibration as string),
    multistructuralPlateau: Boolean(row.multistructural_plateau),
    plateauSessionCount: row.plateau_session_count as number,
    lastAssessed: row.last_assessed as string,
  }));
}

export function upsertZPDState(state: {
  layerId: string;
  soloLevel: number;
  soloConfidence: number;
  soloEvidence: string;
  knowledgeCoverage: object;
  bloomMatrix: object;
  calibration: object;
  multistructuralPlateau: boolean;
  plateauSessionCount: number;
  lastAssessed: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO zpd_states (layer_id, solo_level, solo_confidence, solo_evidence, knowledge_coverage, bloom_matrix, calibration, multistructural_plateau, plateau_session_count, last_assessed)
    VALUES (@layerId, @soloLevel, @soloConfidence, @soloEvidence, @knowledgeCoverage, @bloomMatrix, @calibration, @multistructuralPlateau, @plateauSessionCount, @lastAssessed)
    ON CONFLICT(layer_id) DO UPDATE SET
      solo_level = excluded.solo_level,
      solo_confidence = excluded.solo_confidence,
      solo_evidence = excluded.solo_evidence,
      knowledge_coverage = excluded.knowledge_coverage,
      bloom_matrix = excluded.bloom_matrix,
      calibration = excluded.calibration,
      multistructural_plateau = excluded.multistructural_plateau,
      plateau_session_count = excluded.plateau_session_count,
      last_assessed = excluded.last_assessed
  `).run({
    ...state,
    knowledgeCoverage: JSON.stringify(state.knowledgeCoverage),
    bloomMatrix: JSON.stringify(state.bloomMatrix),
    calibration: JSON.stringify(state.calibration),
    multistructuralPlateau: state.multistructuralPlateau ? 1 : 0,
  });
}

// === Session operations ===

export function createSession(session: {
  id: string;
  startTime: string;
  targetLayers: string[];
  soloStart: object;
  knowledgeCoverageStart: object;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO sessions (id, start_time, target_layers, solo_start, knowledge_coverage_start)
    VALUES (@id, @startTime, @targetLayers, @soloStart, @knowledgeCoverageStart)
  `).run({
    ...session,
    targetLayers: JSON.stringify(session.targetLayers),
    soloStart: JSON.stringify(session.soloStart),
    knowledgeCoverageStart: JSON.stringify(session.knowledgeCoverageStart),
  });
}

export function updateSession(id: string, updates: Record<string, unknown>) {
  const db = getDb();
  const jsonFields = ['target_layers', 'solo_start', 'solo_end', 'knowledge_coverage_start', 'knowledge_coverage_end', 'blind_spots'];
  const setClauses: string[] = [];
  const values: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(updates)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    setClauses.push(`${dbKey} = @${key}`);
    values[key] = jsonFields.includes(dbKey) ? JSON.stringify(value) : value;
  }

  if (setClauses.length > 0) {
    db.prepare(`UPDATE sessions SET ${setClauses.join(', ')} WHERE id = @id`).run(values);
  }
}

export function getSession(id: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string | null,
    targetLayers: JSON.parse(row.target_layers as string),
    soloStart: JSON.parse(row.solo_start as string),
    soloEnd: JSON.parse((row.solo_end as string) || '{}'),
    knowledgeCoverageStart: JSON.parse(row.knowledge_coverage_start as string),
    knowledgeCoverageEnd: JSON.parse((row.knowledge_coverage_end as string) || '{}'),
    assessmentCount: row.assessment_count as number,
    calibrationScore: row.calibration_score as number,
    plateauDetected: Boolean(row.plateau_detected),
    notes: row.notes as string,
    recommendedNext: row.recommended_next as string,
    blindSpots: JSON.parse((row.blind_spots as string) || '[]'),
  };
}

export function getAllSessions() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM sessions ORDER BY start_time DESC').all() as Record<string, unknown>[];
  return rows.map(row => ({
    id: row.id as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string | null,
    targetLayers: JSON.parse(row.target_layers as string),
    soloStart: JSON.parse(row.solo_start as string),
    soloEnd: JSON.parse((row.solo_end as string) || '{}'),
    knowledgeCoverageStart: JSON.parse(row.knowledge_coverage_start as string),
    knowledgeCoverageEnd: JSON.parse((row.knowledge_coverage_end as string) || '{}'),
    assessmentCount: row.assessment_count as number,
    calibrationScore: row.calibration_score as number,
    plateauDetected: Boolean(row.plateau_detected),
    notes: row.notes as string,
    recommendedNext: row.recommended_next as string,
    blindSpots: JSON.parse((row.blind_spots as string) || '[]'),
  }));
}

// === Assessment operations ===

export function createAssessment(assessment: {
  id: string;
  layerId: string;
  sessionId: string;
  timestamp: string;
  targetCognitiveProcess: number;
  targetKnowledgeType: number;
  type: string;
  prompt: string;
  userResponse?: string;
  confidencePrediction?: number;
  observedSoloLevel?: number;
  aiEvaluation?: string;
  diagnosis?: object;
  passed?: boolean;
  combinedWith?: string[];
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO assessments (id, layer_id, session_id, timestamp, target_cognitive_process, target_knowledge_type, type, prompt, user_response, confidence_prediction, observed_solo_level, ai_evaluation, diagnosis, passed, combined_with)
    VALUES (@id, @layerId, @sessionId, @timestamp, @targetCognitiveProcess, @targetKnowledgeType, @type, @prompt, @userResponse, @confidencePrediction, @observedSoloLevel, @aiEvaluation, @diagnosis, @passed, @combinedWith)
  `).run({
    ...assessment,
    userResponse: assessment.userResponse || '',
    confidencePrediction: assessment.confidencePrediction || 0,
    observedSoloLevel: assessment.observedSoloLevel ?? null,
    aiEvaluation: assessment.aiEvaluation || '',
    diagnosis: JSON.stringify(assessment.diagnosis || {}),
    passed: assessment.passed ? 1 : 0,
    combinedWith: assessment.combinedWith ? JSON.stringify(assessment.combinedWith) : null,
  });
}

export function updateAssessment(id: string, updates: Record<string, unknown>) {
  const db = getDb();
  const setClauses: string[] = [];
  const values: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(updates)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (key === 'diagnosis' || key === 'combinedWith') {
      setClauses.push(`${dbKey} = @${key}`);
      values[key] = JSON.stringify(value);
    } else if (key === 'passed') {
      setClauses.push(`${dbKey} = @${key}`);
      values[key] = value ? 1 : 0;
    } else {
      setClauses.push(`${dbKey} = @${key}`);
      values[key] = value;
    }
  }

  if (setClauses.length > 0) {
    db.prepare(`UPDATE assessments SET ${setClauses.join(', ')} WHERE id = @id`).run(values);
  }
}

export function getAssessmentsBySession(sessionId: string) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM assessments WHERE session_id = ? ORDER BY timestamp').all(sessionId) as Record<string, unknown>[];
  return rows.map(parseAssessmentRow);
}

export function getAssessmentsByLayer(layerId: string, limit = 20) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM assessments WHERE layer_id = ? ORDER BY timestamp DESC LIMIT ?').all(layerId, limit) as Record<string, unknown>[];
  return rows.map(parseAssessmentRow);
}

function parseAssessmentRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    layerId: row.layer_id as string,
    sessionId: row.session_id as string,
    timestamp: row.timestamp as string,
    targetCognitiveProcess: row.target_cognitive_process as number,
    targetKnowledgeType: row.target_knowledge_type as number,
    type: row.type as string,
    prompt: row.prompt as string,
    userResponse: row.user_response as string,
    confidencePrediction: row.confidence_prediction as number,
    observedSoloLevel: row.observed_solo_level as number,
    aiEvaluation: row.ai_evaluation as string,
    diagnosis: JSON.parse((row.diagnosis as string) || '{}'),
    passed: Boolean(row.passed),
    combinedWith: row.combined_with ? JSON.parse(row.combined_with as string) : undefined,
  };
}

// === Chat message operations ===

export function createChatMessage(msg: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  timestamp: string;
  assessmentId?: string;
  confidencePrompt?: boolean;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO chat_messages (id, session_id, role, content, timestamp, assessment_id, confidence_prompt)
    VALUES (@id, @sessionId, @role, @content, @timestamp, @assessmentId, @confidencePrompt)
  `).run({
    ...msg,
    assessmentId: msg.assessmentId || null,
    confidencePrompt: msg.confidencePrompt ? 1 : 0,
  });
}

export function getChatMessages(sessionId: string) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp').all(sessionId) as Record<string, unknown>[];
  return rows.map(row => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as string,
    content: row.content as string,
    timestamp: row.timestamp as string,
    assessmentId: row.assessment_id as string | null,
    confidencePrompt: Boolean(row.confidence_prompt),
  }));
}

/**
 * Relayer state persistence (on-disk)
 *
 * Stores processed event IDs and cursors to prevent duplicate processing
 * across restarts. Uses a JSON file with atomic writes.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_STATE = {
    version: 1,
    processedDeposits: [],
    processedBurns: [],
    cursors: {
        stacksLastEventId: null,
        stacksLastBlock: 0,
    },
};

const STATE_PATH = resolveStatePath();
const MAX_EVENTS = normalizeInt(process.env.RELAYER_STATE_MAX_EVENTS, 10000);
const RETENTION_DAYS = normalizeInt(process.env.RELAYER_STATE_RETENTION_DAYS, 7);
const RETENTION_MS = RETENTION_DAYS > 0 ? RETENTION_DAYS * 24 * 60 * 60 * 1000 : 0;

let state = normalizeState(loadStateFile());
let depositSet = new Set(state.processedDeposits.map((item) => item.id));
let burnSet = new Set(state.processedBurns.map((item) => item.id));
let saveTimer = null;

function resolveStatePath() {
    const customPath = process.env.RELAYER_STATE_PATH;
    if (customPath && customPath.trim()) {
        return path.resolve(process.cwd(), customPath.trim());
    }
    return path.resolve(process.cwd(), '.relayer-state.json');
}

function normalizeInt(value, fallback) {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function loadStateFile() {
    try {
        if (!fs.existsSync(STATE_PATH)) return DEFAULT_STATE;
        const raw = fs.readFileSync(STATE_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        console.warn(`⚠️ Failed to read relayer state, starting fresh: ${error.message}`);
        return DEFAULT_STATE;
    }
}

function normalizeState(raw) {
    const normalized = {
        ...DEFAULT_STATE,
        ...raw,
        processedDeposits: Array.isArray(raw?.processedDeposits) ? raw.processedDeposits : [],
        processedBurns: Array.isArray(raw?.processedBurns) ? raw.processedBurns : [],
        cursors: {
            ...DEFAULT_STATE.cursors,
            ...(raw?.cursors || {}),
        },
    };

    pruneListInPlace(normalized.processedDeposits, MAX_EVENTS, RETENTION_MS);
    pruneListInPlace(normalized.processedBurns, MAX_EVENTS, RETENTION_MS);

    return normalized;
}

function pruneListInPlace(list, maxEntries, retentionMs) {
    if (!Array.isArray(list)) return;

    const now = Date.now();
    if (retentionMs > 0) {
        const retained = list.filter((item) => typeof item.ts === 'number' && now - item.ts <= retentionMs);
        list.length = 0;
        list.push(...retained);
    }

    if (list.length > maxEntries) {
        const startIndex = list.length - maxEntries;
        list.splice(0, startIndex);
    }
}

function ensureStateDir() {
    const dir = path.dirname(STATE_PATH);
    fs.mkdirSync(dir, { recursive: true });
}

function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        saveState();
    }, 500);
}

function saveState() {
    try {
        ensureStateDir();
        const tmpPath = `${STATE_PATH}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2));
        fs.renameSync(tmpPath, STATE_PATH);
    } catch (error) {
        console.warn(`⚠️ Failed to write relayer state: ${error.message}`);
    }
}

export function flushState() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    saveState();
}

export function getStateInfo() {
    return {
        path: STATE_PATH,
        deposits: state.processedDeposits.length,
        burns: state.processedBurns.length,
        cursors: { ...state.cursors },
    };
}

export function isDepositProcessed(eventId) {
    return depositSet.has(eventId);
}

export function markDepositProcessed(eventId, meta = {}) {
    if (depositSet.has(eventId)) return;
    depositSet.add(eventId);
    state.processedDeposits.push({
        id: eventId,
        ts: Date.now(),
        ...meta,
    });
    pruneListInPlace(state.processedDeposits, MAX_EVENTS, RETENTION_MS);
    depositSet = new Set(state.processedDeposits.map((item) => item.id));
    scheduleSave();
}

export function isBurnProcessed(eventId) {
    return burnSet.has(eventId);
}

export function markBurnProcessed(eventId, meta = {}) {
    if (burnSet.has(eventId)) return;
    burnSet.add(eventId);
    state.processedBurns.push({
        id: eventId,
        ts: Date.now(),
        ...meta,
    });
    pruneListInPlace(state.processedBurns, MAX_EVENTS, RETENTION_MS);
    burnSet = new Set(state.processedBurns.map((item) => item.id));
    scheduleSave();
}

export function getStacksCursor() {
    return {
        lastEventId: state.cursors.stacksLastEventId,
        lastBlock: state.cursors.stacksLastBlock,
    };
}

export function setStacksCursor({ lastEventId, lastBlock }) {
    const nextEventId = lastEventId || null;
    const nextBlock = typeof lastBlock === 'number' ? lastBlock : state.cursors.stacksLastBlock;

    const changed =
        state.cursors.stacksLastEventId !== nextEventId ||
        state.cursors.stacksLastBlock !== nextBlock;

    if (!changed) return;

    state.cursors.stacksLastEventId = nextEventId;
    state.cursors.stacksLastBlock = nextBlock;
    scheduleSave();
}

process.on('SIGINT', flushState);
process.on('SIGTERM', flushState);

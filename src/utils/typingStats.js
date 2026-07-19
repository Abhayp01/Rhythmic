// src/utils/typingStats.js

/**
 * Calculates typing consistency score based on standard deviation of per-second WPM.
 * Consistency = 100 - (stddev / mean * 100)
 */
export function calculateConsistency(wpmHistory) {
  if (!wpmHistory || wpmHistory.length === 0) return 100;
  
  // Filter out initial seconds where typing might not have started properly or is zero
  const activeWpm = wpmHistory.filter(w => w > 0);
  if (activeWpm.length === 0) return 100;

  const n = activeWpm.length;
  const mean = activeWpm.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 100;

  const variance = activeWpm.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stddev = Math.sqrt(variance);

  const score = Math.round(100 - (stddev / mean * 100));
  return Math.min(100, Math.max(0, score));
}

/**
 * Compares average WPM of the final third against the first two thirds to see if speed dropped by >15%.
 */
export function checkWpmDrop(wpmHistory) {
  if (!wpmHistory || wpmHistory.length < 3) return false;
  
  const segmentLength = Math.floor(wpmHistory.length / 3);
  if (segmentLength === 0) return false;

  const firstThird = wpmHistory.slice(0, segmentLength);
  const secondThird = wpmHistory.slice(segmentLength, segmentLength * 2);
  const finalThird = wpmHistory.slice(segmentLength * 2);

  const avgFirstTwo = [...firstThird, ...secondThird].reduce((a, b) => a + b, 0) / (segmentLength * 2);
  const avgFinal = finalThird.reduce((a, b) => a + b, 0) / finalThird.length;

  if (avgFirstTwo === 0) return false;

  return (avgFirstTwo - avgFinal) / avgFirstTwo > 0.15;
}

/**
 * Retrieves the session history from localStorage (max last 20 results).
 */
export function getSessionHistory() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('rhythmic_history') || '[]');
  } catch (e) {
    console.error("Failed to read history from localStorage", e);
    return [];
  }
}

/**
 * Saves a new result to the localStorage history and keeps it capped at 20 items.
 */
export function saveSessionResult(result) {
  if (typeof window === 'undefined') return;
  try {
    const history = getSessionHistory();
    // Add date if not present
    const record = {
      ...result,
      date: result.date || new Date().toISOString()
    };
    history.push(record);
    // Keep only last 20 sessions
    const updatedHistory = history.slice(-20);
    localStorage.setItem('rhythmic_history', JSON.stringify(updatedHistory));
  } catch (e) {
    console.error("Failed to save history to localStorage", e);
  }
}

/**
 * Generates rule-based coaching feedback.
 */
export function getFeedback({ keyErrors, keyTaps, wpmHistory, accuracy, netWpm }) {
  // Rule 1: 3+ keys with >2x average error rate
  let totalErrors = 0;
  let totalTaps = 0;
  const errorsMap = keyErrors || {};
  const tapsMap = keyTaps || {};

  Object.keys(tapsMap).forEach(key => {
    totalTaps += tapsMap[key] || 0;
    totalErrors += errorsMap[key] || 0;
  });

  const averageErrorRate = totalTaps > 0 ? totalErrors / totalTaps : 0;
  const weakKeys = [];

  Object.keys(tapsMap).forEach(key => {
    const taps = tapsMap[key] || 0;
    const errors = errorsMap[key] || 0;
    const rate = taps > 0 ? errors / taps : 0;

    // Filter noise: require at least 2 errors and error rate to be > 2x average
    if (errors >= 2 && rate > 2 * averageErrorRate) {
      weakKeys.push(key.toUpperCase());
    }
  });

  if (weakKeys.length >= 3) {
    return `You had a significantly higher error rate on keys: ${weakKeys.join(', ')}. Try slowing down slightly when typing these letters to build more precise muscle memory.`;
  }

  // Rule 2: WPM drops > 15% in final third
  if (checkWpmDrop(wpmHistory)) {
    return "Your typing pace fell by over 15% during the final third of the session. This suggests potential finger fatigue; try keeping sessions shorter or taking small breaks.";
  }

  // Rule 3: Accuracy < 90% but speed is above average history
  const history = getSessionHistory();
  const validHistory = history.filter(h => h.netWpm > 0);
  const rollingAvgWpm = validHistory.length > 0
    ? validHistory.reduce((sum, h) => sum + h.netWpm, 0) / validHistory.length
    : 40; // Default benchmark if no history is present

  if (accuracy < 90 && netWpm > rollingAvgWpm) {
    return `Your speed (${netWpm} WPM) is above your average pacing, but your accuracy is below 90%. Slowing down just a bit will improve your precision and boost your overall Net WPM.`;
  }

  // Fallback / Neutral positive reinforcement
  if (accuracy >= 95 && netWpm >= 50) {
    return "Outstanding performance! Your accuracy and rhythm are superb. Keep pushing yourself at this level to unlock higher speeds.";
  }
  
  return "Great rhythm and focus! Your typing speed and accuracy are well balanced. Keep practicing to build consistent muscle memory.";
}

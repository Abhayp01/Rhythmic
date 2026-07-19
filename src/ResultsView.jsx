// src/ResultsView.jsx
import { useState, useMemo } from 'react';
import { getFeedback, getSessionHistory } from './utils/typingStats';

const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ['space']
];

// Custom WPM Chart Component using raw SVG for maximum stability and performance
const WpmChart = ({ wpmHistory = [], errorSeconds = [] }) => {
  if (wpmHistory.length === 0) return null;

  const width = 500;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 25, left: 35 };

  const maxWpm = Math.max(...wpmHistory, 10);
  const minWpm = 0;

  const pointsCount = wpmHistory.length;

  const points = wpmHistory.map((wpm, idx) => {
    const x = padding.left + (idx / Math.max(1, pointsCount - 1)) * (width - padding.left - padding.right);
    const y = height - padding.bottom - ((wpm - minWpm) / (maxWpm - minWpm)) * (height - padding.top - padding.bottom);
    return { x, y, wpm, second: idx + 1 };
  });

  const pathD = points.length > 0
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
    : '';

  return (
    <div className="w-full">
      <svg className="w-full h-auto text-gray-400 dark:text-gray-500" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2b714" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#e2b714" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Axis Grid & Labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padding.top + ratio * (height - padding.top - padding.bottom);
          const value = Math.round(maxWpm - ratio * (maxWpm - minWpm));
          return (
            <g key={idx} className="opacity-15 dark:opacity-30">
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] font-mono fill-current font-bold"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* X Axis Labels (every 5s or at end) */}
        {points.filter((_, idx) => idx === 0 || (idx + 1) % 5 === 0 || idx === pointsCount - 1).map((p, idx) => (
          <text
            key={idx}
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            className="text-[9px] font-mono fill-current opacity-50 font-bold"
          >
            {p.second}s
          </text>
        ))}

        {/* Area fill */}
        {areaD && <path d={areaD} fill="url(#chartGrad)" />}

        {/* WPM Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#e2b714"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Error Moments as Red Dots */}
        {errorSeconds.map((sec, idx) => {
          const p = points[sec - 1]; // sec is 1-indexed based on elapsed seconds
          if (!p) return null;
          return (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r={5}
                fill="#ef4444"
                className="opacity-75"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill="#ef4444"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Small Sparkline component for history trend
const Sparkline = ({ values = [] }) => {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const padding = 2;

  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * w;
    const y = h - padding - ((val - min) / range) * (h - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-20 h-6 text-primary flex-shrink-0" viewBox={`0 0 ${w} ${h}`}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export default function ResultsView({ results, onRestart }) {
  const [hoveredKey, setHoveredKey] = useState(null);

  const history = useMemo(() => getSessionHistory(), []);

  // Calculate rolling statistics
  const { bestWpm, avgWpm, trendWpms } = useMemo(() => {
    if (history.length === 0) {
      return { bestWpm: results.netWpm, avgWpm: results.netWpm, trendWpms: [results.netWpm] };
    }
    const wpms = history.map(h => h.netWpm);
    return {
      bestWpm: Math.max(...wpms, results.netWpm),
      avgWpm: Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length),
      trendWpms: wpms
    };
  }, [history, results.netWpm]);

  // Calculate best duration (shortest) across history and current session
  const bestDurationSec = useMemo(() => {
    const durations = history.map(h => h.durationSec).filter(Boolean);
    if (results.durationSec) durations.push(results.durationSec);
    return durations.length ? Math.min(...durations) : null;
  }, [history, results.durationSec]);

  // Map consistency scores to rating bands
  const consistencyLabel = useMemo(() => {
    const score = results.consistency;
    if (score >= 90) return { text: "Very consistent", color: "text-emerald-500" };
    if (score >= 70) return { text: "Consistent", color: "text-primary" };
    return { text: "Erratic pace", color: "text-red-500" };
  }, [results.consistency]);

  const feedbackText = useMemo(() => getFeedback(results), [results]);

  // Calculate error rates for the heatmap keys
  const keyStats = useMemo(() => {
    const keyErrors = results.keyErrors || {};
    const keyTaps = results.keyTaps || {};

    const maxRate = Math.max(
      ...Object.keys(keyErrors).map(k => (keyErrors[k] || 0) / (keyTaps[k] || 1)),
      0.05
    );

    return { keyErrors, keyTaps, maxRate };
  }, [results.keyErrors, results.keyTaps]);

  const getKeyStyleAndInfo = (key) => {
    const taps = keyStats.keyTaps[key] || 0;
    const errors = keyStats.keyErrors[key] || 0;
    const errorRate = taps > 0 ? errors / taps : 0;

    if (taps === 0) {
      return {
        className: 'bg-gray-100 dark:bg-gray-800/40 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700/50',
        info: 'Not used'
      };
    }

    if (errors === 0) {
      return {
        className: 'border-primary/30 bg-primary/5 text-primary dark:text-yellow-400/90',
        info: `${taps} keystrokes | 0 errors`
      };
    }

    const ratio = errorRate / keyStats.maxRate; // scale relative to peak error rate

    // Interpolate primary yellow (#e2b714 -> rgb(226,183,20)) to red (#ef4444 -> rgb(239,68,68))
    const r = Math.round(226 + (239 - 226) * ratio);
    const g = Math.round(183 + (68 - 183) * ratio);
    const b = Math.round(20 + (68 - 20) * ratio);

    return {
      style: {
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.25)`,
        borderColor: `rgb(${r}, ${g}, ${b})`,
        color: `rgb(${r}, ${g}, ${b})`
      },
      className: 'border font-bold',
      info: `${errors} error${errors > 1 ? 's' : ''} / ${taps} tap${taps > 1 ? 's' : ''} (${Math.round(errorRate * 100)}%)`
    };
  };

  return (
    <div className="w-full max-w-2xl bg-white dark:bg-gray-800/50 p-6 sm:p-10 rounded-2xl shadow-xl backdrop-blur-sm border border-gray-200 dark:border-gray-700 font-mono animate-fade-in">
      
      {/* Header with Sparkline */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-5 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-text-active">
            Session Complete
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-widest">
            {results.difficulty === 700 ? 'Relaxing' : results.difficulty === 300 ? 'Semi' : 'Pro'} Mode
          </p>
        </div>
        {trendWpms.length > 1 && (
          <div className="flex flex-col items-end gap-1">
            <Sparkline values={trendWpms} />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Trend (Last 20)</span>
          </div>
        )}
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
        <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="text-3xl sm:text-4xl font-bold text-primary">{results.netWpm}</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 font-semibold">Net WPM</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="text-2xl sm:text-3xl font-bold text-gray-400 dark:text-gray-500 mt-1">{results.rawWpm}</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 font-semibold">Raw WPM</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-text-active">{results.accuracy}%</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 font-semibold">Accuracy</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-text-active">{results.consistency}</div>
          <div className={`text-[9px] ${consistencyLabel.color} font-semibold uppercase tracking-wider mt-1`}>
            {consistencyLabel.text}
          </div>
        </div>
      </div>
        <div className="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <div className="text-3xl sm:text-4xl font-bold text-primary">{results.durationSec}s</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1 font-semibold">Duration</div>
        </div>

      {/* History Chips */}
      <div className="flex flex-wrap justify-center gap-3 mb-6 text-xs">
        <span className="bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full font-bold">
          Best: {bestWpm} WPM
        </span>
        <span className="bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full font-bold">
          Average: {avgWpm} WPM
        </span>
      <span className="bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full font-bold">Best Time: {bestDurationSec}s</span>
      </div>

      {/* WPM Line Graph */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 mb-6">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
          Speed & Error Timeline
        </h3>
        <WpmChart wpmHistory={results.wpmHistory} errorSeconds={results.errorSeconds} />
      </div>

      {/* Keyboard Heatmap */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Accuracy Heatmap
          </h3>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-200/50 dark:bg-gray-800 px-2 py-0.5 rounded">
            {hoveredKey 
              ? `${hoveredKey.toUpperCase()}: ${getKeyStyleAndInfo(hoveredKey).info}`
              : "Hover keys to inspect"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 sm:gap-2 items-center">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-1.5 sm:gap-2 justify-center w-full">
              {row.map((key) => {
                const styleInfo = getKeyStyleAndInfo(key);
                const isSpace = key === 'space';
                
                return (
                  <div
                    key={key}
                    onMouseEnter={() => setHoveredKey(key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={styleInfo.style}
                    className={`
                      ${isSpace ? 'w-44 sm:w-56 h-9 sm:h-11' : 'w-8 h-8 sm:w-10 sm:h-10'}
                      ${styleInfo.className}
                      flex items-center justify-center rounded-lg border text-xs sm:text-sm transition-all select-none cursor-pointer relative group
                    `}
                  >
                    <span>{isSpace ? 'Space' : key.toUpperCase()}</span>
                    
                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-[10px] px-2.5 py-1 rounded-md shadow-lg z-10 whitespace-nowrap pointer-events-none border border-gray-800">
                      {key.toUpperCase()}: {styleInfo.info}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Auto-generated Coaching Feedback */}
      <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-sm text-gray-800 dark:text-text-active leading-relaxed mb-8">
        <span className="font-bold text-primary mr-1">💡 Coaching Tip:</span>
        {feedbackText}
      </div>

      {/* Restart CTA */}
      <button
        onClick={onRestart}
        className="w-full bg-primary text-gray-900 font-bold text-xl py-4 rounded-xl hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0 transition-all duration-200"
      >
        NEW SESSION
      </button>

    </div>
  );
}

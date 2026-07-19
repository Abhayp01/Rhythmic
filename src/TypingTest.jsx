import { useEffect, useRef, useState, useMemo } from "react";
import { calculateConsistency } from "./utils/typingStats";
import "./App.css";

const TypingTest = ({ musicUrl, lyrics, difficulty, onComplete }) => {
  // Structure lyrics into word objects with global indices for word-by-word rendering
  const wordObjects = useMemo(() => {
    const rawWords = lyrics.trim().split(/\s+/);
    let charIndex = 0;
    return rawWords.map((wordStr, wordIdx) => {
      const charsInWord = [];
      for (let i = 0; i < wordStr.length; i++) {
        charsInWord.push({ char: wordStr[i], globalIndex: charIndex });
        charIndex++;
      }
      const isLastWord = wordIdx === rawWords.length - 1;
      if (!isLastWord) {
        charsInWord.push({ char: ' ', globalIndex: charIndex });
        charIndex++;
      }
      return {
        wordIndex: wordIdx,
        text: wordStr,
        chars: charsInWord,
      };
    });
  }, [lyrics]);

  // Flatten character array for typing indices comparison
  const chars = useMemo(() => {
    return wordObjects.flatMap(w => w.chars.map(c => c.char));
  }, [wordObjects]);

  const [currIndex, setCurrIndex] = useState(0);
  const [correctChar, setCorrectChar] = useState(0);
  const [errorChar, setErrorChar] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);

  // Pacing Index for metronome guide
  const [paceIndex, setPaceIndex] = useState(-1);

  // Live Statistics tracking states
  const [wpmHistory, setWpmHistory] = useState([]);
  const [errorSeconds, setErrorSeconds] = useState([]);
  const [keyErrors, setKeyErrors] = useState({});
  const [keyTaps, setKeyTaps] = useState({});

  // Refs for tracking counts inside the 1-second interval without resets
  const correctCharRef = useRef(0);
  const errorCharRef = useRef(0);

  useEffect(() => {
    correctCharRef.current = correctChar;
  }, [correctChar]);

  useEffect(() => {
    errorCharRef.current = errorChar;
  }, [errorChar]);

  // Array to store status of each char: 'pending', 'correct', 'incorrect'
  const [charStatus, setCharStatus] = useState(new Array(chars.length).fill('pending'));

  const audioRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const inputRef = useRef(null);

  // Initialize Audio (if provided) and focus input
  useEffect(() => {
    if (musicUrl) {
      audioRef.current = new Audio(musicUrl);
    }
    inputRef.current?.focus();

    // Cleanup audio and timers on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [musicUrl]);

  const isActive = currIndex < chars.length;

  // Sample WPM every 1 second
  useEffect(() => {
    let intervalId;
    if (startTime && isActive) {
      intervalId = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        if (elapsedSec > 0) {
          const timeElapsed = elapsedSec / 60;
          // Standard Net WPM calculation for current second
          const currentWpm = Math.round((correctCharRef.current / 5) / timeElapsed);
          setWpmHistory(prev => [...prev, currentWpm]);
        }
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [startTime, isActive]);

  // Metronome pacing cue timer (runs only in text-only mode when isPlaying is true)
  useEffect(() => {
    let intervalId;
    if (!musicUrl && difficulty && isPlaying && startTime && isActive) {
      setPaceIndex(prev => (prev === -1 ? 0 : prev));

      intervalId = setInterval(() => {
        setPaceIndex(prev => {
          if (prev < chars.length - 1) {
            return prev + 1;
          } else {
            clearInterval(intervalId);
            return prev;
          }
        });
      }, difficulty);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [musicUrl, isPlaying, startTime, difficulty, isActive, chars.length]);

  // Calculate live HUD stats
  useEffect(() => {
    if (startTime && currIndex > 0) {
      const timeElapsed = (Date.now() - startTime) / 60000; // in minutes
      const currentWpm = Math.round((correctChar / 5) / timeElapsed);
      setWpm(currentWpm < 0 || !isFinite(currentWpm) ? 0 : currentWpm);

      const totalTyped = correctChar + errorChar;
      const currentAcc = totalTyped > 0 ? Math.round((correctChar / totalTyped) * 100) : 100;
      setAccuracy(currentAcc);
    }
  }, [currIndex, correctChar, errorChar, startTime]);

  const handleKeyDown = (e) => {
    if (currIndex >= chars.length) return;

    const key = e.key;

    // Ignore non-character keys (except Backspace)
    if (key.length > 1 && key !== "Backspace") return;

    let currentStartTime = startTime;
    if (!startTime) {
      currentStartTime = Date.now();
      setStartTime(currentStartTime);
    }

    // Handle Playback/Pacing State
    if (!isPlaying) {
      if (audioRef.current) {
        audioRef.current.play().catch(err => console.error("Audio play failed", err));
      }
      setIsPlaying(true);
    }

    // Reset pause timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    }, difficulty);

    if (key === "Backspace") {
      if (currIndex > 0) {
        const newIndex = currIndex - 1;
        setCurrIndex(newIndex);

        // Revert status of the character we just backspaced over
        setCharStatus(prev => {
          const newStatus = [...prev];
          newStatus[newIndex] = 'pending';
          return newStatus;
        });
      }
      return;
    }

    // Check correctness
    const targetChar = chars[currIndex];
    const isCorrect = key === targetChar;

    // Heatmap statistics tracking (for standard letters and Space)
    let keyName = null;
    if (/[a-z]/i.test(targetChar)) {
      keyName = targetChar.toLowerCase();
    } else if (targetChar === ' ') {
      keyName = 'space';
    }

    if (keyName) {
      setKeyTaps(prev => ({ ...prev, [keyName]: (prev[keyName] || 0) + 1 }));
      if (!isCorrect) {
        setKeyErrors(prev => ({ ...prev, [keyName]: (prev[keyName] || 0) + 1 }));
        
        // Log the exact second this error happened
        const elapsedSec = Math.max(0, Math.floor((Date.now() - currentStartTime) / 1000));
        setErrorSeconds(prev => prev.includes(elapsedSec) ? prev : [...prev, elapsedSec]);
      }
    }

    if (isCorrect) {
      setCorrectChar(prev => prev + 1);
      setCharStatus(prev => {
        const newStatus = [...prev];
        newStatus[currIndex] = 'correct';
        return newStatus;
      });
    } else {
      setErrorChar(prev => prev + 1);
      setCharStatus(prev => {
        const newStatus = [...prev];
        newStatus[currIndex] = 'incorrect';
        return newStatus;
      });
    }

    const newIndex = currIndex + 1;
    setCurrIndex(newIndex);

    // Check completion
    if (newIndex >= chars.length) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const totalTimeMin = (Date.now() - currentStartTime) / 60000;
      const finalCorrect = correctChar + (isCorrect ? 1 : 0);
      const finalError = errorChar + (isCorrect ? 0 : 1);
      const finalTotal = finalCorrect + finalError;

      // Net WPM = (Correct Characters / 5) / Time
      const finalNetWpm = totalTimeMin > 0 ? Math.max(0, Math.round((finalCorrect / 5) / totalTimeMin)) : 0;
      // Raw WPM = (Total Typed Characters / 5) / Time
      const finalRawWpm = totalTimeMin > 0 ? Math.round((finalTotal / 5) / totalTimeMin) : 0;
      const finalAccuracy = finalTotal > 0 ? Math.round((finalCorrect / finalTotal) * 100) : 100;

      // Compute final WPM history array
      const finalWpmHistory = [...wpmHistory, finalNetWpm];
      const finalConsistency = calculateConsistency(finalWpmHistory);

      // Assemble final results structure
      onComplete({
        netWpm: finalNetWpm,
        rawWpm: finalRawWpm,
        accuracy: finalAccuracy,
        wpmHistory: finalWpmHistory,
        errorSeconds: isCorrect ? errorSeconds : [...errorSeconds, Math.max(0, Math.floor((Date.now() - currentStartTime) / 1000))],
        keyErrors: (keyName && !isCorrect) 
          ? { ...keyErrors, [keyName]: (keyErrors[keyName] || 0) + 1 } 
          : keyErrors,
        keyTaps: keyName 
          ? { ...keyTaps, [keyName]: (keyTaps[keyName] || 0) + 1 } 
          : keyTaps,
        consistency: finalConsistency,
        difficulty,
        durationSec: Math.round((Date.now() - currentStartTime) / 1000)
      });
    }
  };

  // Keep focus on hidden input
  const handleBlur = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-4xl outline-none" onClick={handleBlur}>
      {/* HUD Stats */}
      <div className="flex gap-8 mb-8 font-mono text-primary text-2xl sm:text-3xl font-bold">
        <div>WPM: {wpm}</div>
        <div>ACC: {accuracy}%</div>
      </div>

      {/* Typing Lyrics Display Area */}
      <div className="font-mono text-2xl sm:text-3xl leading-relaxed text-gray-400 dark:text-gray-600 relative select-none break-words whitespace-pre-wrap transition-colors duration-300">
        {wordObjects.map((wordObj) => {
          const firstCharIdx = wordObj.chars[0].globalIndex;
          const lastCharIdx = wordObj.chars[wordObj.chars.length - 1].globalIndex;

          const isCompleted = currIndex > lastCharIdx;
          const isCurrent = currIndex >= firstCharIdx && currIndex <= lastCharIdx;

          // Styling words word-by-word
          let wordClassName = "inline rounded transition-all duration-200 ";
          if (isCurrent) {
            wordClassName += "bg-primary/10 px-1.5 py-0.5";
          } else if (isCompleted) {
            wordClassName += "opacity-40";
          } else {
            wordClassName += "opacity-100";
          }

          return (
            <span key={wordObj.wordIndex} className={wordClassName}>
              {wordObj.chars.map((charObj) => {
                const index = charObj.globalIndex;
                let charClassName = "relative transition-colors duration-100";

                if (charStatus[index] === 'correct') {
                  charClassName += " text-gray-800 dark:text-text-active font-semibold";
                } else if (charStatus[index] === 'incorrect') {
                  charClassName += " text-red-500 dark:text-red-400 font-semibold";
                } else {
                  charClassName += " text-gray-400 dark:text-gray-600";
                }

                // Visual metronome pacing highlight
                const isPacingCue = !musicUrl && index === paceIndex;
                if (isPacingCue) {
                  charClassName += " bg-primary/20 border-b-2 border-primary/50 animate-pulse";
                }

                // Typing cursor caret
                if (index === currIndex) {
                  charClassName += " border-l-2 border-primary animate-pulse";
                }

                return (
                  <span key={index} className={charClassName}>
                    {charObj.char}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>

      {/* Hidden input field for typing capture */}
      <input
        ref={inputRef}
        type="text"
        className="absolute opacity-0 top-0 left-0 pointer-events-none"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck="false"
      />

      {/* Footer Visual Pacing / Audio bouncing bars */}
      <div className="h-12 flex items-center justify-center gap-1 mt-12">
        {isPlaying ? (
          musicUrl ? (
            <>
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s`, height: '20px' }}
                ></div>
              ))}
            </>
          ) : difficulty ? (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-primary rounded-full animate-ping" />
              <span className="text-primary text-sm font-bold uppercase tracking-wider animate-pulse">
                Pacing Metronome Active
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-primary text-sm font-bold uppercase tracking-wider animate-pulse">
                Typing...
              </span>
            </div>
          )
        ) : (
          <div className="text-gray-400 dark:text-gray-500 text-sm font-mono animate-pulse">
            {musicUrl ? "Type to play music..." : difficulty ? "Type to start pacing metronome..." : "Type to start..."}
          </div>
        )}
      </div>
    </div>
  );
};

export default TypingTest;

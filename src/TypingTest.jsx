import { useEffect, useRef, useState, useMemo } from "react";
import "./App.css";

const TypingTest = ({ musicUrl, lyrics, difficulty, onComplete }) => {
  // Parse lyrics into words and characters
  const words = useMemo(() => {
    return lyrics.trim().split(/\s+/).map(word => {
      return [...word.split(''), ' ']; // Add space at end of each word
    }).flat();
  }, [lyrics]);

  // Remove the very last space added
  const chars = useMemo(() => {
    const c = [...words];
    if (c.length > 0 && c[c.length - 1] === ' ') {
      c.pop();
    }
    return c;
  }, [words]);

  const [currIndex, setCurrIndex] = useState(0);
  const [correctChar, setCorrectChar] = useState(0);
  const [errorChar, setErrorChar] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);

  // Array to store status of each char: 'pending', 'correct', 'incorrect'
  const [charStatus, setCharStatus] = useState(new Array(chars.length).fill('pending'));

  const audioRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const inputRef = useRef(null);

  // Initialize Audio and focus input
  useEffect(() => {
    audioRef.current = new Audio(musicUrl);
    inputRef.current?.focus();

    // Cleanup audio on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [musicUrl]);

  // Calculate stats
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

    if (!startTime) {
      setStartTime(Date.now());
    }

    // Handle Audio Playback
    if (!isPlaying) {
      audioRef.current.play().catch(e => console.error("Audio play failed", e));
      setIsPlaying(true);
    }

    // Reset pause timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      audioRef.current.pause();
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

        // Note: We don't decrement error/correct counts strictly to avoid complex state management
        // for backspacing. Simple WPM calculation usually ignores backspaces or counts them as activity.
        // For strict accuracy, we might want to track history, but for this MVP we'll keep it simple.
      }
      return;
    }

    // Check correctness
    const targetChar = chars[currIndex];
    const isCorrect = key === targetChar;

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
      audioRef.current.pause();
      onComplete({ wpm, accuracy });
    }
  };

  // Keep focus
  const handleBlur = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-4xl outline-none" onClick={handleBlur}>
      <div className="flex gap-8 mb-8 font-mono text-primary text-2xl sm:text-3xl font-bold">
        <div>WPM: {wpm}</div>
        <div>ACC: {accuracy}%</div>
      </div>

      <div className="font-mono text-2xl sm:text-3xl leading-relaxed text-gray-400 dark:text-gray-600 relative select-none break-words whitespace-pre-wrap transition-colors duration-300">
        {chars.map((char, index) => {
          let className = "relative transition-colors duration-100";
          if (charStatus[index] === 'correct') className += " text-gray-800 dark:text-text-active";
          if (charStatus[index] === 'incorrect') className += " text-red-500 dark:text-red-400";
          if (index === currIndex) className += " border-l-2 border-primary animate-pulse";

          return (
            <span key={index} className={className}>
              {char}
            </span>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="text"
        className="absolute opacity-0 top-0 left-0 pointer-events-none"
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoFocus
      />

      <div className="h-12 flex items-center justify-center gap-1 mt-12">
        {isPlaying ? (
          <>
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.1}s`, height: '20px' }}
              ></div>
            ))}
          </>
        ) : (
          <div className="text-gray-400 dark:text-gray-500 text-sm font-mono animate-pulse">Type to play music...</div>
        )}
      </div>
    </div>
  );
};

export default TypingTest;

import { useState, useEffect } from "react";
import "./App.css";
import TypingTest from "./TypingTest";
import ResultsView from "./ResultsView";
import { ThemeProvider } from "./ThemeContext";
import ThemeToggle from "./ThemeToggle";
import { saveSessionResult } from "./utils/typingStats";
import { paragraphs } from "./data/paragraphs";

function AppContent() {
  // Mode selection initialization (URL query -> localStorage -> default 'random')
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get("mode");
      if (urlMode && ["song", "custom", "random"].includes(urlMode)) {
        return urlMode;
      }
      const savedMode = localStorage.getItem("rhythmic_mode");
      if (savedMode && ["song", "custom", "random"].includes(savedMode)) {
        return savedMode;
      }
    }
    return "random";
  });

  const [musicUrl, setMusicUrl] = useState(null);
  const [lyrics, setLyrics] = useState("");
  const [difficulty, setDifficulty] = useState(300); // Default to 'Semi' (300ms)
  const [randomDifficulty, setRandomDifficulty] = useState("medium");
  const [selectedParagraph, setSelectedParagraph] = useState("");
  const [gameStatus, setGameStatus] = useState("setup"); // setup, playing, finished
  const [results, setResults] = useState(null);

  // Sync mode changes to localStorage and URL query parameters without page reload
  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem("rhythmic_mode", newMode);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("mode", newMode);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }
  };

  // Set a random paragraph when random difficulty changes or mode switches to random
  useEffect(() => {
    if (mode === "random" && paragraphs[randomDifficulty]) {
      const list = paragraphs[randomDifficulty];
      const randIdx = Math.floor(Math.random() * list.length);
      setSelectedParagraph(list[randIdx]);
    }
  }, [randomDifficulty, mode]);

  const handleShuffle = () => {
    if (paragraphs[randomDifficulty]) {
      const list = paragraphs[randomDifficulty];
      let randIdx = Math.floor(Math.random() * list.length);
      let newParagraph = list[randIdx];
      // Attempt to get a different paragraph than current
      let attempts = 0;
      while (newParagraph === selectedParagraph && attempts < 10) {
        randIdx = Math.floor(Math.random() * list.length);
        newParagraph = list[randIdx];
        attempts++;
      }
      setSelectedParagraph(newParagraph);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMusicUrl(url);
    }
  };

  const handleStart = () => {
    if (mode === "song") {
      if (musicUrl && lyrics.trim().length > 0) {
        setGameStatus("playing");
      } else {
        alert("Please upload a song and enter lyrics!");
      }
    } else if (mode === "custom") {
      if (lyrics.length >= 50 && lyrics.length <= 2000) {
        setGameStatus("playing");
      } else {
        alert("Pasted text must be between 50 and 2000 characters!");
      }
    } else if (mode === "random") {
      if (selectedParagraph.trim().length > 0) {
        setGameStatus("playing");
      }
    }
  };

  const handleComplete = (stats) => {
    // Save results to history
    saveSessionResult({
      mode,
      difficulty: activeDifficulty,
      netWpm: stats.netWpm,
      accuracy: stats.accuracy,
      consistency: stats.consistency,
      durationSec: stats.durationSec,
      date: new Date().toISOString()
    });
    setResults(stats);
    setGameStatus("finished");
  };

  const resetGame = () => {
    setGameStatus("setup");
    setResults(null);
    if (mode === "song") {
      setMusicUrl(null);
      setLyrics("");
    } else if (mode === "random") {
      handleShuffle();
    }
  };

  // Determine active difficulty pacing speed
  const activeDifficulty = mode === "random"
    ? (randomDifficulty === "easy" ? 700 : randomDifficulty === "medium" ? 300 : 169)
    : (mode === "custom" ? null : difficulty);

  // Determine active lyric/practice text
  const activeLyrics = mode === "random" ? selectedParagraph : lyrics;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-100 dark:bg-bg-dark transition-colors duration-300 font-mono">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-text-active mb-2 tracking-tighter">
          RHYTHMIC
        </h1>
        <p className="text-primary text-lg opacity-90 font-medium">Type to the beat</p>
      </div>

      {/* Mode Tab Bar Segmented Control */}
      {gameStatus === "setup" && (
        <div className="flex gap-3 mb-6 z-10 flex-wrap justify-center">
          {[
            { id: "song", label: "Song Mode" },
            { id: "custom", label: "Custom Text" },
            { id: "random", label: "Random Text" }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`px-4 sm:px-6 py-2.5 rounded-full border font-bold text-xs sm:text-sm transition-all duration-200 ${
                mode === tab.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary'
              }`}
              onClick={() => handleModeChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {gameStatus === "setup" && (
        <div className="w-full max-w-2xl bg-white dark:bg-gray-800/50 p-6 sm:p-10 rounded-2xl shadow-xl backdrop-blur-sm border border-gray-200 dark:border-gray-700 transition-all duration-300">
          <div className="flex flex-col gap-6">
            
            {/* Song Mode Setup Form */}
            {mode === "song" && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    1. Upload Song (Audio)
                  </label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400
                      file:mr-4 file:py-2.5 file:px-6
                      file:rounded-full file:border-0
                      file:text-sm file:font-bold
                      file:bg-primary file:text-gray-900
                      hover:file:bg-yellow-500
                      cursor-pointer file:cursor-pointer
                      transition-all duration-200
                    "
                  />
                  {musicUrl && <span className="text-xs text-emerald-500 font-bold mt-1">✓ Audio uploaded successfully</span>}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    2. Paste Lyrics
                  </label>
                  <textarea
                    className="w-full h-48 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-text-active p-4 rounded-xl font-mono resize-y focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-600"
                    placeholder="Paste the lyrics here..."
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    3. Select Difficulty (Pause Delay)
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Relaxing', val: 700, desc: '0.7s' },
                      { label: 'Semi', val: 300, desc: '0.3s' },
                      { label: 'Pro', val: 169, desc: '0.17s' }
                    ].map((item) => (
                      <button
                        key={item.val}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 ${difficulty === item.val
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary'
                          }`}
                        onClick={() => setDifficulty(item.val)}
                      >
                        <span className="font-bold">{item.label}</span>
                        <span className="text-xs opacity-75">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className={`w-full bg-primary text-gray-900 font-bold text-xl py-4 rounded-xl hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0 transition-all duration-200 mt-4 ${
                    (!musicUrl || lyrics.trim().length === 0) ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                  }`}
                  onClick={handleStart}
                  disabled={!musicUrl || lyrics.trim().length === 0}
                >
                  START SESSION
                </button>
              </>
            )}

            {/* Custom Text Mode Setup Form */}
            {mode === "custom" && (
              <>
                <div className="flex flex-col gap-2 relative">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Paste Your Text
                  </label>
                  <textarea
                    className="w-full h-48 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-text-active p-4 rounded-xl font-mono resize-y focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-600"
                    placeholder="Paste or type the text you want to practice on..."
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                  />
                  <div className="flex justify-between items-center text-xs text-gray-400 mt-1 px-1">
                    <span>Min 50 / Max 2000 characters</span>
                    <span className={lyrics.length >= 50 && lyrics.length <= 2000 ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                      {lyrics.length} / 2000
                    </span>
                  </div>
                </div>

                <button
                  className={`w-full bg-primary text-gray-900 font-bold text-xl py-4 rounded-xl hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0 transition-all duration-200 mt-4 ${
                    (lyrics.length < 50 || lyrics.length > 2000) ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                  }`}
                  onClick={handleStart}
                  disabled={lyrics.length < 50 || lyrics.length > 2000}
                >
                  START SESSION
                </button>
              </>
            )}

            {/* Random Text Mode Setup Form */}
            {mode === "random" && (
              <>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      1. Select Difficulty
                    </label>
                    <button
                      onClick={handleShuffle}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-yellow-500 transition-colors duration-200 px-2.5 py-1.5 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/20"
                      title="Shuffle paragraph"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
                      </svg>
                      Shuffle
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Easy', val: 'easy', desc: '~40 words' },
                      { label: 'Medium', val: 'medium', desc: '~70 words' },
                      { label: 'Hard', val: 'hard', desc: '~110 words' }
                    ].map((item) => (
                      <button
                        key={item.val}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 ${randomDifficulty === item.val
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary'
                          }`}
                        onClick={() => setRandomDifficulty(item.val)}
                      >
                        <span className="font-bold">{item.label}</span>
                        <span className="text-xs opacity-75">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    2. Preview Paragraph
                  </label>
                  <div className="w-full h-44 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 p-4 rounded-xl font-mono text-sm text-gray-700 dark:text-gray-300 select-none leading-relaxed">
                    {selectedParagraph}
                  </div>
                </div>

                <button
                  className="w-full bg-primary text-gray-900 font-bold text-xl py-4 rounded-xl hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0 transition-all duration-200 mt-4"
                  onClick={handleStart}
                >
                  START SESSION
                </button>
              </>
            )}

          </div>
        </div>
      )}

      {gameStatus === "playing" && (
        <TypingTest
          musicUrl={mode === "song" ? musicUrl : null}
          lyrics={activeLyrics}
          difficulty={activeDifficulty}
          onComplete={handleComplete}
        />
      )}

      {gameStatus === "finished" && results && (
        <ResultsView results={results} onRestart={resetGame} />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;

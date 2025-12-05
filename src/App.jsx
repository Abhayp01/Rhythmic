import { useState } from "react";
import "./App.css";
import TypingTest from "./TypingTest";
import { ThemeProvider } from "./ThemeContext";
import ThemeToggle from "./ThemeToggle";

function AppContent() {
  const [musicUrl, setMusicUrl] = useState(null);
  const [lyrics, setLyrics] = useState("");
  const [difficulty, setDifficulty] = useState(700); // Default to 'Relaxing'
  const [gameStatus, setGameStatus] = useState("setup"); // setup, playing, finished
  const [results, setResults] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMusicUrl(url);
    }
  };

  const handleStart = () => {
    if (musicUrl && lyrics.trim().length > 0) {
      setGameStatus("playing");
    } else {
      alert("Please upload a song and enter lyrics!");
    }
  };

  const handleComplete = (stats) => {
    setResults(stats);
    setGameStatus("finished");
  };

  const resetGame = () => {
    setGameStatus("setup");
    setResults(null);
    setMusicUrl(null);
    setLyrics("");
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-100 dark:bg-bg-dark transition-colors duration-300 font-mono">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-text-active mb-2 tracking-tighter">
          RHYTHMIC
        </h1>
        <p className="text-primary text-lg opacity-90 font-medium">Type to the beat</p>
      </div>

      {gameStatus === "setup" && (
        <div className="w-full max-w-2xl bg-white dark:bg-gray-800/50 p-6 sm:p-10 rounded-2xl shadow-xl backdrop-blur-sm border border-gray-200 dark:border-gray-700 transition-all duration-300">
          <div className="flex flex-col gap-6">
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
              className="w-full bg-primary text-gray-900 font-bold text-xl py-4 rounded-xl hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0 transition-all duration-200 mt-4"
              onClick={handleStart}
            >
              START SESSION
            </button>
          </div>
        </div>
      )}

      {gameStatus === "playing" && (
        <TypingTest
          musicUrl={musicUrl}
          lyrics={lyrics}
          difficulty={difficulty}
          onComplete={handleComplete}
        />
      )}

      {gameStatus === "finished" && results && (
        <div className="w-full max-w-lg bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-2xl text-center border border-gray-200 dark:border-gray-700 animate-fade-in">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-text-active mb-8">Session Complete</h2>
          <div className="flex justify-center gap-12 mb-10">
            <div className="flex flex-col items-center">
              <span className="text-5xl font-bold text-primary mb-2">{results.wpm}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest">WPM</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-5xl font-bold text-primary mb-2">{results.accuracy}%</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-widest">Accuracy</span>
            </div>
          </div>
          <button
            className="w-full bg-primary text-gray-900 font-bold text-lg py-3 rounded-xl hover:bg-yellow-500 transition-colors duration-200"
            onClick={resetGame}
          >
            NEW SESSION
          </button>
        </div>
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

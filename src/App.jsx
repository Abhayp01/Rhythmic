import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [write, setWrite] = useState("");
  const typingTimeoutRef = useRef(null);
  const [music, setMusic] = useState(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const easy = 700;
  const medium = 300;
  const hard = 169;
  const [difficulty, setdifficulty] = useState(1000);

  useEffect(() => {
    if (music) {
      audioRef.current = new Audio(music);
      audioRef.current.addEventListener("ended", () => {
        setIsPlaying(false);
      });
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [music]);

  useEffect(() => {
    if (write !== "") {
      if (!isPlaying) {
        document.getElementsByClassName('bars')[0].style.visibility='visible';
        audioRef.current &&
          audioRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch((error) => console.error("Error playing audio:", error));
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        audioRef.current && audioRef.current.pause();
        setIsPlaying(false);
        document.getElementsByClassName('bars')[0].style.visibility='hidden';
      }, difficulty);  
    } 
    else {
      audioRef.current && audioRef.current.pause();
      setIsPlaying(false);
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [write]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const musicUrl = URL.createObjectURL(file);
      setMusic(musicUrl);
    }
  };

  return (
    <>
      <h1 className="font-extrabold text-3xl font-serif text-center text-cyan-700">
        MUSIC
      </h1>
      <div className="flex justify-center p-7 ml-10">
        <input
          type="file"
          id="file"
          onChange={handleFileChange}
          accept="audio/*"
        />
      </div>
      <div className="bars">
    <div className="bars__item"></div>
    <div className="bars__item"></div>
    <div className="bars__item"></div>
    <div className="bars__item"></div>
      </div>
      <div className="flex justify-center p-3">
        <button
          className="py-1 px-3 border-solid border-2 border-black m-1"
          onClick={() => setdifficulty(easy)}
        >
          Relaxing
        </button>
        <button
          className="py-1 px-3 border-solid border-2 border-black m-1"
          onClick={() => setdifficulty(medium)}
        >
          Semi 
        </button>
        <button
          className="py-1 px-3 border-solid border-2 border-black m-1"
          onClick={() => setdifficulty(hard)}
        >
          Pro
        </button>
      </div>

      <div className="flex justify-center w-full">
        <textarea
        placeholder="Write......."
          className="w-[50%] font-medium text-xl p-2"
          cols="30"
          rows="10"
          value={write}
          onChange={(e) => setWrite(e.target.value)}
        />
      </div>
    </>
  );
}

export default App;

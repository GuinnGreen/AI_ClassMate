import { useState, useRef } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import { useTheme } from '../contexts/ThemeContext';
import loafIdle from '../assets/lottie/cat_loaf_idle.json';
import curiousLook from '../assets/lottie/cat_curious_look.json';
import lazyRoll from '../assets/lottie/cat_lazy_roll.json';

type CatMood = 'idle' | 'curious' | 'roll';

const ANIMATIONS: Record<CatMood, unknown> = {
  idle: loafIdle,
  curious: curiousLook,
  roll: lazyRoll,
};

const MEOWS = ['喵~', '喵嗚~', 'Zzz...', '咪～', '哈～'];

export const LazyCat = () => {
  const theme = useTheme();
  const [mood, setMood] = useState<CatMood>('idle');
  const [bubbleText, setBubbleText] = useState('');
  const [bubbleKey, setBubbleKey] = useState(0);
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);

  const handleClick = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // 連點循環切換動畫：curious → roll → idle
    clickCountRef.current = (clickCountRef.current + 1) % 3;
    const nextMood: CatMood = clickCountRef.current === 1 ? 'curious' : clickCountRef.current === 2 ? 'roll' : 'idle';
    setMood(nextMood);

    setBubbleText(MEOWS[Math.floor(Math.random() * MEOWS.length)]);
    setBubbleKey(k => k + 1);

    // 3 秒後若沒再點擊，自動回到 idle 並清掉氣泡
    timerRef.current = setTimeout(() => {
      setMood('idle');
      setBubbleText('');
      clickCountRef.current = 0;
    }, 3000);
  };

  return (
    <>
      <style>{`
        @keyframes lazycat-bubble { 0%{opacity:0;transform:translate(-50%,4px) scale(0.8)} 20%,80%{opacity:1;transform:translate(-50%,0) scale(1)} 100%{opacity:0;transform:translate(-50%,-6px) scale(0.9)} }
        .lazycat-bubble { animation: lazycat-bubble 2.4s ease-out forwards; }
      `}</style>
      <div
        onClick={handleClick}
        className="absolute bottom-2 right-2 cursor-pointer select-none z-10 hover:scale-110 transition-transform duration-200"
        title="點我互動"
      >
        {bubbleText && (
          <div
            key={bubbleKey}
            className={`lazycat-bubble absolute -top-6 left-1/2 px-2.5 py-1 rounded-full ${theme.surface} border ${theme.border} shadow-md text-xs font-bold ${theme.text} whitespace-nowrap pointer-events-none z-20`}
          >
            {bubbleText}
          </div>
        )}
        <Lottie
          lottieRef={lottieRef}
          animationData={ANIMATIONS[mood]}
          loop
          autoplay
          style={{ width: 96, height: 96, imageRendering: 'pixelated' }}
        />
      </div>
    </>
  );
};

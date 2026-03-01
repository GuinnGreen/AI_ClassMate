export const FontStyles = ({ zhuyinMode = false }: { zhuyinMode?: boolean }) => {
  const fontFamily = zhuyinMode
    ? "'BpmfHuninn', 'Zen Maru Gothic', sans-serif"
    : "'Zen Maru Gothic', sans-serif";

  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&family=Zen+Maru+Gothic:wght@400;500;700&display=swap');

      @font-face {
        font-family: 'BpmfHuninn';
        src: url('/fonts/BpmfHuninn-Regular.woff2') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }

      body {
        font-family: ${fontFamily} !important;
      }

      .font-handwritten {
        font-family: ${fontFamily} !important;
      }

      .notebook-paper {
        background-color: transparent;
        background-image: linear-gradient(
          transparent calc(var(--board-line-height, 3.5rem) - 1px),
          rgba(0, 0, 0, 0.1) 1px
        );
        background-size: 100% var(--board-line-height, 3.5rem);
        background-origin: content-box;
        background-attachment: local;
        line-height: var(--board-line-height, 3.5rem);
        font-weight: 700;
      }

      .dark .notebook-paper {
        background-image: linear-gradient(
          transparent calc(var(--board-line-height, 3.5rem) - 1px),
          rgba(255, 255, 255, 0.12) 1px
        );
      }

      .notebook-paper-vertical {
        background-color: transparent;
        background-image: linear-gradient(
          to right,
          transparent calc(var(--board-line-height, 3.5rem) - 1px),
          rgba(0, 0, 0, 0.1) 1px
        );
        background-size: var(--board-line-height, 3.5rem) 100%;
        background-origin: content-box;
        background-attachment: local;
        line-height: var(--board-line-height, 3.5rem);
        font-weight: 700;
      }

      .dark .notebook-paper-vertical {
        background-image: linear-gradient(
          to right,
          transparent calc(var(--board-line-height, 3.5rem) - 1px),
          rgba(255, 255, 255, 0.12) 1px
        );
      }

      .notebook-paper-vertical-rl {
        background-position: right top;
      }

      /* 注音模式：加大行距 */
      .zhuyin-active .notebook-paper {
        background-size: 100% calc(var(--board-line-height, 3.5rem) * 1.5);
        background-image: linear-gradient(
          transparent calc(var(--board-line-height, 3.5rem) * 1.5 - 1px),
          rgba(0, 0, 0, 0.1) 1px
        );
        line-height: calc(var(--board-line-height, 3.5rem) * 1.5);
      }

      .zhuyin-active.dark .notebook-paper,
      .zhuyin-active .dark .notebook-paper {
        background-image: linear-gradient(
          transparent calc(var(--board-line-height, 3.5rem) * 1.5 - 1px),
          rgba(255, 255, 255, 0.12) 1px
        );
      }

      .zhuyin-active .notebook-paper-vertical {
        background-size: calc(var(--board-line-height, 3.5rem) * 1.5) 100%;
        background-image: linear-gradient(
          to right,
          transparent calc(var(--board-line-height, 3.5rem) * 1.5 - 1px),
          rgba(0, 0, 0, 0.1) 1px
        );
        line-height: calc(var(--board-line-height, 3.5rem) * 1.5);
      }

      .zhuyin-active.dark .notebook-paper-vertical,
      .zhuyin-active .dark .notebook-paper-vertical {
        background-image: linear-gradient(
          to right,
          transparent calc(var(--board-line-height, 3.5rem) * 1.5 - 1px),
          rgba(255, 255, 255, 0.12) 1px
        );
      }
    `}</style>
  );
};

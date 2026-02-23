export const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&family=Zen+Maru+Gothic:wght@400;500;700&display=swap');

    body {
      font-family: 'Zen Maru Gothic', sans-serif !important;
    }

    .font-handwritten {
      font-family: 'Zen Maru Gothic', sans-serif !important;
    }

    .notebook-paper {
      background-color: transparent;
      background-image: linear-gradient(
        transparent calc(3.5rem - 1px),
        rgba(0, 0, 0, 0.1) 1px
      );
      background-size: 100% 3.5rem;
      background-origin: content-box;
      background-attachment: local;
      line-height: 3.5rem;
      font-weight: 700;
    }

    .dark .notebook-paper {
      background-image: linear-gradient(
        transparent calc(3.5rem - 1px),
        rgba(255, 255, 255, 0.12) 1px
      );
    }

    .notebook-paper-vertical {
      background-color: transparent;
      background-image: linear-gradient(
        to right,
        transparent calc(3.5rem - 1px),
        rgba(0, 0, 0, 0.1) 1px
      );
      background-size: 3.5rem 100%;
      background-origin: content-box;
      background-attachment: local;
      line-height: 3.5rem;
      font-weight: 700;
    }

    .dark .notebook-paper-vertical {
      background-image: linear-gradient(
        to right,
        transparent calc(3.5rem - 1px),
        rgba(255, 255, 255, 0.12) 1px
      );
    }
  `}</style>
);

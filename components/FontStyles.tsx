export const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&family=Zen+Maru+Gothic:wght@400;500;700&display=swap');

    body {
      font-family: 'Zen Maru Gothic', sans-serif !important;
    }

    .font-handwritten {
      font-family: 'Klee One', cursive !important;
    }

    .notebook-paper {
      background-color: transparent;
      background-image: linear-gradient(transparent 95%, #e5e7eb 95%);
      background-size: 100% 3.5rem;
      line-height: 3.5rem;
      padding-top: 0.5rem;
      font-weight: 700;
    }

    .dark .notebook-paper {
      background-image: linear-gradient(transparent 95%, #404040 95%);
    }

    .notebook-paper-vertical {
      background-color: transparent;
      background-image: linear-gradient(to right, transparent 95%, #e5e7eb 95%);
      background-size: 3.5rem 100%;
      line-height: 3.5rem;
      padding-top: 0;
      font-weight: 700;
    }

    .dark .notebook-paper-vertical {
      background-image: linear-gradient(to right, transparent 95%, #404040 95%);
    }
  `}</style>
);

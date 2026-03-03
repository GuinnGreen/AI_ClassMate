export function UpdateBanner() {
  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-[#7B9CB5] text-white text-center py-2 px-4 text-sm flex items-center justify-center gap-2">
      <span>🎉 新版本已發布！</span>
      <button
        onClick={() => window.location.reload()}
        className="underline font-medium hover:text-[#D6E4ED]"
      >
        點此重新整理
      </button>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center">
      {message && (
        <div
          key={message}
          className="toast-in absolute left-1/2 rounded-full bg-cocoa/90 px-5 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {message}
        </div>
      )}
    </div>
  )
}

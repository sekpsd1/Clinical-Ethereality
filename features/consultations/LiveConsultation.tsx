import Image from "next/image";
import Link from "next/link";
import { Camera, FileText, Mic, Phone, PlusCircle, RefreshCw, Send, Settings } from "lucide-react";

const messages = [
  {
    sender: "doctor",
    text: "สวัสดีครับคุณนพรัตน์ วันนี้มีอาการเป็นอย่างไรบ้างครับ?",
    time: "10:45 AM"
  },
  {
    sender: "patient",
    text: "สวัสดีค่ะคุณหมอ รู้สึกปวดศีรษะมา 2 วันแล้วค่ะ แล้วก็มีไข้ต่ำๆ ด้วย",
    time: "10:46 AM"
  },
  {
    sender: "doctor",
    text: "หมอแนะนำให้พักผ่อนมากๆ และดื่มน้ำเยอะๆ นะครับ เดี๋ยวหมอจะจัดส่งยาแก้ปวดไปให้ที่บ้านครับ",
    time: "10:48 AM"
  }
] as const;

export function LiveConsultation() {
  return (
    <section className="-mx-4 flex h-dvh flex-col overflow-hidden bg-[#eceef0]">
      <LiveHeader />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-[76px]">
        <VideoPanel />
        <ChatTranscript />
        <MessageComposer />
      </main>
    </section>
  );
}

function LiveHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-[76px] max-w-[480px] items-center justify-between bg-white/70 px-6 py-4 shadow-live-header backdrop-blur-topbar">
      <div className="flex items-center gap-3">
        <div className="relative size-10 rounded-full border-2 border-primary/20 bg-[#e0f4f4]">
          <Image
            src="/images/doctors/waiting-profile.png"
            alt="Dr. Aris Thorne"
            fill
            sizes="40px"
            className="rounded-full object-cover"
          />
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-green-500" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold leading-tight text-[#115e59]">Dr. Aris Thorne</h1>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-danger">
            <span className="size-2 rounded-full bg-danger" />
            Live
          </p>
        </div>
      </div>
      <button type="button" aria-label="Consultation settings" className="flex size-10 items-center justify-center rounded-full text-[#64748b]">
        <Settings aria-hidden="true" className="size-6" strokeWidth={2.1} />
      </button>
    </header>
  );
}

function VideoPanel() {
  return (
    <section className="shrink-0 px-4 py-2">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[#151616] shadow-video-panel">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%)]" />
        <button
          type="button"
          aria-label="Play video"
          className="absolute left-1/2 top-[43%] flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-black/40 bg-black/30 text-[#d7eeee] shadow-qr-inset"
        >
          <span className="ml-1 h-0 w-0 border-y-[15px] border-l-[25px] border-y-transparent border-l-[#d7eeee]" />
        </button>

        <div className="absolute right-3 top-3 h-32 w-24 overflow-hidden rounded-xl border-2 border-white/20 bg-[#2f9b99] shadow-avatar">
          <Image
            src="/images/profiles/current-user.png"
            alt="Patient preview"
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>

        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/30 px-4 py-2 shadow-live-controls backdrop-blur-topbar">
          <VideoControl label="Toggle microphone" icon={Mic} />
          <VideoControl label="Toggle camera" icon={Camera} />
          <VideoControl label="Switch camera" icon={RefreshCw} />
        </div>
      </div>
    </section>
  );
}

function VideoControl({
  label,
  icon: Icon
}: {
  label: string;
  icon: typeof Mic;
}) {
  return (
    <button type="button" aria-label={label} className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white">
      <Icon aria-hidden="true" className="size-5" strokeWidth={2.2} />
    </button>
  );
}

function ChatTranscript() {
  return (
    <section className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
      {messages.map((message) => (
        <div key={message.time} className={message.sender === "patient" ? "flex flex-col items-end gap-2" : "flex flex-col items-start gap-2"}>
          <div
            className={
              message.sender === "patient"
                ? "max-w-[85%] rounded-2xl rounded-tr-none border border-white/50 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-chat-bubble backdrop-blur-topbar"
                : "max-w-[85%] rounded-2xl rounded-tl-none border border-primary/10 bg-[#d9eeee]/80 px-4 py-3 text-sm leading-relaxed text-[#134e4a] shadow-chat-bubble backdrop-blur-topbar"
            }
          >
            {message.text}
          </div>
          <span className={message.sender === "patient" ? "mr-1 text-[10px] text-[#3e494a]/60" : "ml-1 text-[10px] text-[#3e494a]/60"}>
            {message.time}
          </span>
        </div>
      ))}

      <div className="flex flex-col items-start gap-2">
        <div className="flex w-64 items-center gap-3 rounded-xl border border-primary/20 bg-[#d9eeee]/80 p-3 shadow-chat-bubble backdrop-blur-topbar">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#0d9488] text-white">
            <FileText aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#134e4a]">Prescription_0421.pdf</p>
            <p className="text-[10px] text-[#0d9488]">1.2 MB</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageComposer() {
  return (
    <footer className="shrink-0 border-t border-white/20 bg-white/70 p-4 backdrop-blur-topbar">
      <div className="flex items-end gap-3">
        <div className="flex min-h-[56px] min-w-0 flex-1 items-center rounded-2xl bg-[#e6e8ea]/50 px-3 py-1">
          <button type="button" aria-label="Add attachment" className="p-2 text-[#94a3b8]">
            <PlusCircle aria-hidden="true" className="size-6" strokeWidth={2.1} />
          </button>
          <textarea
            aria-label="Message"
            placeholder="พิมพ์ข้อความ..."
            rows={1}
            className="min-w-0 flex-1 resize-none border-none bg-transparent py-3 text-sm text-slate-700 outline-none placeholder:text-[#94a3b8] focus:ring-0"
          />
          <button type="button" aria-label="Send message" className="p-2 text-primary">
            <Send aria-hidden="true" className="size-6 fill-primary" strokeWidth={2} />
          </button>
        </div>

        <Link href="/consult/advice-log" aria-label="End consultation" className="mb-1 flex flex-col items-center gap-1 text-danger">
          <span className="flex size-12 items-center justify-center rounded-full bg-danger text-white shadow-live-end">
            <Phone aria-hidden="true" className="size-6 fill-white" strokeWidth={2.2} />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-normal">วางสาย</span>
        </Link>
      </div>
      <div className="mx-auto mt-4 h-1 w-32 rounded-full bg-slate-200/80" />
    </footer>
  );
}

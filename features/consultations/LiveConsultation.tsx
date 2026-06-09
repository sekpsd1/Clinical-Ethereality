import Image from "next/image";
import Link from "next/link";
import { Camera, FileText, Mic, Phone, RefreshCw, Settings } from "lucide-react";
import { ConsultationMessageComposer } from "@/features/consultations/chat/ConsultationMessageComposer";
import type { LiveConsultationChatData } from "@/features/consultations/chat/types";

export function LiveConsultation({ chat }: { chat: LiveConsultationChatData }) {
  return (
    <section className="-mx-4 flex h-dvh flex-col overflow-hidden bg-[#eceef0]">
      <LiveHeader chat={chat} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-[76px]">
        <VideoPanel chat={chat} />
        <ChatTranscript chat={chat} />
        <MessageComposer chat={chat} />
      </main>
    </section>
  );
}

function LiveHeader({ chat }: { chat: LiveConsultationChatData }) {
  return (
    <header className="fixed inset-x-0 top-0 z-header mx-auto flex h-[76px] max-w-[480px] items-center justify-between bg-white/70 px-6 py-4 shadow-live-header backdrop-blur-topbar">
      <div className="flex items-center gap-3">
        <div className="relative size-10 rounded-full border-2 border-primary/20 bg-[#e0f4f4]">
          <Image src={chat.doctorImageUrl} alt={chat.doctorName} fill sizes="40px" className="rounded-full object-cover" />
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-green-500" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold leading-tight text-[#115e59]">{chat.doctorName}</h1>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-danger">
            <span className="size-2 rounded-full bg-danger" />
            {chat.statusLabel}
          </p>
        </div>
      </div>
      <button type="button" aria-label="Consultation settings" className="flex size-10 items-center justify-center rounded-full text-[#64748b]">
        <Settings aria-hidden="true" className="size-6" strokeWidth={2.1} />
      </button>
    </header>
  );
}

function VideoPanel({ chat }: { chat: LiveConsultationChatData }) {
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
          <Image src={chat.patientImageUrl} alt="Patient preview" fill sizes="96px" className="object-cover" />
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

function ChatTranscript({ chat }: { chat: LiveConsultationChatData }) {
  return (
    <section className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
      {chat.messages.map((message) => (
        <div key={message.id} className={message.isOwnMessage ? "flex flex-col items-end gap-2" : "flex flex-col items-start gap-2"}>
          <div
            className={
              message.isOwnMessage
                ? "max-w-[85%] rounded-2xl rounded-tr-none border border-white/50 bg-white/80 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-chat-bubble backdrop-blur-topbar"
                : "max-w-[85%] rounded-2xl rounded-tl-none border border-primary/10 bg-[#d9eeee]/80 px-4 py-3 text-sm leading-relaxed text-[#134e4a] shadow-chat-bubble backdrop-blur-topbar"
            }
          >
            {message.body}
          </div>
          <span className={message.isOwnMessage ? "mr-1 text-[10px] text-[#3e494a]/60" : "ml-1 text-[10px] text-[#3e494a]/60"}>
            {message.createdAt}
          </span>
        </div>
      ))}

      <div className="flex flex-col items-start gap-2">
        <div className="flex w-64 items-center gap-3 rounded-xl border border-primary/20 bg-[#d9eeee]/80 p-3 shadow-chat-bubble backdrop-blur-topbar">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#0d9488] text-white">
            <FileText aria-hidden="true" className="size-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#134e4a]">สรุปคำแนะนำหลังปรึกษา.pdf</p>
            <p className="text-[10px] text-[#0d9488]">รอเชื่อมต่อไฟล์จากระบบจัดเก็บ</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageComposer({ chat }: { chat: LiveConsultationChatData }) {
  return (
    <footer className="shrink-0 border-t border-white/20 bg-white/70 p-4 backdrop-blur-topbar">
      <div className="flex items-end gap-3">
        <ConsultationMessageComposer consultationId={chat.consultationId} canSend={chat.canSend} />

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

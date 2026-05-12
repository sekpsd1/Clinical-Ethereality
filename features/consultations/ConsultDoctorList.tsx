import Image from "next/image";
import Link from "next/link";
import { Search, Star } from "lucide-react";

type Doctor = {
  name: string;
  specialty: string;
  tags: string[];
  price: string;
  rating: string;
  imageSrc: string;
};

const filterChips = ["ตรวจ HPV", "โรคผิวหนัง", "อายุรกรรม", "ปรึกษาทั่วไป"];

const doctors: Doctor[] = [
  {
    name: "นพ. สมชาย รัตนวงศาล",
    specialty: "ผู้เชี่ยวชาญด้านโรคทั่วไป",
    tags: ["#สุขภาพดี", "#ที่ปรึกษาออนไลน์"],
    price: "฿850",
    rating: "4.9",
    imageSrc: "/images/doctors/somchai.png"
  },
  {
    name: "พญ. วริศรา นครินทร์",
    specialty: "ผู้เชี่ยวชาญด้านผิวหนัง",
    tags: ["#สิวและริ้วรอย", "#SkinCare"],
    price: "฿1,200",
    rating: "5.0",
    imageSrc: "/images/doctors/warisara.png"
  },
  {
    name: "พญ. ณิชา อัครวงศ์",
    specialty: "กุมารแพทย์",
    tags: [],
    price: "฿950",
    rating: "4.8",
    imageSrc: "/images/doctors/nicha.png"
  }
];

export function ConsultDoctorList() {
  return (
    <section className="flex flex-col gap-4">
      <label className="flex h-14 items-center rounded-full bg-[#e6e8ea] px-4 text-[14px] text-[#3e494a]/60">
        <Search aria-hidden="true" className="mr-3 size-[18px] shrink-0 text-[#7d8a8b]" />
        <span className="truncate">ค้นหาชื่อคุณหมอหรือความเชี่ยวชาญ...</span>
      </label>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filterChips.map((chip, index) => (
          <button
            key={chip}
            type="button"
            className={
              index === 0
                ? "h-[30px] shrink-0 rounded-full bg-primary px-4 text-xs font-bold text-white shadow-chip"
                : "h-[30px] shrink-0 rounded-full border border-[#bdc9ca]/30 bg-white px-[17px] text-xs font-bold text-primary"
            }
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 pt-2">
        {doctors.map((doctor) => (
          <DoctorCard key={doctor.name} doctor={doctor} />
        ))}
      </div>
    </section>
  );
}

function DoctorCard({ doctor }: { doctor: Doctor }) {
  return (
    <article className="flex min-h-[106px] gap-3 overflow-hidden rounded-[12px] border border-white/40 bg-white/70 p-[13px] shadow-doctor backdrop-blur-card">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg">
        <Image src={doctor.imageSrc} alt={doctor.name} fill sizes="80px" className="object-cover" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="truncate text-[14px] font-bold leading-5 text-primary">{doctor.name}</h2>
          <span className="inline-flex h-[19px] shrink-0 items-center gap-0.5 rounded bg-[#d4e4fc]/30 px-1.5 py-0.5 text-[10px] font-bold leading-[15px] text-primary">
            <Star aria-hidden="true" className="size-2.5 fill-primary text-primary" />
            {doctor.rating}
          </span>
        </div>

        <p className="truncate text-[11px] leading-[16.5px] text-[#3e494a]">{doctor.specialty}</p>

        {doctor.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-1.5">
            {doctor.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold leading-[13.5px] text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-2.5">
          <p className="text-xs font-bold leading-4 text-primary">{doctor.price}</p>
          <Link
            href="/consult/booking/somchai"
            className="h-[27px] rounded-full bg-primary-gradient px-3 text-[10px] font-bold leading-[15px] text-white shadow-chip"
          >
            จองคำปรึกษา
          </Link>
        </div>
      </div>
    </article>
  );
}

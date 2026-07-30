"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Camera, Send, X } from "lucide-react";
import {
  createCommunityPostAction,
  updateCommunityPostAction,
  type CommunityPostActionState
} from "@/features/community/actions";
import { communityCategories } from "@/features/community/policy";
import type { CommunityPostEditorData } from "@/features/community/types";
import { compressCommunityImage } from "@/features/community/images/client-compression";
import { formatCommunityImageBytes } from "@/features/community/images/policy";

const initialState: CommunityPostActionState = {
  status: "idle",
  message: ""
};

export function CommunityPostForm({
  mode,
  post
}: {
  mode: "create" | "edit";
  post?: CommunityPostEditorData;
}) {
  const action = mode === "create" ? createCommunityPostAction : updateCommunityPostAction;
  const [state, formAction] = useActionState(action, initialState);
  const [category, setCategory] = useState(post?.category ?? communityCategories[1]);
  const [imagePending, setImagePending] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageSummary, setImageSummary] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(post?.coverImageUrl ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const formId = "community-post-form";

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    },
    []
  );

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    setImagePending(true);
    setImageError("");
    setImageSummary("");

    try {
      const compressed = await compressCommunityImage(file);
      const transfer = new DataTransfer();
      transfer.items.add(compressed);
      input.files = transfer.files;

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      objectUrlRef.current = URL.createObjectURL(compressed);
      setPreviewUrl(objectUrlRef.current);
      setRemoveImage(false);
      setImageSummary(
        `บีบอัดแล้ว ${formatCommunityImageBytes(file.size)} → ${formatCommunityImageBytes(compressed.size)}`
      );
    } catch (error) {
      input.value = "";
      setImageError(error instanceof Error ? error.message : "ไม่สามารถบีบอัดรูปนี้ได้");
    } finally {
      setImagePending(false);
    }
  }

  function clearImage() {
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl(null);
    setImageSummary("");
    setImageError("");
    setRemoveImage(Boolean(post?.coverImageUrl));
  }

  function preventSubmitWhileCompressing(event: FormEvent<HTMLFormElement>) {
    if (imagePending) {
      event.preventDefault();
    }
  }

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_right,#e0f2f1_0%,#f7f9fb_100%)] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#191c1e]">
      <header className="fixed inset-x-0 top-0 z-header bg-white/70 shadow-[0_0_40px_rgba(0,123,131,0.06)] backdrop-blur-[24px]">
        <div className="mx-auto flex h-[104px] w-full max-w-mobile items-center justify-between px-7">
          <div className="flex min-w-0 items-center gap-5">
            <Link
              href={post ? `/community/${post.slug}` : "/community"}
              aria-label="Back to community"
              className="flex size-10 items-center justify-center rounded-full text-primary"
            >
              <ArrowLeft aria-hidden="true" className="size-7" strokeWidth={2.25} />
            </Link>
            <h1 className="truncate text-[24px] font-bold tracking-tight text-[#3e494a]">
              {mode === "create" ? "เขียนกระทู้ใหม่" : "แก้ไขกระทู้"}
            </h1>
          </div>
          <button
            type="submit"
            form={formId}
            disabled={imagePending}
            className="h-[58px] shrink-0 rounded-full bg-primary px-8 text-[20px] font-bold text-white shadow-[0_10px_24px_rgba(0,96,103,0.2)]"
          >
            {mode === "create" ? "Post" : "Save"}
          </button>
        </div>
      </header>

      <form
        id={formId}
        action={formAction}
        onSubmit={preventSubmitWhileCompressing}
        className="mx-auto flex w-full max-w-mobile flex-col px-6 pb-10 pt-[140px]"
      >
        {post ? (
          <>
            <input type="hidden" name="articleId" value={post.id} />
            <input type="hidden" name="slug" value={post.slug} />
          </>
        ) : null}
        <input type="hidden" name="category" value={category} />
        {removeImage ? <input type="hidden" name="removeImage" value="on" /> : null}

        <section className="rounded-[24px] border border-white/20 bg-white/70 p-6 shadow-[0_20px_50px_rgba(0,96,103,0.12)] backdrop-blur-[10px]">
          <div className="space-y-7">
            <label className="block space-y-3">
              <span className="ml-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">หัวข้อกระทู้</span>
              <input
                type="text"
                name="title"
                defaultValue={post?.title}
                minLength={5}
                maxLength={160}
                required
                placeholder="ระบุหัวข้อที่น่าสนใจ..."
                className="h-[82px] w-full rounded-[16px] border-0 bg-[#e6e8ea]/50 px-5 text-[20px] text-[#191c1e] outline-none placeholder:text-[#3e494a]/45 focus:ring-2 focus:ring-[#7ad5dd]"
              />
              {state.fieldErrors?.title?.[0] ? <FieldError message={state.fieldErrors.title[0]} /> : null}
            </label>

            <label className="block space-y-3">
              <span className="ml-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">เนื้อหากระทู้</span>
              <textarea
                name="body"
                defaultValue={post?.body}
                rows={6}
                minLength={20}
                maxLength={5000}
                required
                placeholder="แบ่งปันประสบการณ์หรือคำถามของคุณที่นี่..."
                className="min-h-[256px] w-full resize-none rounded-[16px] border-0 bg-[#e6e8ea]/50 p-5 text-[20px] leading-8 text-[#191c1e] outline-none placeholder:text-[#3e494a]/45 focus:ring-2 focus:ring-[#7ad5dd]"
              />
              {state.fieldErrors?.body?.[0] ? <FieldError message={state.fieldErrors.body[0]} /> : null}
            </label>

            <div className="block space-y-3">
              <span className="ml-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">แนบรูปภาพ</span>
              <div className="relative">
                <label className="relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[18px] border-2 border-dashed border-teal-200/70 bg-teal-50/30">
                  <input
                    ref={imageInputRef}
                    type="file"
                    name="coverImage"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    disabled={imagePending}
                    className="sr-only"
                  />
                  {previewUrl ? (
                    <>
                      <Image
                        src={previewUrl}
                        alt="ตัวอย่างรูปที่แนบ"
                        fill
                        unoptimized
                        sizes="(max-width: 430px) calc(100vw - 96px), 334px"
                        className="object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 px-4 py-3 text-center text-xs font-semibold text-white">
                        แตะเพื่อเปลี่ยนรูป
                      </span>
                    </>
                  ) : (
                    <>
                      <WellnessRoomVisual />
                      <span className="relative z-10 flex flex-col items-center px-6 text-center text-primary">
                        <Camera aria-hidden="true" className="mb-3 size-10" fill="#006067" />
                        <span className="text-sm font-semibold">
                          {imagePending ? "กำลังบีบอัดรูป..." : "แตะเพื่อเลือกรูป"}
                        </span>
                        <span className="mt-1 text-[11px] font-medium text-[#3e494a]/70">
                          JPG, PNG หรือ WebP ไม่เกิน 5 MB
                        </span>
                      </span>
                    </>
                  )}
                </label>
                {previewUrl ? (
                  <button
                    type="button"
                    onClick={clearImage}
                    aria-label="Remove attached image"
                    className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/55 text-white"
                  >
                    <X aria-hidden="true" className="size-5" />
                  </button>
                ) : null}
              </div>
              {imageSummary ? <p className="ml-1 text-xs font-semibold text-primary">{imageSummary}</p> : null}
              {imageError ? <FieldError message={imageError} /> : null}
              {state.fieldErrors?.coverImage?.[0] ? <FieldError message={state.fieldErrors.coverImage[0]} /> : null}
              <p className="ml-1 text-[11px] leading-5 text-[#3e494a]/65">
                ระบบจะย่อไม่เกิน 1600px แปลงเป็น WebP และลบ EXIF/พิกัดก่อนจัดเก็บ
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 ml-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">เลือกหมวดหมู่</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {communityCategories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
                className={
                  category === item
                    ? "shrink-0 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(0,96,103,0.2)]"
                    : "shrink-0 rounded-full border border-white/30 bg-white/70 px-5 py-3 text-sm font-semibold text-primary shadow-sm backdrop-blur-[10px]"
                }
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[20px] border border-primary/15 bg-white/65 p-4 text-left text-xs leading-5 text-[#3e494a]">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="privacyAccepted" required className="mt-1 size-4 accent-primary" />
            <span>
              ยืนยันว่าโพสต์นี้ไม่มีชื่อผู้ป่วย เบอร์โทร ที่อยู่ ภาพเวชระเบียน ใบสั่งยา
              หรือข้อมูลสุขภาพที่สามารถระบุตัวบุคคลได้
            </span>
          </label>
          {state.fieldErrors?.privacyAccepted?.[0] ? <FieldError message={state.fieldErrors.privacyAccepted[0]} /> : null}
        </section>

        {state.status === "error" ? (
          <p role="alert" className="mt-5 rounded-[18px] bg-[#ffdad6] px-4 py-3 text-sm font-semibold text-[#93000a]">
            {state.message}
          </p>
        ) : null}

        <section className="mt-7 text-center">
          <SubmitButton mode={mode} imagePending={imagePending} />
          <p className="mt-6 px-4 text-xs leading-5 text-[#3e494a]/60">
            เนื้อหาจะเผยแพร่ใน Community และสามารถแก้ไขได้เฉพาะเจ้าของโพสต์
          </p>
        </section>
      </form>
    </div>
  );
}

function SubmitButton({ mode, imagePending }: { mode: "create" | "edit"; imagePending: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || imagePending}
      className="flex h-[68px] w-full items-center justify-center gap-3 rounded-full bg-primary-gradient text-[24px] font-extrabold text-white shadow-[0_20px_40px_rgba(0,123,131,0.25)] disabled:opacity-60"
    >
      <Send aria-hidden="true" className="size-7 fill-white" />
      {imagePending ? "กำลังบีบอัดรูป..." : pending ? "กำลังบันทึก..." : mode === "create" ? "โพสต์" : "บันทึกการแก้ไข"}
    </button>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="ml-1 text-xs font-semibold text-[#93000a]">{message}</p>;
}

function WellnessRoomVisual() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 flex items-end justify-center overflow-hidden bg-[linear-gradient(90deg,rgba(244,237,221,0.65),rgba(255,255,255,0.4),rgba(244,237,221,0.65))] opacity-60"
    >
      <span className="absolute inset-y-0 left-4 w-16 skew-x-[-9deg] bg-white/55 blur-[1px]" />
      <span className="absolute inset-y-0 right-4 w-16 skew-x-[9deg] bg-white/55 blur-[1px]" />
      <span className="absolute bottom-9 h-8 w-40 rounded-full bg-[#d8c7a9]/50 blur-xl" />
      <span className="mb-8 h-9 w-40 rounded-[18px] bg-[#f5f0e8]" />
      <span className="absolute bottom-16 h-10 w-24 rounded bg-white/70" />
    </span>
  );
}

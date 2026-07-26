import { staffFileAccept, staffFileLimits } from "@/features/staff-files/types";

type ClientFileMetadata = {
  size: number;
  type: string;
};

type StaffInviteFiles = {
  profilePhoto: ClientFileMetadata | null;
  licenseProof: ClientFileMetadata | null;
};

const acceptedTypes = {
  profilePhoto: new Set(staffFileAccept.profilePhoto.split(",")),
  licenseProof: new Set(staffFileAccept.licenseProof.split(","))
};

export function validateStaffInviteFiles(files: StaffInviteFiles): string | null {
  if (!files.profilePhoto || files.profilePhoto.size === 0) {
    return "กรุณาเลือกรูปโปรไฟล์ทางการ";
  }

  if (!files.licenseProof || files.licenseProof.size === 0) {
    return "กรุณาเลือกเอกสารใบอนุญาต";
  }

  if (!acceptedTypes.profilePhoto.has(files.profilePhoto.type)) {
    return "รูปโปรไฟล์ต้องเป็นไฟล์ JPG, PNG หรือ WEBP";
  }

  if (!acceptedTypes.licenseProof.has(files.licenseProof.type)) {
    return "เอกสารใบอนุญาตต้องเป็นไฟล์ PDF, JPG, PNG หรือ WEBP";
  }

  if (files.profilePhoto.size > staffFileLimits.profilePhoto) {
    return "รูปโปรไฟล์มีขนาดใหญ่เกิน 5 MB กรุณาลดขนาดไฟล์แล้วลองใหม่";
  }

  if (files.licenseProof.size > staffFileLimits.licenseProof) {
    return "เอกสารใบอนุญาตมีขนาดใหญ่เกิน 10 MB กรุณาลดขนาดไฟล์แล้วลองใหม่";
  }

  return null;
}

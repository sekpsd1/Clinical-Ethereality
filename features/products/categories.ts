export const productCategories = [
  { value: "medicine", label: "ยาและเวชภัณฑ์" },
  { value: "supplement", label: "วิตามินและอาหารเสริม" },
  { value: "skincare", label: "ดูแลผิวและสกินแคร์" },
  { value: "health-equipment", label: "อุปกรณ์สุขภาพ" },
  { value: "other", label: "สินค้าอื่น ๆ" }
] as const;

export type ProductCategory = (typeof productCategories)[number]["value"];

export function getProductCategoryLabel(value: string): string {
  return productCategories.find((category) => category.value === value)?.label ?? "สินค้าอื่น ๆ";
}
